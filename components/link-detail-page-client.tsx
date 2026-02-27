"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AdminCharts from "@/components/admin-charts";
import type { LinkAnalyticsData } from "@/lib/links";
import type { AdminSettings, DeepLinksConfig, RoutingRule, ShortLink } from "@/lib/types";

interface LinkDetailPageClientProps {
  initialLink: ShortLink;
  initialAnalytics: LinkAnalyticsData;
  initialSettings: AdminSettings;
}

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
    .map((entry) => entry.label);
}

function toErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as { error?: string; issues?: Array<{ message?: string }> };
  if (Array.isArray(candidate.issues) && candidate.issues.length > 0 && candidate.issues[0]?.message) {
    return candidate.issues[0].message;
  }
  return candidate.error ?? fallback;
}

export default function LinkDetailPageClient({
  initialLink,
  initialAnalytics,
  initialSettings
}: LinkDetailPageClientProps) {
  const [link, setLink] = useState<ShortLink>(initialLink);
  const [analytics] = useState<LinkAnalyticsData>(initialAnalytics);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [routingRulesJson, setRoutingRulesJson] = useState(() => toPrettyJson(link.routingRules));
  const [retargetingJson, setRetargetingJson] = useState(() => toPrettyJson(link.retargetingScripts));
  const [deepLinks, setDeepLinks] = useState<DeepLinksConfig>(link.deepLinks ?? {});
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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

  async function savePatch(payload: Record<string, unknown>) {
    setSaving(true);
    setFeedback(null);
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
        throw new Error(toErrorMessage(body, "Failed to save"));
      }
      setLink(body.link);
      setFeedback("Saved");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to save");
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
      setFeedback(error instanceof Error ? error.message : "Invalid routing rules JSON");
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
      setFeedback(error instanceof Error ? error.message : "Invalid retargeting JSON");
    }
  }

  async function onCopy(value: string) {
    await navigator.clipboard.writeText(value);
    setFeedback("Copied to clipboard");
  }

  return (
    <main className="rb-page">
      <header className="rb-header">
        <div>
          <Link className="rb-back" href="/admin/links">
            ← Back to Links
          </Link>
          <h1>/{link.slug}</h1>
          <p className="rb-muted">Link detail and analytics report</p>
        </div>
        <div className="rb-header-actions">
          <span className="rb-plan-pill">Plan: {initialSettings.plan.toUpperCase()}</span>
          <button type="button" className="rb-primary" disabled={saving} onClick={() => void onCopy(shortUrl)}>
            Copy short link
          </button>
        </div>
      </header>

      {feedback ? <p className="rb-feedback">{feedback}</p> : null}

      <section className="rb-link-detail-layout">
        <div className="rb-link-detail-main">
          <article className="rb-panel">
            <h2>Optimize</h2>

            <details open className="rb-accordion">
              <summary>UTM Builder</summary>
              <div className="rb-form-grid">
                <label htmlFor="utm_source">
                  UTM Source
                  <input id="utm_source" value={utmSource} onChange={(event) => setUtmSource(event.target.value)} />
                </label>
                <label htmlFor="utm_medium">
                  UTM Medium
                  <input id="utm_medium" value={utmMedium} onChange={(event) => setUtmMedium(event.target.value)} />
                </label>
                <label htmlFor="utm_campaign">
                  UTM Campaign
                  <input id="utm_campaign" value={utmCampaign} onChange={(event) => setUtmCampaign(event.target.value)} />
                </label>
                <label htmlFor="utm_content">
                  UTM Content
                  <input id="utm_content" value={utmContent} onChange={(event) => setUtmContent(event.target.value)} />
                </label>
                <label htmlFor="utm_term">
                  UTM Term
                  <input id="utm_term" value={utmTerm} onChange={(event) => setUtmTerm(event.target.value)} />
                </label>
              </div>
              <p className="rb-muted rb-url-preview">{utmPreview}</p>
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onApplyUtm()}>
                  Apply to destination
                </button>
                <button type="button" onClick={() => void onCopy(utmPreview)}>
                  Copy URL
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>Traffic routing</summary>
              <p className="rb-muted">
                Configure JSON array with conditions `devices`, `countries`, `languages` and `destination_url`.
              </p>
              <textarea
                className="rb-code-area"
                value={routingRulesJson}
                onChange={(event) => setRoutingRulesJson(event.target.value)}
              />
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveRoutingRules()}>
                  Save routing rules
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>Deep links</summary>
              <div className="rb-form-grid">
                <label htmlFor="deep_ios">
                  iOS app link
                  <input
                    id="deep_ios"
                    value={deepLinks.ios_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, ios_url: event.target.value }))}
                  />
                </label>
                <label htmlFor="deep_android">
                  Android app link
                  <input
                    id="deep_android"
                    value={deepLinks.android_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, android_url: event.target.value }))}
                  />
                </label>
                <label htmlFor="deep_fallback">
                  Fallback web URL
                  <input
                    id="deep_fallback"
                    value={deepLinks.fallback_url ?? ""}
                    onChange={(event) => setDeepLinks((prev) => ({ ...prev, fallback_url: event.target.value }))}
                  />
                </label>
              </div>
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveDeepLinks()}>
                  Save deep links
                </button>
              </div>
            </details>

            <details className="rb-accordion">
              <summary>Retargeting scripts</summary>
              <p className="rb-muted">JSON array. Example: type inline/external/pixel, plus content or src.</p>
              <textarea
                className="rb-code-area"
                value={retargetingJson}
                onChange={(event) => setRetargetingJson(event.target.value)}
              />
              <div className="rb-actions">
                <button type="button" className="rb-primary" disabled={saving} onClick={() => void onSaveRetargeting()}>
                  Save scripts
                </button>
              </div>
            </details>
          </article>

          <section className="rb-panel">
            <h2>Report</h2>
            <AdminCharts
              mode="rebrandly"
              plan={initialSettings.plan}
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
            <h3>Link preview</h3>
            <p className="rb-link-preview-short">{shortUrl}</p>
            <p className="rb-muted">{link.destinationUrl}</p>
            <a href={link.destinationUrl} target="_blank" rel="noreferrer">
              Open destination
            </a>
          </article>

          <article className="rb-panel">
            <h3>QR Code</h3>
            <img src={qrUrl} alt={`QR code for ${shortUrl}`} className="rb-qr-image" />
            <div className="rb-actions">
              <a href={qrUrl} download={`qr-${link.slug}.png`}>
                Download
              </a>
              <button type="button" onClick={() => void onCopy(qrUrl)}>
                Copy image URL
              </button>
            </div>
          </article>

          <article className="rb-panel">
            <h3>Best time to share your link</h3>
            {bestHours.length === 0 ? (
              <p className="rb-muted">Not enough data yet.</p>
            ) : (
              <ul className="rb-best-hours">
                {bestHours.map((hour) => (
                  <li key={hour}>{hour}</li>
                ))}
              </ul>
            )}
          </article>

          <article className="rb-panel">
            <h3>Share with</h3>
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
