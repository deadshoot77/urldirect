"use client";

import { useMemo, useState } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
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
import type { AdminPlan, AnalyticsGranularity, LinkOverviewStats, TimeSeriesPoint } from "@/lib/types";

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
  plan: AdminPlan;
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

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatLastClick(value: string | null): string {
  if (!value) return "No data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function ListCard({
  title,
  data,
  locked,
  plan
}: {
  title: string;
  data: LabelCount[];
  locked?: boolean;
  plan: AdminPlan;
}) {
  const max = data[0]?.clicks ?? 0;
  const isLocked = Boolean(locked && plan === "free");

  return (
    <article className="rb-panel rb-analytics-card">
      <h3>{title}</h3>
      <div className={isLocked ? "rb-card-locked-content" : ""}>
        {data.length === 0 ? (
          <p className="rb-muted">No data yet.</p>
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
                  <strong>{formatNumber(item.clicks)}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {isLocked ? (
        <div className="rb-locked-overlay">
          <p>Available from Professional</p>
          <button type="button">Upgrade to reveal</button>
        </div>
      ) : null}
    </article>
  );
}

function RebrandlyCharts(props: RebrandlyChartsProps) {
  const [granularity, setGranularity] = useState<AnalyticsGranularity>("days");
  const activeSeries = granularity === "hours" ? props.timeseries.hours : granularity === "months" ? props.timeseries.months : props.timeseries.days;

  const performanceData = useMemo(
    () => ({
      labels: activeSeries.map((point) => point.label),
      datasets: [
        {
          label: "Clicks",
          data: activeSeries.map((point) => point.clicks),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.2)",
          fill: true,
          tension: 0.28,
          pointRadius: 2
        }
      ]
    }),
    [activeSeries]
  );

  const clickTypeData = useMemo(
    () => ({
      labels: props.clickType.map((entry) => entry.label),
      datasets: [
        {
          data: props.clickType.map((entry) => entry.clicks),
          backgroundColor: ["#f87171", "#374151"],
          borderWidth: 0
        }
      ]
    }),
    [props.clickType]
  );

  const countryBars = useMemo(
    () => ({
      labels: props.worldMap.slice(0, 8).map((entry) => entry.label),
      datasets: [
        {
          label: "Clicks",
          data: props.worldMap.slice(0, 8).map((entry) => entry.clicks),
          backgroundColor: "#f97316"
        }
      ]
    }),
    [props.worldMap]
  );

  return (
    <section className="rb-report-grid">
      <article className="rb-panel rb-overview-card">
        <header className="rb-overview-header">
          <div>
            <h2>Overall performance</h2>
            <p className="rb-muted">Track clicks by time range</p>
          </div>
          <div className="rb-time-toggle">
            <button
              type="button"
              className={granularity === "hours" ? "active" : ""}
              onClick={() => setGranularity("hours")}
            >
              Hours
            </button>
            <button type="button" className={granularity === "days" ? "active" : ""} onClick={() => setGranularity("days")}>
              Days
            </button>
            <button
              type="button"
              className={granularity === "months" ? "active" : ""}
              onClick={() => setGranularity("months")}
            >
              Months
            </button>
          </div>
        </header>
        <div className="rb-overview-metrics">
          <article>
            <span>Total clicks</span>
            <strong>{formatNumber(props.overview.totalClicks)}</strong>
          </article>
          <article>
            <span>QR scans</span>
            <strong>{formatNumber(props.overview.qrScans)}</strong>
          </article>
          <article>
            <span>Clicks today</span>
            <strong>{formatNumber(props.overview.clicksToday)}</strong>
          </article>
          <article>
            <span>Last click</span>
            <strong>{formatLastClick(props.overview.lastClickAt)}</strong>
          </article>
        </div>
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
      </article>

      <article className="rb-panel rb-analytics-card">
        <h3>World map</h3>
        <div className="rb-world-map">
          <svg viewBox="0 0 500 220" aria-hidden="true">
            <path d="M38 97l44-34 52 13 18 29-31 31-39 8-44-16z" />
            <path d="M178 72l47-27 51 14 18 25-19 31-65 12-31-17z" />
            <path d="M301 83l62-22 54 19 7 25-31 24-49 9-49-13z" />
            <path d="M190 146l34-11 40 16 12 25-31 19-43-9-15-24z" />
            <path d="M332 147l38-10 42 16 11 27-28 19-47-8-17-23z" />
          </svg>
          <div>
            <Bar
              data={countryBars}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { color: "#9ca3af" }, grid: { display: false } },
                  y: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(156,163,175,0.12)" } }
                }
              }}
            />
          </div>
        </div>
      </article>

      <ListCard title="Top cities" data={props.topCities} plan={props.plan} />
      <ListCard title="Top regions" data={props.topRegions} plan={props.plan} />
      <ListCard title="Top days" data={props.topDays} plan={props.plan} />
      <ListCard title="Most popular hours" data={props.popularHours} plan={props.plan} />

      <article className="rb-panel rb-analytics-card">
        <h3>Click type</h3>
        <div className="rb-click-type-chart">
          <Doughnut
            data={clickTypeData}
            options={{
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
      </article>

      <ListCard title="Top social media platforms" data={props.topSocialPlatforms} plan={props.plan} locked />
      <ListCard title="Top sources" data={props.topSources} plan={props.plan} />
      <ListCard title="Top browsers" data={props.topBrowsers} plan={props.plan} />
      <ListCard title="Top devices" data={props.topDevices} plan={props.plan} />
      <ListCard title="Top languages" data={props.topLanguages} plan={props.plan} locked />
      <ListCard title="Top platforms" data={props.topPlatforms} plan={props.plan} locked />
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
      labels: props.hourly.map((point) => point.hour),
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
              <strong>{formatNumber(item.clicks)}</strong>
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
