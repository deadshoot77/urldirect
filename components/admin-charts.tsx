"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import countries from "i18n-iso-countries";
import countriesEn from "i18n-iso-countries/langs/en.json";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import type { DailyPoint, HourlyPoint, LabelCount as LegacyLabelCount } from "@/lib/analytics";
import type { AdminLang } from "@/lib/i18n";
import type { AnalyticsGranularity, LinkOverviewStats, TimeSeriesPoint } from "@/lib/types";

countries.registerLocale(countriesEn);

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

interface LabelCount {
  label: string;
  clicks: number;
}

interface WorldGeoFeature {
  id?: string | number;
  properties?: {
    name?: string;
  };
}

let worldGeoFeaturesCache: WorldGeoFeature[] | null = null;
let worldGeoFeaturesPromise: Promise<WorldGeoFeature[]> | null = null;

interface LegacyChartsProps {
  mode?: "legacy";
  lang: AdminLang;
  daily7: DailyPoint[];
  daily30: DailyPoint[];
  hourly: HourlyPoint[];
  topDevices: LegacyLabelCount[];
  topCountries: LegacyLabelCount[];
}

interface RebrandlyChartsProps {
  mode: "rebrandly";
  lang: AdminLang;
  overview: LinkOverviewStats;
  timeseries: {
    hours: TimeSeriesPoint[];
    days: TimeSeriesPoint[];
    months: TimeSeriesPoint[];
  };
  worldMap: LabelCount[];
  topCities: LabelCount[];
  topRegions: LabelCount[];
  topDays: LabelCount[];
  popularHours: LabelCount[];
  clickType: LabelCount[];
  topSocialPlatforms: LabelCount[];
  topSources: LabelCount[];
  topBrowsers: LabelCount[];
  topDevices: LabelCount[];
  topLanguages: LabelCount[];
  topPlatforms: LabelCount[];
}

type AdminChartsProps = LegacyChartsProps | RebrandlyChartsProps;

const rebrandlyWords = {
  fr: {
    noData: "Pas de donnees",
    clicks: "Clics",
    overallPerformance: "Performance generale",
    trackClicks: "Suivi des clics par periode",
    hours: "Heures",
    days: "Jours",
    months: "Mois",
    totalClicks: "Redirects (humains)",
    qrScans: "Scans QR",
    clicksToday: "Clics aujourd'hui",
    lastClick: "Dernier clic",
    noLastClick: "Aucune donnee",
    geoDistribution: "Repartition geographique",
    clickType: "Type de clic",
    uniqueSplit: "Redirects humains: uniques vs non-uniques",
    uniqueHuman: "Uniques (humains)",
    nonUniqueHuman: "Non-uniques (humains)",
    topCities: "Top villes",
    topRegions: "Top regions",
    topDays: "Top jours",
    popularHours: "Heures populaires",
    topSocial: "Top plateformes sociales",
    topSources: "Top sources",
    topBrowsers: "Top navigateurs",
    topDevices: "Top appareils",
    topLanguages: "Top langues",
    topPlatforms: "Top plateformes",
    loadingMap: "Chargement de la carte...",
    showCountries: "Afficher les pays",
    hideCountries: "Masquer les pays",
    otherCountries: "Autres pays"
  },
  en: {
    noData: "No data yet.",
    clicks: "Clicks",
    overallPerformance: "Overall performance",
    trackClicks: "Track clicks by time range",
    hours: "Hours",
    days: "Days",
    months: "Months",
    totalClicks: "Redirects (human)",
    qrScans: "QR scans",
    clicksToday: "Clicks today",
    lastClick: "Last click",
    noLastClick: "No data",
    geoDistribution: "Geographic distribution",
    clickType: "Click type",
    uniqueSplit: "Human redirects: unique vs non-unique",
    uniqueHuman: "Unique (human)",
    nonUniqueHuman: "Non-unique (human)",
    topCities: "Top cities",
    topRegions: "Top regions",
    topDays: "Top days",
    popularHours: "Most popular hours",
    topSocial: "Top social media platforms",
    topSources: "Top sources",
    topBrowsers: "Top browsers",
    topDevices: "Top devices",
    topLanguages: "Top languages",
    topPlatforms: "Top platforms",
    loadingMap: "Loading map...",
    showCountries: "Show countries",
    hideCountries: "Hide countries",
    otherCountries: "Other countries"
  }
} as const;

function formatNumber(value: number, lang: AdminLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US").format(value);
}

function formatLastClick(value: string | null, lang: AdminLang): string {
  if (!value) return rebrandlyWords[lang].noLastClick;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatPercent(value: number, lang: AdminLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function normalizeHourLabel24(label: string): string {
  const raw = label.trim();
  if (!raw) return label;

  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    const hour12 = Number(ampmMatch[1]);
    const minute = ampmMatch[2] ?? "00";
    const marker = ampmMatch[3].toLowerCase();
    if (Number.isFinite(hour12) && hour12 >= 1 && hour12 <= 12) {
      let hour24 = hour12 % 12;
      if (marker === "pm") hour24 += 12;
      return `${String(hour24).padStart(2, "0")}:${minute}`;
    }
  }

  const hourOnly = raw.match(/^(\d{1,2})$/);
  if (hourOnly) {
    const hour = Number(hourOnly[1]);
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:00`;
    }
  }

  const hourMinute = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (hourMinute) {
    const hour = Number(hourMinute[1]);
    const minute = hourMinute[2];
    if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, "0")}:${minute}`;
    }
  }

  return label;
}

function normalizeCountryCode(input: string): string | null {
  const value = input.trim().toUpperCase();
  if (!value || value === "UNK" || value === "UNKNOWN") return null;
  if (/^[A-Z]{3}$/.test(value)) return value;
  if (/^[A-Z]{2}$/.test(value)) {
    return countries.alpha2ToAlpha3(value) ?? null;
  }
  return null;
}

function toCountryAlpha2(label: string): string | null {
  const normalized = label.trim().toUpperCase();
  if (!normalized || normalized === "UNK" || normalized === "UNKNOWN") return null;
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  if (/^[A-Z]{3}$/.test(normalized)) {
    return countries.alpha3ToAlpha2(normalized) ?? null;
  }
  return null;
}

function CountryFlag({ code }: { code: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) {
    return (
      <i className="rb-flag" aria-hidden="true">
        🌐
      </i>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/24x18/${code.toLowerCase()}.png`}
      width={24}
      height={18}
      className="rb-flag-img"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function toCountryName(label: string, lang: AdminLang): string {
  const normalized = label.trim();
  if (!normalized) return "Unknown";
  const upper = normalized.toUpperCase();
  if (upper === "UNK" || upper === "UNKNOWN") return "Unknown";

  const alpha2 = upper.length === 2 ? upper : countries.alpha3ToAlpha2(upper);
  if (!alpha2) return normalized;

  const formatter = new Intl.DisplayNames([lang === "fr" ? "fr" : "en"], { type: "region" });
  return formatter.of(alpha2) ?? normalized;
}

function mapHeatColor(clicks: number, max: number): string {
  if (clicks <= 0 || max <= 0) {
    return "#3f464d";
  }
  const ratio = Math.max(0, Math.min(1, clicks / max));
  const eased = Math.pow(ratio, 0.6);
  const red = Math.round(107 + (255 - 107) * eased);
  const green = Math.round(72 + (146 - 72) * eased);
  const blue = Math.round(43 + (32 - 43) * eased);
  return `rgb(${red}, ${green}, ${blue})`;
}

async function loadWorldGeoFeatures(): Promise<WorldGeoFeature[]> {
  if (worldGeoFeaturesCache) return worldGeoFeaturesCache;
  if (!worldGeoFeaturesPromise) {
    worldGeoFeaturesPromise = fetch("/world.geojson", { cache: "force-cache" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const features = Array.isArray((json as { features?: unknown[] } | null)?.features)
          ? (((json as { features: unknown[] }).features as unknown[]) ?? [])
          : [];
        const mapped = features.filter((entry) => entry && typeof entry === "object") as WorldGeoFeature[];
        worldGeoFeaturesCache = mapped;
        return mapped;
      })
      .catch(() => []);
  }
  return worldGeoFeaturesPromise;
}

function WorldHeatMap({ data, lang }: { data: LabelCount[]; lang: AdminLang }) {
  const [features, setFeatures] = useState<WorldGeoFeature[]>(() => worldGeoFeaturesCache ?? []);
  const [showCountries, setShowCountries] = useState(false);
  const [hovered, setHovered] = useState<{
    flagCode: string | null;
    name: string;
    share: number;
    clicks: number;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hideTooltipTimer = useRef<number | null>(null);
  const copy = rebrandlyWords[lang];

  useEffect(() => {
    let active = true;
    void loadWorldGeoFeatures().then((mapped) => {
      if (!active) return;
      setFeatures(mapped);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTooltipTimer.current !== null) {
        window.clearTimeout(hideTooltipTimer.current);
        hideTooltipTimer.current = null;
      }
    };
  }, []);

  const totalClicks = useMemo(() => data.reduce((sum, entry) => sum + entry.clicks, 0), [data]);

  const clicksByCountryCode = useMemo(() => {
    const output = new Map<string, number>();
    for (const entry of data) {
      const code = normalizeCountryCode(entry.label);
      if (!code) continue;
      output.set(code, (output.get(code) ?? 0) + entry.clicks);
    }
    return output;
  }, [data]);

  const countryRows = useMemo(() => {
    const rows = [...clicksByCountryCode.entries()]
      .map(([code, clicks]) => ({
        code,
        clicks,
        share: totalClicks > 0 ? (clicks / totalClicks) * 100 : 0,
        name: toCountryName(code, lang),
        flagCode: toCountryAlpha2(code)
      }))
      .sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name));

    const unknownClicks = data
      .filter((entry) => normalizeCountryCode(entry.label) === null)
      .reduce((sum, entry) => sum + entry.clicks, 0);

    const topCountries = rows.slice(0, 5);
    const otherClicks = unknownClicks + rows.slice(5).reduce((sum, entry) => sum + entry.clicks, 0);

    return {
      topCountries,
      otherClicks,
      otherShare: totalClicks > 0 ? (otherClicks / totalClicks) * 100 : 0
    };
  }, [clicksByCountryCode, data, lang, totalClicks]);

  const maxClicks = useMemo(() => {
    let max = 0;
    for (const value of clicksByCountryCode.values()) {
      if (value > max) max = value;
    }
    return max;
  }, [clicksByCountryCode]);

  const mapFeatures = useMemo(
    () =>
      features.filter((feature) => {
        const iso3 = typeof feature.id === "string" ? feature.id.toUpperCase() : "";
        return iso3 !== "ATA";
      }),
    [features]
  );

  const pathGenerator = useMemo(() => {
    if (mapFeatures.length === 0) return null;
    const projection = geoNaturalEarth1().fitExtent(
      [
        [16, 12],
        [1184, 488]
      ],
      {
        type: "FeatureCollection",
        features: mapFeatures
      } as any
    );
    return geoPath(projection);
  }, [mapFeatures]);

  function onCountryHover(event: React.MouseEvent<SVGPathElement>, countryCode: string, clicks: number) {
    if (hideTooltipTimer.current !== null) {
      window.clearTimeout(hideTooltipTimer.current);
      hideTooltipTimer.current = null;
    }

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = Math.min(rect.width - 168, Math.max(12, event.clientX - rect.left + 14));
    const y = Math.min(rect.height - 72, Math.max(12, event.clientY - rect.top - 8));
    const share = totalClicks > 0 ? (clicks / totalClicks) * 100 : 0;
    setHovered({
      flagCode: toCountryAlpha2(countryCode),
      name: toCountryName(countryCode, lang),
      share,
      clicks,
      x,
      y
    });
    setTooltipVisible(true);
  }

  function hideTooltipSoon(delayMs: number) {
    setTooltipVisible(false);
    if (hideTooltipTimer.current !== null) {
      window.clearTimeout(hideTooltipTimer.current);
    }
    hideTooltipTimer.current = window.setTimeout(() => {
      setHovered(null);
      hideTooltipTimer.current = null;
    }, delayMs);
  }

  function onCountryLeave() {
    hideTooltipSoon(120);
  }

  function onMapLeave() {
    hideTooltipSoon(180);
  }

  return (
    <div className="rb-world-map-wrap">
      <div className="rb-world-map">
        {!pathGenerator ? (
          <p className="rb-muted">{copy.loadingMap}</p>
        ) : (
          <svg viewBox="0 0 1200 500" aria-label={copy.geoDistribution} onMouseLeave={onMapLeave}>
            <rect x="0" y="0" width="1200" height="500" fill="#070b10" />
            {mapFeatures.map((feature, index) => {
              const iso3 = typeof feature.id === "string" ? feature.id.toUpperCase() : "";
              const clicks = iso3 ? clicksByCountryCode.get(iso3) ?? 0 : 0;
              const path = pathGenerator(feature as any);
              if (!path) return null;
              return (
                <path
                  key={`${iso3 || "country"}-${index}`}
                  d={path}
                  fill={mapHeatColor(clicks, maxClicks)}
                  stroke="#5f6670"
                  strokeWidth={0.45}
                  onMouseEnter={(event) => onCountryHover(event, iso3, clicks)}
                  onMouseMove={(event) => onCountryHover(event, iso3, clicks)}
                  onMouseLeave={onCountryLeave}
                />
              );
            })}
          </svg>
        )}

        <div
          className={`rb-map-tooltip${tooltipVisible && hovered ? " is-visible" : ""}`}
          style={{ left: `${hovered?.x ?? 0}px`, top: `${hovered?.y ?? 0}px` }}
          aria-hidden={!tooltipVisible || !hovered}
        >
          {hovered ? (
            <>
              <strong>{formatPercent(hovered.share, lang)}%</strong>
              <span>
                <CountryFlag code={hovered.flagCode} />
                {hovered.name}
              </span>
              <small>{formatNumber(hovered.clicks, lang)}</small>
            </>
          ) : null}
        </div>
      </div>

      <button type="button" className="rb-country-toggle" onClick={() => setShowCountries((current) => !current)}>
        {showCountries ? copy.hideCountries : copy.showCountries}
        <span>{showCountries ? "▴" : "▾"}</span>
      </button>

      {showCountries ? (
        <ul className="rb-country-list">
          {countryRows.topCountries.map((country, index) => (
            <li
              key={country.code}
              className={index === 0 ? "active" : ""}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <span>
                <CountryFlag code={country.flagCode} />
                {country.name}
              </span>
              <strong>{formatPercent(country.share, lang)}%</strong>
            </li>
          ))}
          {countryRows.otherClicks > 0 ? (
            <li style={{ animationDelay: `${countryRows.topCountries.length * 55}ms` }}>
              <span>{copy.otherCountries}</span>
              <strong>{formatPercent(countryRows.otherShare, lang)}%</strong>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  data,
  lang
}: {
  title: string;
  data: LabelCount[];
  lang: AdminLang;
}) {
  const max = data.reduce((highest, item) => (item.clicks > highest ? item.clicks : highest), 0);

  return (
    <article className="rb-panel rb-analytics-card">
      <h3>{title}</h3>
      {data.length === 0 ? (
        <p className="rb-muted">{rebrandlyWords[lang].noData}</p>
      ) : (
        <ul className="rb-stat-list">
          {data.slice(0, 8).map((item) => {
            const ratio = max > 0 ? Math.max(4, Math.round((item.clicks / max) * 100)) : 4;
            return (
              <li key={item.label}>
                <span>{item.label}</span>
                <div className="rb-stat-bar">
                  <i style={{ width: `${ratio}%` }} />
                </div>
                <strong>{formatNumber(item.clicks, lang)}</strong>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function RebrandlyCharts(props: RebrandlyChartsProps) {
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("days");
  const copy = rebrandlyWords[props.lang];
  const activeSeries =
    granularity === "hours" ? props.timeseries.hours : granularity === "months" ? props.timeseries.months : props.timeseries.days;

  const popularHours24 = useMemo(
    () =>
      props.popularHours.map((entry) => ({
        ...entry,
        label: normalizeHourLabel24(entry.label)
      })),
    [props.popularHours]
  );

  const performanceData = useMemo(
    () => ({
      labels: activeSeries.map((point) => (granularity === "hours" ? normalizeHourLabel24(point.label) : point.label)),
      datasets: [
        {
          label: copy.clicks,
          data: activeSeries.map((point) => point.clicks),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.2)",
          fill: true,
          tension: 0.28,
          pointRadius: 2
        }
      ]
    }),
    [activeSeries, copy.clicks, granularity]
  );

  const clickTypeData = useMemo(
    () => ({
      labels: props.clickType.map((entry) => entry.label),
      datasets: [
        {
          data: props.clickType.map((entry) => entry.clicks),
          backgroundColor: ["#f87171", "#fb923c", "#60a5fa", "#22c55e", "#facc15", "#a78bfa"],
          borderWidth: 0
        }
      ]
    }),
    [props.clickType]
  );

  const uniqueSplitData = useMemo(
    () => ({
      labels: [copy.uniqueHuman, copy.nonUniqueHuman],
      datasets: [
        {
          data: [props.overview.uniqueClicks, props.overview.nonUniqueClicks],
          backgroundColor: ["#22c55e", "#f97316"],
          borderWidth: 0
        }
      ]
    }),
    [copy.nonUniqueHuman, copy.uniqueHuman, props.overview.nonUniqueClicks, props.overview.uniqueClicks]
  );

  return (
    <section className="rb-report-grid">
      <article className="rb-panel rb-overview-card">
        <header className="rb-overview-header">
          <div>
            <h2>{copy.overallPerformance}</h2>
            <p className="rb-muted">{copy.trackClicks}</p>
          </div>
          <div className="rb-time-toggle">
            <button
              type="button"
              className={granularity === "hours" ? "active" : ""}
              onClick={() => setGranularity("hours")}
            >
              {copy.hours}
            </button>
            <button type="button" className={granularity === "days" ? "active" : ""} onClick={() => setGranularity("days")}>
              {copy.days}
            </button>
            <button
              type="button"
              className={granularity === "months" ? "active" : ""}
              onClick={() => setGranularity("months")}
            >
              {copy.months}
            </button>
          </div>
        </header>
        <div className="rb-overview-metrics">
          <article>
            <span>{copy.totalClicks}</span>
            <strong>{formatNumber(props.overview.totalClicks, props.lang)}</strong>
          </article>
          <article>
            <span>{copy.qrScans}</span>
            <strong>{formatNumber(props.overview.qrScans, props.lang)}</strong>
          </article>
          <article>
            <span>{copy.clicksToday}</span>
            <strong>{formatNumber(props.overview.clicksToday, props.lang)}</strong>
          </article>
          <article>
            <span>{copy.lastClick}</span>
            <strong>{formatLastClick(props.overview.lastClickAt, props.lang)}</strong>
          </article>
        </div>
        <div className="rb-chart-box rb-chart-box-lg">
          <Line
            data={performanceData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  ticks: { color: "#9ca3af" },
                  grid: { color: "rgba(156,163,175,0.15)" }
                },
                y: {
                  ticks: { color: "#9ca3af" },
                  grid: { color: "rgba(156,163,175,0.1)" }
                }
              }
            }}
          />
        </div>
      </article>

      <article className="rb-panel rb-analytics-card rb-geo-card">
        <h3>{copy.geoDistribution}</h3>
        <WorldHeatMap data={props.worldMap} lang={props.lang} />
      </article>

      <ListCard title={copy.topCities} data={props.topCities} lang={props.lang} />
      <ListCard title={copy.topRegions} data={props.topRegions} lang={props.lang} />
      <ListCard title={copy.topDays} data={props.topDays} lang={props.lang} />
      <ListCard title={copy.popularHours} data={popularHours24} lang={props.lang} />

      <article className="rb-panel rb-analytics-card">
        <h3>{copy.clickType}</h3>
        <div className="rb-click-type-chart">
          <div className="rb-chart-box rb-chart-box-sm">
            <Doughnut
              data={clickTypeData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: "#d1d5db"
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </article>

      <article className="rb-panel rb-analytics-card">
        <h3>{copy.uniqueSplit}</h3>
        <div className="rb-click-type-chart">
          <div className="rb-chart-box rb-chart-box-sm">
            <Doughnut
              data={uniqueSplitData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: {
                      color: "#d1d5db"
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </article>

      <ListCard title={copy.topSocial} data={props.topSocialPlatforms} lang={props.lang} />
      <ListCard title={copy.topSources} data={props.topSources} lang={props.lang} />
      <ListCard title={copy.topBrowsers} data={props.topBrowsers} lang={props.lang} />
      <ListCard title={copy.topDevices} data={props.topDevices} lang={props.lang} />
      <ListCard title={copy.topLanguages} data={props.topLanguages} lang={props.lang} />
      <ListCard title={copy.topPlatforms} data={props.topPlatforms} lang={props.lang} />
    </section>
  );
}

function LegacyCharts(props: LegacyChartsProps) {
  const [range, setRange] = useState<7 | 30>(30);
  const daily = range === 7 ? props.daily7 : props.daily30;

  const dailyData = useMemo(
    () => ({
      labels: daily.map((point) => point.day.slice(5)),
      datasets: [
        {
          label: `Clicks (${range}d)`,
          data: daily.map((point) => point.clicks),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.2)",
          fill: true,
          tension: 0.3
        }
      ]
    }),
    [daily, range]
  );

  const hourlyData = useMemo(
    () => ({
      labels: props.hourly.map((point) => normalizeHourLabel24(point.hour)),
      datasets: [
        {
          label: "Clicks by hour",
          data: props.hourly.map((point) => point.clicks),
          backgroundColor: "#f97316"
        }
      ]
    }),
    [props.hourly]
  );

  const deviceData = useMemo(
    () => ({
      labels: props.topDevices.map((item) => item.label),
      datasets: [
        {
          data: props.topDevices.map((item) => item.clicks),
          backgroundColor: ["#ef4444", "#f59e0b", "#2563eb", "#1f2937", "#6b7280"]
        }
      ]
    }),
    [props.topDevices]
  );

  return (
    <section className="charts-grid">
      <article className="card">
        <div className="chart-header">
          <h3>Daily clicks</h3>
          <div className="toggle-group">
            <button type="button" className={range === 7 ? "toggle active" : "toggle"} onClick={() => setRange(7)}>
              7d
            </button>
            <button type="button" className={range === 30 ? "toggle active" : "toggle"} onClick={() => setRange(30)}>
              30d
            </button>
          </div>
        </div>
        <Line data={dailyData} />
      </article>

      <article className="card">
        <h3>Hourly clicks (last 30d)</h3>
        <Bar data={hourlyData} />
      </article>

      <article className="card">
        <h3>Top devices</h3>
        <Doughnut data={deviceData} />
      </article>

      <article className="card">
        <h3>Top countries</h3>
        <ul className="rb-stat-list">
          {props.topCountries.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.clicks}</strong>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

export default function AdminCharts(props: AdminChartsProps) {
  if (props.mode === "rebrandly") {
    return <RebrandlyCharts {...props} />;
  }
  return <LegacyCharts {...props} />;
}
