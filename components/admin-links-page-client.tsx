"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminCharts from "@/components/admin-charts";
import AdminLanguageToggle from "@/components/admin-language-toggle";
import LogoutButton from "@/components/logout-button";
import type { GlobalAnalyticsData, LinkAnalyticsData, PaginatedShortLinks } from "@/lib/links";
import { ADMIN_LANG_STORAGE_KEY, normalizeAdminLang, type AdminLang } from "@/lib/i18n";

interface AdminLinksPageClientProps {
  initialLinks: PaginatedShortLinks;
  initialGlobalAnalytics: GlobalAnalyticsData;
}

type ViewMode = "list" | "grid";
type AdminSection = "links" | "analytics";

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
    globalStatsTitle: "Statistiques globales (tous les liens)",
    totalLinks: "Liens actifs",
    totalClicks: "Clics totaux",
    clicksToday: "Clics aujourd'hui",
    uniqueClicks: "Clics uniques",
    clicksLast7Days: "Clics (7 jours)",
    topLinks: "Top liens",
    topCountries: "Top pays",
    topSources: "Top sources",
    noData: "Pas de donnees",
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
    refreshLinks: "Actualisation...",
    tableLinkTitle: "Titre du lien",
    tableDestinationUrl: "URL de destination",
    tableClicksReceived: "Clics recus",
    tableCreationDate: "Date de creation",
    tableActions: "Actions",
    noLinksYet: "Aucun lien pour le moment.",
    showStats: "Voir stats",
    hideStats: "Masquer stats",
    loadingStats: "Chargement des stats...",
    linkStatsTitle: "Stats du lien",
    copy: "Copier",
    open: "Ouvrir",
    previous: "Precedent",
    next: "Suivant",
    page: "Page",
    copiedPrefix: "Copie",
    never: "Jamais",
    clicks: "clics"
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
    globalStatsTitle: "Global Stats (all links)",
    totalLinks: "Active links",
    totalClicks: "Total clicks",
    clicksToday: "Clicks today",
    uniqueClicks: "Unique clicks",
    clicksLast7Days: "Clicks (7 days)",
    topLinks: "Top links",
    topCountries: "Top countries",
    topSources: "Top sources",
    noData: "No data",
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
    refreshLinks: "Refreshing links...",
    tableLinkTitle: "Link title",
    tableDestinationUrl: "Destination URL",
    tableClicksReceived: "Clicks received",
    tableCreationDate: "Creation date",
    tableActions: "Actions",
    noLinksYet: "No links yet.",
    showStats: "View stats",
    hideStats: "Hide stats",
    loadingStats: "Loading stats...",
    linkStatsTitle: "Link stats",
    copy: "Copy",
    open: "Open",
    previous: "Previous",
    next: "Next",
    page: "Page",
    copiedPrefix: "Copied",
    never: "Never",
    clicks: "clicks"
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
    day: "numeric"
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

export default function AdminLinksPageClient({ initialLinks, initialGlobalAnalytics }: AdminLinksPageClientProps) {
  const [links, setLinks] = useState<PaginatedShortLinks>(initialLinks);
  const [globalAnalytics, setGlobalAnalytics] = useState<GlobalAnalyticsData>(initialGlobalAnalytics);
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
  const [creating, setCreating] = useState(false);
  const [showNewLinkForm, setShowNewLinkForm] = useState(false);
  const [form, setForm] = useState<NewLinkFormState>(() => createDefaultFormState());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    const stored = normalizeAdminLang(window.localStorage.getItem(ADMIN_LANG_STORAGE_KEY));
    setLang(stored);
  }, []);

  const copy = words[lang];

  const statsCards = useMemo(
    () => [
      { label: copy.totalLinks, value: globalAnalytics.totalLinks },
      { label: copy.clicksLast7Days, value: globalAnalytics.clicksLast7Days }
    ],
    [copy.clicksLast7Days, copy.totalLinks, globalAnalytics.clicksLast7Days, globalAnalytics.totalLinks]
  );

  const activeLinkAnalytics = activeLinkStats ? linkAnalytics[activeLinkStats.id] : null;

  function setLanguage(nextLang: AdminLang) {
    setLang(nextLang);
    window.localStorage.setItem(ADMIN_LANG_STORAGE_KEY, nextLang);
  }

  async function refresh(nextPage = links.page) {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/links?page=${nextPage}&pageSize=${links.pageSize}`, {
        cache: "no-store",
        credentials: "include"
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            links?: PaginatedShortLinks;
            globalAnalytics?: GlobalAnalyticsData;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.links || !payload?.globalAnalytics) {
        throw new Error(toErrorMessage(payload, "Failed to refresh links"));
      }

      setLinks(payload.links);
      setGlobalAnalytics(payload.globalAnalytics);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to refresh links");
    } finally {
      setLoading(false);
    }
  }

  async function submitNewLink() {
    setFeedback(null);
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
          retargeting_scripts: []
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Failed to create link"));
      }

      setForm(createDefaultFormState());
      setShowNewLinkForm(false);
      await refresh(1);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  }

  async function toggleFavorite(linkId: string, isFavorite: boolean) {
    setFeedback(null);
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
      await refresh(links.page);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to update favorite");
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
      const response = await fetch(`/api/admin/links/${encodeURIComponent(linkId)}?includeAnalytics=1`, {
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
      setFeedback(error instanceof Error ? error.message : "Failed to fetch link analytics");
    } finally {
      setLoadingLinkStatsId((current) => (current === linkId ? null : current));
    }
  }

  async function copyLink(slug: string) {
    if (!origin) return;
    const full = `${origin}/${slug}`;
    await navigator.clipboard.writeText(full);
    setFeedback(`${copy.copiedPrefix}: ${full}`);
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
      </nav>

      {feedback ? <p className="rb-feedback">{feedback}</p> : null}
      {loading ? <p className="rb-feedback">{copy.refreshLinks}</p> : null}

      {activeSection === "analytics" ? (
        <section className="rb-panel">
          <h2>{copy.globalStatsTitle}</h2>
          <div className="rb-global-metrics">
            {statsCards.map((item) => (
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
                <p className="rb-muted">{copy.loadingStats}</p>
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
