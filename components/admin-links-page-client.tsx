"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import LogoutButton from "@/components/logout-button";
import type { PaginatedShortLinks } from "@/lib/links";
import type { AdminSettings } from "@/lib/types";

interface AdminLinksPageClientProps {
  initialLinks: PaginatedShortLinks;
  initialSettings: AdminSettings;
}

type ViewMode = "list" | "grid";

interface NewLinkFormState {
  slug: string;
  destination_url: string;
  tags: string;
  redirect_type: 301 | 302;
}

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

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function AdminLinksPageClient({ initialLinks, initialSettings }: AdminLinksPageClientProps) {
  const [links, setLinks] = useState<PaginatedShortLinks>(initialLinks);
  const [settings, setSettings] = useState<AdminSettings>(initialSettings);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showNewLinkForm, setShowNewLinkForm] = useState(false);
  const [form, setForm] = useState<NewLinkFormState>(() => createDefaultFormState());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const usageLabel = useMemo(() => {
    return `${formatNumber(settings.usageThisMonth)} / ${formatNumber(settings.clickLimitMonthly)}`;
  }, [settings.clickLimitMonthly, settings.usageThisMonth]);

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
            settings?: AdminSettings;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.links || !payload?.settings) {
        throw new Error(toErrorMessage(payload, "Failed to refresh links"));
      }

      setLinks(payload.links);
      setSettings(payload.settings);
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

  async function updatePlan(nextPlan: "free" | "pro") {
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          plan: nextPlan
        })
      });
      const payload = (await response.json().catch(() => null)) as { settings?: AdminSettings; error?: string } | null;
      if (!response.ok || !payload?.settings) {
        throw new Error(toErrorMessage(payload, "Failed to update plan"));
      }
      setSettings(payload.settings);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to update plan");
    }
  }

  async function copyLink(slug: string) {
    if (!origin) return;
    const full = `${origin}/${slug}`;
    await navigator.clipboard.writeText(full);
    setFeedback(`Copied ${full}`);
  }

  return (
    <main className="rb-page">
      <header className="rb-header">
        <div>
          <p className="rb-eyebrow">Admin</p>
          <h1>Links</h1>
        </div>
        <div className="rb-header-actions">
          <label className="rb-inline-control" htmlFor="plan_select">
            Plan
            <select
              id="plan_select"
              value={settings.plan}
              onChange={(event) => void updatePlan(event.target.value as "free" | "pro")}
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
            </select>
          </label>
          <span className="rb-usage">Tracked this month: {usageLabel}</span>
          <LogoutButton label="Logout" loadingLabel="Signing out..." />
        </div>
      </header>

      {settings.limitReached ? (
        <section className="rb-alert rb-alert-danger">
          <div>
            <strong>You&apos;ve reached the limit for click tracking this month.</strong>
            <p>Data may not be fully accurate until your next cycle or upgrade.</p>
          </div>
          <button type="button">Upgrade</button>
        </section>
      ) : null}

      <section className="rb-toolbar">
        <div className="rb-toolbar-left">
          <label htmlFor="sort_select">
            Sort
            <select id="sort_select" defaultValue="latest">
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="clicks">Most clicks</option>
            </select>
          </label>
        </div>
        <div className="rb-toolbar-right">
          <div className="rb-view-toggle">
            <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
              List
            </button>
            <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")}>
              Grid
            </button>
          </div>
          <button type="button" className="rb-primary" onClick={() => setShowNewLinkForm((value) => !value)}>
            New link
          </button>
        </div>
      </section>

      {showNewLinkForm ? (
        <section className="rb-panel">
          <h2>Create new link</h2>
          <div className="rb-form-grid">
            <label htmlFor="new_slug">
              Slug
              <input
                id="new_slug"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                placeholder="offer-2026"
              />
            </label>
            <label htmlFor="new_destination">
              Destination URL
              <input
                id="new_destination"
                type="url"
                value={form.destination_url}
                onChange={(event) => setForm((prev) => ({ ...prev, destination_url: event.target.value }))}
                placeholder="https://example.com/landing"
              />
            </label>
            <label htmlFor="new_tags">
              Tags
              <input
                id="new_tags"
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="campaign,spring"
              />
            </label>
            <label htmlFor="new_redirect_type">
              Redirect type
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
              {creating ? "Creating..." : "Create link"}
            </button>
            <button type="button" onClick={() => setShowNewLinkForm(false)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? <p className="rb-feedback">{feedback}</p> : null}

      {loading ? <p className="rb-feedback">Refreshing links...</p> : null}

      {viewMode === "list" ? (
        <section className="rb-panel">
          <table className="rb-table">
            <thead>
              <tr>
                <th>Link title</th>
                <th>Destination URL</th>
                <th>Clicks received</th>
                <th>Creation date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {links.items.length === 0 ? (
                <tr>
                  <td colSpan={5}>No links yet.</td>
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
                    <td>{formatNumber(link.clicksReceived)}</td>
                    <td>{formatDate(link.createdAt)}</td>
                    <td>
                      <div className="rb-actions">
                        <button type="button" onClick={() => void copyLink(link.slug)}>
                          Copy
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
              <p className="rb-card-meta">{formatNumber(link.clicksReceived)} clicks</p>
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
                  Copy
                </button>
                <Link href={`/admin/links/${link.id}`} className="rb-button-link">
                  Open
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      <footer className="rb-pagination">
        <button type="button" disabled={links.page <= 1 || loading} onClick={() => void refresh(links.page - 1)}>
          Previous
        </button>
        <span>
          Page {links.page} / {links.totalPages}
        </span>
        <button
          type="button"
          disabled={links.page >= links.totalPages || loading}
          onClick={() => void refresh(links.page + 1)}
        >
          Next
        </button>
      </footer>
    </main>
  );
}
