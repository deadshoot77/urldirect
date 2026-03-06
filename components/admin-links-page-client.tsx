"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminCharts from "@/components/admin-charts";
import AdminLanguageToggle from "@/components/admin-language-toggle";
import LogoutButton from "@/components/logout-button";
import TopToast, { type TopToastKind, type TopToastState } from "@/components/top-toast";
import type { AnalyticsRange, GlobalAnalyticsData, LinkAnalyticsData, PaginatedShortLinks } from "@/lib/links";
import { ADMIN_LANG_STORAGE_KEY, normalizeAdminLang, type AdminLang } from "@/lib/i18n";
import type { AdminSettings } from "@/lib/types";

interface AdminLinksPageClientProps {
  initialLinks: PaginatedShortLinks;
  initialGlobalAnalytics: GlobalAnalyticsData;
  initialGlobalAnalyticsLoaded: boolean;
  initialSettings: AdminSettings;
}

type ViewMode = "list" | "grid";
type AdminSection = "links" | "analytics" | "settings";

interface NewLinkFormState {
  slug: string;
  destination_url: string;
  tags: string;
  redirect_type: 301 | 302;
}

const words = {
  fr: {
    admin: "Admin",
    linksTitle: "Liens",
    languageToggleAria: "Basculer la langue",
    logout: "Se deconnecter",
    signingOut: "Deconnexion...",
    tabsAria: "Sections de la page",
    linksTab: "Links",
    analyticsTab: "Analytics",
    settingsTab: "Parametres",
    globalStatsTitle: "Statistiques globales (tous les liens)",
    totalLinks: "Liens actifs",
    totalClicks: "Redirections (humains)",
    clicksToday: "Clics aujourd'hui",
    uniqueClicks: "Clics uniques",
    clicksLast7Days: "Clics (7 jours)",
    topLinks: "Top liens",
    topCountries: "Top pays",
    topSources: "Top sources",
    trackingSettings: "Parametres tracking & landing",
    trackingEnabled: "Tracking actif",
    trackingDisabledHint: "Tracking desactive: active-le dans les parametres pour recommencer a compter.",
    landingEnabled: "Landing TikTok active (globale)",
    globalBackground: "Image de fond globale",
    saveSettings: "Sauvegarder parametres",
    savingSettings: "Sauvegarde...",
    visits: "Visites",
    landingViews: "Vues landing",
    humanClicks: "Clics humains",
    redirects: "Redirections (humains)",
    botHits: "Bots",
    prefetchHits: "Prefetch",
    noData: "Pas de donnees",
    loadingAnalytics: "Chargement analytics...",
    loadingTitle: "Chargement",
    rangeLabel: "Periode",
    rangeToday: "Aujourd'hui",
    rangeThisWeek: "Cette semaine",
    rangeLastWeek: "Semaine derniere",
    rangeThisMonth: "Mois actuel",
    rangeClicks: "Redirections (periode)",
    sort: "Trier",
    latest: "Recents",
    oldest: "Anciens",
    mostClicks: "Plus de clics",
    list: "Liste",
    grid: "Grille",
    newLink: "Nouveau lien",
    createTitle: "Creer un nouveau lien",
    slug: "Slug",
    destinationUrl: "URL de destination",
    tags: "Tags",
    redirectType: "Type de redirection",
    createLink: "Creer le lien",
    creating: "Creation...",
    cancel: "Annuler",
    saved: "Sauvegarde effectuee",
    deletedLink: "Lien supprime",
    failedSave: "Echec de sauvegarde",
    refreshLinks: "Actualisation...",
    tableLinkTitle: "Titre du lien",
    tableDestinationUrl: "URL de destination",
    tableClicksReceived: "Redirects (humains)",
    tableCreationDate: "Date de creation",
    tableActions: "Actions",
    noLinksYet: "Aucun lien pour le moment.",
    showStats: "Voir stats",
    hideStats: "Masquer stats",
    loadingStats: "Chargement des stats...",
    linkStatsTitle: "Stats du lien",
    copy: "Copier",
    deleteLink: "Supprimer",
    deletingLink: "Suppression...",
    confirmDelete: "Supprimer ce lien ? Le slug ne sera plus actif.",
    failedDelete: "Echec suppression",
    open: "Ouvrir",
    previous: "Precedent",
    next: "Suivant",
    page: "Page",
    copiedPrefix: "Copie",
    never: "Jamais",
    clicks: "redirections humaines",
    zeroStatsHint: "Stats a 0: verifie tracking actif + migration SQL a jour (db/migrations.sql)."
  },
  en: {
    admin: "Admin",
    linksTitle: "Links",
    languageToggleAria: "Toggle language",
    logout: "Logout",
    signingOut: "Signing out...",
    tabsAria: "Page sections",
    linksTab: "Links",
    analyticsTab: "Analytics",
    settingsTab: "Settings",
    globalStatsTitle: "Global Stats (all links)",
    totalLinks: "Active links",
    totalClicks: "Redirects (human)",
    clicksToday: "Clicks today",
    uniqueClicks: "Unique clicks",
    clicksLast7Days: "Clicks (7 days)",
    topLinks: "Top links",
    topCountries: "Top countries",
    topSources: "Top sources",
    trackingSettings: "Tracking & landing settings",
    trackingEnabled: "Tracking enabled",
    trackingDisabledHint: "Tracking is disabled: enable it in settings to start counting again.",
    landingEnabled: "TikTok landing enabled (global)",
    globalBackground: "Global background image",
    saveSettings: "Save settings",
    savingSettings: "Saving...",
    visits: "Visits",
    landingViews: "Landing views",
    humanClicks: "Human clicks",
    redirects: "Redirects (human)",
    botHits: "Bots",
    prefetchHits: "Prefetch",
    noData: "No data",
    loadingAnalytics: "Loading analytics...",
    loadingTitle: "Loading",
    rangeLabel: "Range",
    rangeToday: "Today",
    rangeThisWeek: "This week",
    rangeLastWeek: "Last week",
    rangeThisMonth: "Current month",
    rangeClicks: "Redirects (range)",
    sort: "Sort",
    latest: "Latest",
    oldest: "Oldest",
    mostClicks: "Most clicks",
    list: "List",
    grid: "Grid",
    newLink: "New link",
    createTitle: "Create new link",
    slug: "Slug",
    destinationUrl: "Destination URL",
    tags: "Tags",
    redirectType: "Redirect type",
    createLink: "Create link",
    creating: "Creating...",
    cancel: "Cancel",
    saved: "Saved",
    deletedLink: "Link deleted",
    failedSave: "Failed to save",
    refreshLinks: "Refreshing links...",
    tableLinkTitle: "Link title",
    tableDestinationUrl: "Destination URL",
    tableClicksReceived: "Redirects (human)",
    tableCreationDate: "Creation date",
    tableActions: "Actions",
    noLinksYet: "No links yet.",
    showStats: "View stats",
    hideStats: "Hide stats",
    loadingStats: "Loading stats...",
    linkStatsTitle: "Link stats",
    copy: "Copy",
    deleteLink: "Delete",
    deletingLink: "Deleting...",
    confirmDelete: "Delete this link? The slug will no longer be active.",
    failedDelete: "Delete failed",
    open: "Open",
    previous: "Previous",
    next: "Next",
    page: "Page",
    copiedPrefix: "Copied",
    never: "Never",
    clicks: "human redirects",
    zeroStatsHint: "Zero stats: verify tracking enabled and latest SQL migration applied (db/migrations.sql)."
  }
} as const;

function createDefaultFormState(): NewLinkFormState {
  return {
    slug: "",
    destination_url: "",
    tags: "",
    redirect_type: 302
  };
}

function toErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as { error?: string; issues?: Array<{ message?: string }> };
  if (Array.isArray(candidate.issues) && candidate.issues.length > 0) {
    const issue = candidate.issues[0]?.message;
    if (issue) return issue;
  }
  return candidate.error ?? fallback;
}

function formatDate(value: string | null, lang: AdminLang): string {
  if (!value) return words[lang].never;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

function formatNumber(value: number, lang: AdminLang): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-US").format(value);
}

function StatsList({
  title,
  items,
  lang
}: {
  title: string;
  items: Array<{ label: string; clicks: number }>;
  lang: AdminLang;
}) {
  return (
    <article className="rb-panel rb-analytics-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="rb-muted">{words[lang].noData}</p>
      ) : (
        <ul className="rb-stat-list">
          {items.map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{formatNumber(item.clicks, lang)}</strong>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function AdminLinksPageClient({
  initialLinks,
  initialGlobalAnalytics,
  initialGlobalAnalyticsLoaded,
  initialSettings
}: AdminLinksPageClientProps) {
  const [links, setLinks] = useState<PaginatedShortLinks>(initialLinks);
  const [globalAnalytics, setGlobalAnalytics] = useState<GlobalAnalyticsData>(initialGlobalAnalytics);
  const [globalAnalyticsLoaded, setGlobalAnalyticsLoaded] = useState(initialGlobalAnalyticsLoaded);
  const [settings, setSettings] = useState<AdminSettings>(initialSettings);
  const [linkAnalytics, setLinkAnalytics] = useState<Record<string, LinkAnalyticsData>>({});
  const [activeLinkStats, setActiveLinkStats] = useState<{
    id: string;
    slug: string;
  } | null>(null);
  const [loadingLinkStatsId, setLoadingLinkStatsId] = useState<string | null>(null);
  const [lang, setLang] = useState<AdminLang>("fr");
  const [activeSection, setActiveSection] = useState<AdminSection>("links");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(false);
  const [loadingAnalyticsData, setLoadingAnalyticsData] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNewLinkForm, setShowNewLinkForm] = useState(false);
  const [form, setForm] = useState<NewLinkFormState>(() => createDefaultFormState());
  const [toasts, setToasts] = useState<TopToastState[]>([]);
  const [origin, setOrigin] = useState("");
  const [clientTimeZone, setClientTimeZone] = useState("Europe/Paris");
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [globalBackgroundUrl, setGlobalBackgroundUrl] = useState(initialSettings.globalBackgroundUrl ?? "");
  const [loadingDots, setLoadingDots] = useState("");
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("today");
  const [loadedAnalyticsRange, setLoadedAnalyticsRange] = useState<AnalyticsRange | null>(
    initialGlobalAnalyticsLoaded ? "today" : null
  );
  const [analyticsPrefetchAttempted, setAnalyticsPrefetchAttempted] = useState(initialGlobalAnalyticsLoaded);

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = normalizeAdminLang(window.localStorage.getItem(ADMIN_LANG_STORAGE_KEY));
    setLang(stored);
    const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolvedTimeZone) {
      setClientTimeZone(resolvedTimeZone);
    }
  }, []);

  useEffect(() => {
    setGlobalBackgroundUrl(settings.globalBackgroundUrl ?? "");
  }, [settings.globalBackgroundUrl]);

  useEffect(() => {
    if (globalAnalyticsLoaded || analyticsPrefetchAttempted) {
      return;
    }
    setAnalyticsPrefetchAttempted(true);
    void refresh(links.page, { includeAnalytics: true, silent: true, analyticsRange });
  }, [analyticsPrefetchAttempted, globalAnalyticsLoaded]);

  useEffect(() => {
    if (activeSection !== "analytics" || loadingAnalyticsData) {
      return;
    }
    if (globalAnalyticsLoaded && loadedAnalyticsRange === analyticsRange) {
      return;
    }
    void refresh(links.page, { includeAnalytics: true, silent: globalAnalyticsLoaded, analyticsRange });
  }, [activeSection, analyticsRange, globalAnalyticsLoaded, loadedAnalyticsRange, loadingAnalyticsData, links.page]);

  useEffect(() => {
    if (activeSection !== "analytics" || globalAnalyticsLoaded) {
      setLoadingDots("");
      return;
    }
    const sequence = ["", ".", "..", "..."];
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % sequence.length;
      setLoadingDots(sequence[index]);
    }, 320);
    return () => window.clearInterval(timer);
  }, [activeSection, globalAnalyticsLoaded]);

  const copy = words[lang];
  const analyticsRangeOptions = useMemo(
    () => [
      { value: "today" as const, label: copy.rangeToday },
      { value: "this_week" as const, label: copy.rangeThisWeek },
      { value: "last_week" as const, label: copy.rangeLastWeek },
      { value: "this_month" as const, label: copy.rangeThisMonth }
    ],
    [copy.rangeLastWeek, copy.rangeThisMonth, copy.rangeThisWeek, copy.rangeToday]
  );

  const statsCards = useMemo(
    () => [
      { label: copy.totalLinks, value: globalAnalytics.totalLinks },
      { label: copy.rangeClicks, value: globalAnalytics.clicksLast7Days },
      { label: copy.redirects, value: globalAnalytics.overview.redirects },
      { label: copy.visits, value: globalAnalytics.overview.visits }
    ],
    [
      copy.rangeClicks,
      copy.redirects,
      copy.totalLinks,
      copy.visits,
      globalAnalytics.clicksLast7Days,
      globalAnalytics.overview.redirects,
      globalAnalytics.overview.visits,
      globalAnalytics.totalLinks
    ]
  );

  const funnelCards = useMemo(
    () => [
      { label: copy.visits, value: globalAnalytics.overview.visits },
      { label: copy.landingViews, value: globalAnalytics.overview.landingViews },
      { label: copy.humanClicks, value: globalAnalytics.overview.humanClicks },
      { label: copy.redirects, value: globalAnalytics.overview.redirects },
      { label: copy.botHits, value: globalAnalytics.overview.botHits },
      { label: copy.prefetchHits, value: globalAnalytics.overview.prefetchHits }
    ],
    [
      copy.botHits,
      copy.humanClicks,
      copy.landingViews,
      copy.prefetchHits,
      copy.redirects,
      copy.visits,
      globalAnalytics.overview.botHits,
      globalAnalytics.overview.humanClicks,
      globalAnalytics.overview.landingViews,
      globalAnalytics.overview.prefetchHits,
      globalAnalytics.overview.redirects,
      globalAnalytics.overview.visits
    ]
  );

  const totalTrackedEvents =
    globalAnalytics.overview.visits +
    globalAnalytics.overview.landingViews +
    globalAnalytics.overview.humanClicks +
    globalAnalytics.overview.redirects +
    globalAnalytics.overview.botHits +
    globalAnalytics.overview.prefetchHits;

  const activeLinkAnalytics = activeLinkStats ? linkAnalytics[activeLinkStats.id] : null;

  function showToast(message: string, kind: TopToastKind = "info") {
    setToasts((current) => {
      const next = [
        ...current,
        {
          id: Date.now() + Math.floor(Math.random() * 1000),
          message,
          kind
        }
      ];
      return next.slice(-5);
    });
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function setLanguage(nextLang: AdminLang) {
    setLang(nextLang);
    window.localStorage.setItem(ADMIN_LANG_STORAGE_KEY, nextLang);
  }

  async function refresh(
    nextPage = links.page,
    options?: { includeAnalytics?: boolean; silent?: boolean; analyticsRange?: AnalyticsRange }
  ) {
    const includeAnalytics = options?.includeAnalytics ?? false;
    const silent = options?.silent ?? false;
    const requestAnalyticsRange = options?.analyticsRange ?? analyticsRange;
    if (!silent) {
      setLoading(true);
    }
    if (includeAnalytics) {
      setLoadingAnalyticsData(true);
    }
    try {
      const timeZoneParam = encodeURIComponent(clientTimeZone);
      const response = await fetch(
        `/api/admin/links?page=${nextPage}&pageSize=${links.pageSize}&includeAnalytics=${includeAnalytics ? "1" : "0"}&tz=${timeZoneParam}&range=${requestAnalyticsRange}`,
        {
        cache: "no-store",
        credentials: "include"
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            links?: PaginatedShortLinks;
            globalAnalytics?: GlobalAnalyticsData;
            settings?: AdminSettings;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.links || !payload?.settings || (includeAnalytics && !payload?.globalAnalytics)) {
        throw new Error(toErrorMessage(payload, "Failed to refresh links"));
      }

      setLinks(payload.links);
      setSettings(payload.settings);
      if (payload.globalAnalytics) {
        setGlobalAnalytics(payload.globalAnalytics);
        setGlobalAnalyticsLoaded(true);
        setLoadedAnalyticsRange(requestAnalyticsRange);
      }
    } catch (error) {
      if (!silent) {
        showToast(error instanceof Error ? error.message : "Failed to refresh links", "error");
      } else {
        console.error("admin links analytics prefetch failed", error);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      if (includeAnalytics) {
        setLoadingAnalyticsData(false);
      }
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          tracking_enabled: settings.trackingEnabled,
          landing_enabled: settings.landingEnabled,
          global_background_url: globalBackgroundUrl.trim() || null
        })
      });

      const payload = (await response.json().catch(() => null)) as { settings?: AdminSettings; error?: string } | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(toErrorMessage(payload, "Failed to update settings"));
      }

      setSettings(payload.settings);
      showToast(copy.saved, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failedSave, "error");
    } finally {
      setSavingSettings(false);
    }
  }

  async function submitNewLink() {
    setCreating(true);
    try {
      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const response = await fetch("/api/admin/links", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          slug: form.slug,
          destination_url: form.destination_url,
          tags,
          redirect_type: form.redirect_type,
          is_favorite: false,
          is_active: true,
          routing_rules: [],
          deep_links: {},
          retargeting_scripts: [],
          landing_mode: "inherit",
          background_url: null
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to create link"));
      }

      setForm(createDefaultFormState());
      setShowNewLinkForm(false);
      await refresh(1, { includeAnalytics: false });
      showToast(copy.saved, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create link", "error");
    } finally {
      setCreating(false);
    }
  }

  async function toggleFavorite(linkId: string, isFavorite: boolean) {
    try {
      const response = await fetch(`/api/admin/links/${encodeURIComponent(linkId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          is_favorite: !isFavorite
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to update favorite"));
      }
      await refresh(links.page, { includeAnalytics: false });
      showToast(copy.saved, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update favorite", "error");
    }
  }

  async function toggleLinkStats(linkId: string, slug: string) {
    if (activeLinkStats?.id === linkId) {
      setActiveLinkStats(null);
      return;
    }

    setActiveLinkStats({ id: linkId, slug });
    if (linkAnalytics[linkId]) {
      return;
    }

    setLoadingLinkStatsId(linkId);
    try {
      const timeZoneParam = encodeURIComponent(clientTimeZone);
      const response = await fetch(`/api/admin/links/${encodeURIComponent(linkId)}?includeAnalytics=1&tz=${timeZoneParam}`, {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            analytics?: LinkAnalyticsData;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.analytics) {
        throw new Error(toErrorMessage(payload, "Failed to fetch link analytics"));
      }
      setLinkAnalytics((current) => ({
        ...current,
        [linkId]: payload.analytics as LinkAnalyticsData
      }));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to fetch link analytics", "error");
    } finally {
      setLoadingLinkStatsId((current) => (current === linkId ? null : current));
    }
  }

  async function copyLink(slug: string) {
    if (!origin) return;
    const full = `${origin}/${slug}`;
    await navigator.clipboard.writeText(full);
    showToast(`${copy.copiedPrefix}: ${full}`, "info");
  }

  async function deleteLink(linkId: string) {
    if (!window.confirm(copy.confirmDelete)) {
      return;
    }

    setDeletingLinkId(linkId);
    try {
      const response = await fetch(`/api/admin/links/${encodeURIComponent(linkId)}`, {
        method: "DELETE",
        credentials: "include"
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, copy.failedDelete));
      }

      if (activeLinkStats?.id === linkId) {
        setActiveLinkStats(null);
      }
      setLinkAnalytics((current) => {
        const next = { ...current };
        delete next[linkId];
        return next;
      });
      await refresh(links.page, { includeAnalytics: false });
      showToast(copy.deletedLink, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : copy.failedDelete, "error");
    } finally {
      setDeletingLinkId((current) => (current === linkId ? null : current));
    }
  }

  return (
    <main className="rb-page">
      <header className="rb-header">
        <div>
          <p className="rb-eyebrow">{copy.admin}</p>
          <h1>{copy.linksTitle}</h1>
        </div>
        <div className="rb-header-actions">
          <AdminLanguageToggle lang={lang} onChange={setLanguage} ariaLabel={copy.languageToggleAria} />
          <LogoutButton label={copy.logout} loadingLabel={copy.signingOut} />
        </div>
      </header>
      <TopToast toasts={toasts} onDismiss={dismissToast} durationMs={10_000} />

      <nav className="rb-section-tabs" aria-label={copy.tabsAria}>
        <button type="button" className={activeSection === "links" ? "active" : ""} onClick={() => setActiveSection("links")}>
          {copy.linksTab}
        </button>
        <button
          type="button"
          className={activeSection === "analytics" ? "active" : ""}
          onClick={() => setActiveSection("analytics")}
        >
          {copy.analyticsTab}
        </button>
        <button
          type="button"
          className={activeSection === "settings" ? "active" : ""}
          onClick={() => setActiveSection("settings")}
        >
          {copy.settingsTab}
        </button>
      </nav>

      {loading && !(activeSection === "analytics" && !globalAnalyticsLoaded) ? <p className="rb-feedback">{copy.refreshLinks}</p> : null}
      {!settings.trackingEnabled ? <p className="rb-feedback">{copy.trackingDisabledHint}</p> : null}
      {settings.trackingEnabled && globalAnalyticsLoaded && totalTrackedEvents === 0 ? (
        <p className="rb-feedback">{copy.zeroStatsHint}</p>
      ) : null}

      {activeSection === "analytics" ? (
        !globalAnalyticsLoaded ? (
          <section className="rb-panel rb-analytics-loading-screen" aria-live="polite" aria-busy="true">
            <div className="rb-analytics-loader">
              <div className="rb-loader-ring" aria-hidden="true" />
              <p className="rb-loader-title">
                {copy.loadingTitle}
                {loadingDots}
              </p>
              <div className="rb-loader-progress" role="progressbar" aria-label={copy.loadingAnalytics}>
                <span />
              </div>
            </div>
          </section>
        ) : (
          <section className="rb-panel">
            <div className="rb-overview-header">
              <div>
                <h2>{copy.globalStatsTitle}</h2>
              </div>
              <label htmlFor="analytics_range_select" className="rb-inline-control">
                <span>{copy.rangeLabel}</span>
                <select
                  id="analytics_range_select"
                  value={analyticsRange}
                  onChange={(event) => setAnalyticsRange(event.target.value as AnalyticsRange)}
                >
                  {analyticsRangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rb-global-metrics">
              {statsCards.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value, lang)}</strong>
                </article>
              ))}
            </div>
            <div className="rb-global-metrics">
              {funnelCards.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value, lang)}</strong>
                </article>
              ))}
            </div>
            <AdminCharts
              mode="rebrandly"
              lang={lang}
              overview={globalAnalytics.overview}
              timeseries={globalAnalytics.timeseries}
              worldMap={globalAnalytics.worldMap}
              topCities={globalAnalytics.topCities}
              topRegions={globalAnalytics.topRegions}
              topDays={globalAnalytics.topDays}
              popularHours={globalAnalytics.popularHours}
              clickType={globalAnalytics.clickType}
              topSocialPlatforms={globalAnalytics.topSocialPlatforms}
              topSources={globalAnalytics.topSources}
              topBrowsers={globalAnalytics.topBrowsers}
              topDevices={globalAnalytics.topDevices}
              topLanguages={globalAnalytics.topLanguages}
              topPlatforms={globalAnalytics.topPlatforms}
            />
            <div className="rb-report-grid rb-global-lists">
              <StatsList title={copy.topLinks} items={globalAnalytics.topLinks} lang={lang} />
            </div>
          </section>
        )
      ) : activeSection === "settings" ? (
        <section className="rb-panel">
          <h2>{copy.trackingSettings}</h2>
          <div className="rb-form-grid">
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={settings.trackingEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    trackingEnabled: event.target.checked
                  }))
                }
              />
              <span>{copy.trackingEnabled}</span>
            </label>
            <label className="inline-checkbox">
              <input
                type="checkbox"
                checked={settings.landingEnabled}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    landingEnabled: event.target.checked
                  }))
                }
              />
              <span>{copy.landingEnabled}</span>
            </label>
            <label htmlFor="global_background_url">
              {copy.globalBackground}
              <input
                id="global_background_url"
                type="url"
                value={globalBackgroundUrl}
                placeholder="https://..."
                onChange={(event) => setGlobalBackgroundUrl(event.target.value)}
              />
            </label>
          </div>
          <div className="rb-actions">
            <button type="button" className="rb-primary" disabled={savingSettings} onClick={() => void saveSettings()}>
              {savingSettings ? copy.savingSettings : copy.saveSettings}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="rb-toolbar">
            <div className="rb-toolbar-left">
              <label htmlFor="sort_select">
                {copy.sort}
                <select id="sort_select" defaultValue="latest">
                  <option value="latest">{copy.latest}</option>
                  <option value="oldest">{copy.oldest}</option>
                  <option value="clicks">{copy.mostClicks}</option>
                </select>
              </label>
            </div>
            <div className="rb-toolbar-right">
              <div className="rb-view-toggle">
                <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
                  {copy.list}
                </button>
                <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
                  {copy.grid}
                </button>
              </div>
              <button type="button" className="rb-primary" onClick={() => setShowNewLinkForm((value) => !value)}>
                {copy.newLink}
              </button>
            </div>
          </section>

          {showNewLinkForm ? (
            <section className="rb-panel">
              <h2>{copy.createTitle}</h2>
              <div className="rb-form-grid">
                <label htmlFor="new_slug">
                  {copy.slug}
                  <input
                    id="new_slug"
                    value={form.slug}
                    onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                    placeholder="offer-2026"
                  />
                </label>
                <label htmlFor="new_destination">
                  {copy.destinationUrl}
                  <input
                    id="new_destination"
                    type="url"
                    value={form.destination_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, destination_url: event.target.value }))}
                    placeholder="https://example.com/landing"
                  />
                </label>
                <label htmlFor="new_tags">
                  {copy.tags}
                  <input
                    id="new_tags"
                    value={form.tags}
                    onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                    placeholder="campaign,spring"
                  />
                </label>
                <label htmlFor="new_redirect_type">
                  {copy.redirectType}
                  <select
                    id="new_redirect_type"
                    value={form.redirect_type}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        redirect_type: Number(event.target.value) as 301 | 302
                      }))
                    }
                  >
                    <option value={302}>302</option>
                    <option value={301}>301</option>
                  </select>
                </label>
              </div>
              <div className="rb-form-actions">
                <button type="button" className="rb-primary" disabled={creating} onClick={() => void submitNewLink()}>
                  {creating ? copy.creating : copy.createLink}
                </button>
                <button type="button" onClick={() => setShowNewLinkForm(false)}>
                  {copy.cancel}
                </button>
              </div>
            </section>
          ) : null}

          {viewMode === "list" ? (
            <section className="rb-panel">
              <table className="rb-table">
                <thead>
                  <tr>
                    <th>{copy.tableLinkTitle}</th>
                    <th>{copy.tableDestinationUrl}</th>
                    <th>{copy.tableClicksReceived}</th>
                    <th>{copy.tableCreationDate}</th>
                    <th>{copy.tableActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {links.items.length === 0 ? (
                    <tr>
                      <td colSpan={5}>{copy.noLinksYet}</td>
                    </tr>
                  ) : (
                    links.items.map((link) => (
                      <tr key={link.id}>
                        <td>
                          <Link href={`/admin/links/${link.id}`} className="rb-link-title">
                            /{link.slug}
                          </Link>
                          {link.tags.length > 0 ? (
                            <div className="rb-tags">
                              {link.tags.map((tag) => (
                                <span key={tag} className="rb-tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="rb-cell-url">{link.destinationUrl}</td>
                        <td>{formatNumber(link.clicksReceived, lang)}</td>
                        <td>{formatDate(link.createdAt, lang)}</td>
                        <td>
                          <div className="rb-actions">
                            <button type="button" onClick={() => void copyLink(link.slug)}>
                              {copy.copy}
                            </button>
                            <button type="button" onClick={() => void toggleLinkStats(link.id, link.slug)}>
                              {activeLinkStats?.id === link.id ? copy.hideStats : copy.showStats}
                            </button>
                            <button type="button" onClick={() => void toggleFavorite(link.id, link.isFavorite)}>
                              {link.isFavorite ? "★" : "☆"}
                            </button>
                            <button
                              type="button"
                              className="rb-danger"
                              disabled={deletingLinkId === link.id}
                              onClick={() => void deleteLink(link.id)}
                            >
                              {deletingLinkId === link.id ? copy.deletingLink : copy.deleteLink}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ) : (
            <section className="rb-grid">
              {links.items.map((link) => (
                <article key={link.id} className="rb-card">
                  <div className="rb-card-head">
                    <Link href={`/admin/links/${link.id}`} className="rb-link-title">
                      /{link.slug}
                    </Link>
                    <button type="button" onClick={() => void toggleFavorite(link.id, link.isFavorite)}>
                      {link.isFavorite ? "★" : "☆"}
                    </button>
                  </div>
                  <p className="rb-card-url">{link.destinationUrl}</p>
                  <p className="rb-card-meta">
                    {formatNumber(link.clicksReceived, lang)} {copy.clicks}
                  </p>
                  {link.tags.length > 0 ? (
                    <div className="rb-tags">
                      {link.tags.map((tag) => (
                        <span key={tag} className="rb-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="rb-actions">
                    <button type="button" onClick={() => void copyLink(link.slug)}>
                      {copy.copy}
                    </button>
                    <button type="button" onClick={() => void toggleLinkStats(link.id, link.slug)}>
                      {activeLinkStats?.id === link.id ? copy.hideStats : copy.showStats}
                    </button>
                    <button
                      type="button"
                      className="rb-danger"
                      disabled={deletingLinkId === link.id}
                      onClick={() => void deleteLink(link.id)}
                    >
                      {deletingLinkId === link.id ? copy.deletingLink : copy.deleteLink}
                    </button>
                    <Link href={`/admin/links/${link.id}`} className="rb-button-link">
                      {copy.open}
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          )}

          {activeLinkStats ? (
            <section className="rb-panel rb-link-inline-stats">
              <h2>
                {copy.linkStatsTitle} /{activeLinkStats.slug}
              </h2>
              {loadingLinkStatsId === activeLinkStats.id ? (
                <div className="rb-link-stats-loading-screen" aria-live="polite" aria-busy="true">
                  <div className="rb-analytics-loader">
                    <div className="rb-loader-ring" aria-hidden="true" />
                    <p className="rb-loader-title">{copy.loadingStats}</p>
                    <div className="rb-loader-progress" role="progressbar" aria-label={copy.loadingStats}>
                      <span />
                    </div>
                  </div>
                </div>
              ) : activeLinkAnalytics ? (
                <AdminCharts
                  mode="rebrandly"
                  lang={lang}
                  overview={activeLinkAnalytics.overview}
                  timeseries={activeLinkAnalytics.timeseries}
                  worldMap={activeLinkAnalytics.worldMap}
                  topCities={activeLinkAnalytics.topCities}
                  topRegions={activeLinkAnalytics.topRegions}
                  topDays={activeLinkAnalytics.topDays}
                  popularHours={activeLinkAnalytics.popularHours}
                  clickType={activeLinkAnalytics.clickType}
                  topSocialPlatforms={activeLinkAnalytics.topSocialPlatforms}
                  topSources={activeLinkAnalytics.topSources}
                  topBrowsers={activeLinkAnalytics.topBrowsers}
                  topDevices={activeLinkAnalytics.topDevices}
                  topLanguages={activeLinkAnalytics.topLanguages}
                  topPlatforms={activeLinkAnalytics.topPlatforms}
                />
              ) : (
                <p className="rb-muted">{copy.noData}</p>
              )}
            </section>
          ) : null}

          <footer className="rb-pagination">
            <button type="button" disabled={links.page <= 1 || loading} onClick={() => void refresh(links.page - 1)}>
              {copy.previous}
            </button>
            <span>
              {copy.page} {links.page} / {links.totalPages}
            </span>
            <button
              type="button"
              disabled={links.page >= links.totalPages || loading}
              onClick={() => void refresh(links.page + 1)}
            >
              {copy.next}
            </button>
          </footer>
        </>
      )}
    </main>
  );
}
