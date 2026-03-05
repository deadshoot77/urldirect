"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AdminCharts from "@/components/admin-charts";
import AdminLanguageToggle from "@/components/admin-language-toggle";
import TopToast, { type TopToastKind, type TopToastState } from "@/components/top-toast";
import type { LinkAnalyticsData } from "@/lib/links";
import { ADMIN_LANG_STORAGE_KEY, normalizeAdminLang, type AdminLang } from "@/lib/i18n";
import type { DeepLinksConfig, LandingMode, RoutingRule, ShortLink } from "@/lib/types";

interface LinkDetailPageClientProps {
  initialLink: ShortLink;
  initialAnalytics: LinkAnalyticsData;
}

const words = {
  fr: {
    backToLinks: "Retour aux liens",
    detailSubtitle: "Detail du lien et rapport analytique",
    languageToggleAria: "Basculer la langue",
    copyShortLink: "Copier le lien court",
    optimize: "Optimiser",
    utmBuilder: "Constructeur UTM",
    utmSource: "UTM Source",
    utmMedium: "UTM Medium",
    utmCampaign: "UTM Campaign",
    utmContent: "UTM Content",
    utmTerm: "UTM Term",
    applyDestination: "Appliquer a la destination",
    copyUrl: "Copier l'URL",
    trafficRouting: "Routage du trafic",
    routingHint: "Configurez un tableau JSON avec `devices`, `countries`, `languages` et `destination_url`.",
    saveRouting: "Sauvegarder les regles",
    deepLinks: "Deep links",
    iosLink: "Lien iOS",
    androidLink: "Lien Android",
    fallbackUrl: "URL de secours",
    saveDeepLinks: "Sauvegarder deep links",
    retargetingScripts: "Scripts de retargeting",
    retargetingHint: "Tableau JSON. Exemple: type inline/external/pixel, avec content ou src.",
    saveScripts: "Sauvegarder les scripts",
    landingSettings: "Landing TikTok",
    landingMode: "Mode landing",
    landingModeInherit: "Heriter du global",
    landingModeOn: "Activee",
    landingModeOff: "Desactivee",
    backgroundUrl: "Image de fond (override)",
    saveLanding: "Sauvegarder landing",
    report: "Rapport",
    linkPreview: "Apercu du lien",
    openDestination: "Ouvrir la destination",
    qrCode: "QR Code",
    download: "Telecharger",
    copyImageUrl: "Copier URL image",
    deleteLink: "Supprimer le lien",
    deletingLink: "Suppression...",
    confirmDelete: "Supprimer ce lien ? Le slug ne sera plus actif.",
    bestShareTime: "Meilleur moment pour partager ce lien",
    notEnoughData: "Pas assez de donnees.",
    shareWith: "Partager avec",
    saved: "Sauvegarde effectuee",
    failedSave: "Echec de sauvegarde",
    copiedClipboard: "Copie dans le presse-papiers",
    invalidRoutingJson: "JSON de routage invalide",
    invalidRetargetingJson: "JSON de retargeting invalide",
    visits: "Visites",
    landingViews: "Vues landing",
    humanClicks: "Clics humains",
    redirects: "Redirections (humains)",
    botHits: "Bots",
    prefetchHits: "Prefetch",
    uniqueHumanRedirects: "Uniques (humains)",
    nonUniqueHumanRedirects: "Non-uniques (humains)"
  },
  en: {
    backToLinks: "Back to Links",
    detailSubtitle: "Link detail and analytics report",
    languageToggleAria: "Toggle language",
    copyShortLink: "Copy short link",
    optimize: "Optimize",
    utmBuilder: "UTM Builder",
    utmSource: "UTM Source",
    utmMedium: "UTM Medium",
    utmCampaign: "UTM Campaign",
    utmContent: "UTM Content",
    utmTerm: "UTM Term",
    applyDestination: "Apply to destination",
    copyUrl: "Copy URL",
    trafficRouting: "Traffic routing",
    routingHint: "Configure JSON array with `devices`, `countries`, `languages` and `destination_url`.",
    saveRouting: "Save routing rules",
    deepLinks: "Deep links",
    iosLink: "iOS app link",
    androidLink: "Android app link",
    fallbackUrl: "Fallback web URL",
    saveDeepLinks: "Save deep links",
    retargetingScripts: "Retargeting scripts",
    retargetingHint: "JSON array. Example: type inline/external/pixel, plus content or src.",
    saveScripts: "Save scripts",
    landingSettings: "TikTok landing",
    landingMode: "Landing mode",
    landingModeInherit: "Inherit global",
    landingModeOn: "Enabled",
    landingModeOff: "Disabled",
    backgroundUrl: "Background image (override)",
    saveLanding: "Save landing",
    report: "Report",
    linkPreview: "Link preview",
    openDestination: "Open destination",
    qrCode: "QR Code",
    download: "Download",
    copyImageUrl: "Copy image URL",
    deleteLink: "Delete link",
    deletingLink: "Deleting...",
    confirmDelete: "Delete this link? The slug will no longer be active.",
    bestShareTime: "Best time to share your link",
    notEnoughData: "Not enough data yet.",
    shareWith: "Share with",
    saved: "Saved",
    failedSave: "Failed to save",
    copiedClipboard: "Copied to clipboard",
    invalidRoutingJson: "Invalid routing rules JSON",
    invalidRetargetingJson: "Invalid retargeting JSON",
    visits: "Visits",
    landingViews: "Landing views",
    humanClicks: "Human clicks",
    redirects: "Redirects (human)",
    botHits: "Bots",
    prefetchHits: "Prefetch",
    uniqueHumanRedirects: "Unique (human)",
    nonUniqueHumanRedirects: "Non-unique (human)"
  }
} as const;

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[]";
  }
}

function parseJsonArray<T>(value: string): T[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array");
  }
  return parsed as T[];
}

function buildUtmUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function getTopShareHours(hours: Array<{ label: string; clicks: number }>): string[] {
  return [...hours]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 3)
    .map((entry) => normalizeHourLabel24(entry.label));
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

function toErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as { error?: string; issues?: Array<{ message?: string }> };
  if (Array.isArray(candidate.issues) && candidate.issues.length > 0 && candidate.issues[0]?.message) {
    return candidate.issues[0].message;
  }
  return candidate.error ?? fallback;
}

export default function LinkDetailPageClient({ initialLink, initialAnalytics }: LinkDetailPageClientProps) {
  const router = useRouter();
  const [link, setLink] = useState<ShortLink>(initialLink);
  const [analytics] = useState<LinkAnalyticsData>(initialAnalytics);
  const [toast, setToast] = useState<TopToastState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lang, setLang] = useState<AdminLang>("fr");
  const [routingRulesJson, setRoutingRulesJson] = useState(() => toPrettyJson(link.routingRules));
  const [retargetingJson, setRetargetingJson] = useState(() => toPrettyJson(link.retargetingScripts));
  const [deepLinks, setDeepLinks] = useState<DeepLinksConfig>(link.deepLinks ?? {});
  const [landingMode, setLandingMode] = useState<LandingMode>(link.landingMode ?? "inherit");
  const [backgroundUrl, setBackgroundUrl] = useState(link.backgroundUrl ?? "");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = normalizeAdminLang(window.localStorage.getItem(ADMIN_LANG_STORAGE_KEY));
    setLang(stored);
  }, []);

  useEffect(() => {
    setLandingMode(link.landingMode ?? "inherit");
    setBackgroundUrl(link.backgroundUrl ?? "");
  }, [link.backgroundUrl, link.landingMode]);

  const copy = words[lang];
  const shortUrl = `${origin}/${link.slug}`;

  const qrUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(shortUrl)}`;
  }, [shortUrl]);

  const utmPreview = useMemo(() => {
    try {
      return buildUtmUrl(link.destinationUrl, {
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_content: utmContent,
        utm_term: utmTerm
      });
    } catch {
      return link.destinationUrl;
    }
  }, [link.destinationUrl, utmCampaign, utmContent, utmMedium, utmSource, utmTerm]);

  const bestHours = useMemo(() => getTopShareHours(analytics.popularHours), [analytics.popularHours]);

  function showToast(message: string, kind: TopToastKind = "info") {
    setToast({
      id: Date.now() + Math.floor(Math.random() * 1000),
      message,
      kind
    });
  }

  function setLanguage(nextLang: AdminLang) {
    setLang(nextLang);
    window.localStorage.setItem(ADMIN_LANG_STORAGE_KEY, nextLang);
  }

  async function savePatch(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/links/${encodeURIComponent(link.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const body = (await response.json().catch(() => null)) as { link?: ShortLink; error?: string } | null;
      if (!response.ok || !body?.link) {
        throw new Error(toErrorMessage(body, copy.failedSave));
      }
      setLink(body.link);
      showToast(copy.saved, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failedSave, "error");
    } finally {
      setSaving(false);
    }
  }

  async function onApplyUtm() {
    await savePatch({
      destination_url: utmPreview
    });
  }

  async function onSaveRoutingRules() {
    try {
      const parsed = parseJsonArray<RoutingRule>(routingRulesJson);
      await savePatch({
        routing_rules: parsed
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.invalidRoutingJson, "error");
    }
  }

  async function onSaveDeepLinks() {
    await savePatch({
      deep_links: deepLinks
    });
  }

  async function onSaveRetargeting() {
    try {
      const parsed = parseJsonArray<Record<string, unknown>>(retargetingJson);
      await savePatch({
        retargeting_scripts: parsed
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.invalidRetargetingJson, "error");
    }
  }

  async function onSaveLanding() {
    await savePatch({
      landing_mode: landingMode,
      background_url: backgroundUrl.trim() || null
    });
  }

  async function onCopy(value: string) {
    await navigator.clipboard.writeText(value);
    showToast(copy.copiedClipboard, "success");
  }

  async function onDeleteLink() {
    if (!window.confirm(copy.confirmDelete)) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/links/${encodeURIComponent(link.id)}`, {
        method: "DELETE",
        credentials: "include"
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(toErrorMessage(body, copy.failedSave));
      }
      router.push("/admin/links");
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failedSave, "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="rb-page">
      <header className="rb-header">
        <div>
          <Link className="rb-back" href="/admin/links">
            ← {copy.backToLinks}
          </Link>
          <h1>/{link.slug}</h1>
          <p className="rb-muted">{copy.detailSubtitle}</p>
        </div>
        <div className="rb-header-actions">
          <AdminLanguageToggle lang={lang} onChange={setLanguage} ariaLabel={copy.languageToggleAria} />
          <button type="button" className="rb-primary" disabled={saving} onClick={() => void onCopy(shortUrl)}>
            {copy.copyShortLink}
          </button>
          <button type="button" className="rb-danger" disabled={deleting} onClick={() => void onDeleteLink()}>
            {deleting ? copy.deletingLink : copy.deleteLink}
          </button>
        </div>
      </header>
      <TopToast toast={toast} onDismiss={() => setToast(null)} />

      <section className="rb-link-detail-layout">
        <div className="rb-link-detail-main">
          <article className="rb-panel">
            <h2>{copy.optimize}</h2>

            <details open className="rb-accordion">
              <summary>{copy.utmBuilder}</summary>
              <div className="rb-form-grid">
                <label htmlFor="utm_source">
                  {copy.utmSource}
                  <input id="utm_source" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} />
                </label>
                <label htmlFor="utm_medium">
                  {copy.utmMedium}
                  <input id="utm_medium" value={utmMedium} onChange={(event) => setUtmMedium(event.target.value)} />
                </label>
                <label htmlFor="utm_campaign">
                  {copy.utmCampaign}
                  <input id="utm_campaign" value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} />
                </label>
                <label htmlFor="utm_content">
                  {copy.utmContent}
                  <input id="utm_content" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} />
                </label>
                <label htmlFor="utm_term">
                  {copy.utmTerm}
                  <input id="utm_term" value={utmTerm} onChange={(event) => setUtmTerm(event.target.value)} />
                </label>
              </div>
              <p className="rb-muted rb-url-preview">{utmPreview}</p>
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onApplyUtm()}>
                  {copy.applyDestination}
                </button>
                <button type="button" onClick={() => void onCopy(utmPreview)}>
                  {copy.copyUrl}
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>{copy.trafficRouting}</summary>
              <p className="rb-muted">{copy.routingHint}</p>
              <textarea
                className="rb-code-area"
                value={routingRulesJson}
                onChange={(event) => setRoutingRulesJson(event.target.value)}
              />
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveRoutingRules()}>
                  {copy.saveRouting}
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>{copy.deepLinks}</summary>
              <div className="rb-form-grid">
                <label htmlFor="deep_ios">
                  {copy.iosLink}
                  <input
                    id="deep_ios"
                    value={deepLinks.ios_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, ios_url: event.target.value }))}
                  />
                </label>
                <label htmlFor="deep_android">
                  {copy.androidLink}
                  <input
                    id="deep_android"
                    value={deepLinks.android_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, android_url: event.target.value }))}
                  />
                </label>
                <label htmlFor="deep_fallback">
                  {copy.fallbackUrl}
                  <input
                    id="deep_fallback"
                    value={deepLinks.fallback_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, fallback_url: event.target.value }))}
                  />
                </label>
              </div>
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveDeepLinks()}>
                  {copy.saveDeepLinks}
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>{copy.retargetingScripts}</summary>
              <p className="rb-muted">{copy.retargetingHint}</p>
              <textarea
                className="rb-code-area"
                value={retargetingJson}
                onChange={(event) => setRetargetingJson(event.target.value)}
              />
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveRetargeting()}>
                  {copy.saveScripts}
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>{copy.landingSettings}</summary>
              <div className="rb-form-grid">
                <label htmlFor="landing_mode">
                  {copy.landingMode}
                  <select id="landing_mode" value={landingMode} onChange={(event) => setLandingMode(event.target.value as LandingMode)}>
                    <option value="inherit">{copy.landingModeInherit}</option>
                    <option value="on">{copy.landingModeOn}</option>
                    <option value="off">{copy.landingModeOff}</option>
                  </select>
                </label>
                <label htmlFor="landing_background_url">
                  {copy.backgroundUrl}
                  <input
                    id="landing_background_url"
                    type="url"
                    value={backgroundUrl}
                    placeholder="https://..."
                    onChange={(event) => setBackgroundUrl(event.target.value)}
                  />
                </label>
              </div>
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveLanding()}>
                  {copy.saveLanding}
                </button>
              </div>
            </details>
          </article>

          <section className="rb-panel">
            <h2>{copy.report}</h2>
            <AdminCharts
              mode="rebrandly"
              lang={lang}
              overview={analytics.overview}
              timeseries={analytics.timeseries}
              worldMap={analytics.worldMap}
              topCities={analytics.topCities}
              topRegions={analytics.topRegions}
              topDays={analytics.topDays}
              popularHours={analytics.popularHours}
              clickType={analytics.clickType}
              topSocialPlatforms={analytics.topSocialPlatforms}
              topSources={analytics.topSources}
              topBrowsers={analytics.topBrowsers}
              topDevices={analytics.topDevices}
              topLanguages={analytics.topLanguages}
              topPlatforms={analytics.topPlatforms}
            />
          </section>
        </div>

        <aside className="rb-link-detail-side">
          <article className="rb-panel">
            <h3>{copy.linkPreview}</h3>
            <p className="rb-link-preview-short">{shortUrl}</p>
            <p className="rb-muted">{link.destinationUrl}</p>
            <a href={link.destinationUrl} target="_blank" rel="noreferrer">
              {copy.openDestination}
            </a>
          </article>

          <article className="rb-panel">
            <h3>{copy.qrCode}</h3>
            <img src={qrUrl} alt={`QR code for ${shortUrl}`} className="rb-qr-image" />
            <div className="rb-actions">
              <a href={qrUrl} download={`qr-${link.slug}.png`}>
                {copy.download}
              </a>
              <button type="button" onClick={() => void onCopy(qrUrl)}>
                {copy.copyImageUrl}
              </button>
            </div>
          </article>

          <article className="rb-panel">
            <h3>{copy.bestShareTime}</h3>
            {bestHours.length === 0 ? (
              <p className="rb-muted">{copy.notEnoughData}</p>
            ) : (
              <ul className="rb-best-hours">
                {bestHours.map((hour) => (
                  <li key={hour}>{hour}</li>
                ))}
              </ul>
            )}
          </article>

          <article className="rb-panel">
            <h3>Funnel</h3>
            <ul className="rb-geo-list">
              <li>
                <span>{copy.visits}</span>
                <strong>{analytics.overview.visits}</strong>
              </li>
              <li>
                <span>{copy.landingViews}</span>
                <strong>{analytics.overview.landingViews}</strong>
              </li>
              <li>
                <span>{copy.humanClicks}</span>
                <strong>{analytics.overview.humanClicks}</strong>
              </li>
              <li>
                <span>{copy.redirects}</span>
                <strong>{analytics.overview.redirects}</strong>
              </li>
              <li>
                <span>{copy.uniqueHumanRedirects}</span>
                <strong>{analytics.overview.uniqueClicks}</strong>
              </li>
              <li>
                <span>{copy.nonUniqueHumanRedirects}</span>
                <strong>{analytics.overview.nonUniqueClicks}</strong>
              </li>
              <li>
                <span>{copy.botHits}</span>
                <strong>{analytics.overview.botHits}</strong>
              </li>
              <li>
                <span>{copy.prefetchHits}</span>
                <strong>{analytics.overview.prefetchHits}</strong>
              </li>
            </ul>
          </article>

          <article className="rb-panel">
            <h3>{copy.shareWith}</h3>
            <div className="rb-share-grid">
              <button type="button">Facebook</button>
              <button type="button">Instagram</button>
              <button type="button">TikTok</button>
              <button type="button">X</button>
              <button type="button">LinkedIn</button>
              <button type="button">Email</button>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
