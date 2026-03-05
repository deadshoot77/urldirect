import type { DeepLinksConfig, RetargetingScript, RoutingRule, ShortLink } from "@/lib/types";
import type { UserAgentProfile } from "@/lib/request";

interface RoutingContext {
  device: string;
  country: string;
  language: string;
}

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase();
}

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function matchesList(actual: string, expectedList: string[] | undefined): boolean {
  if (!expectedList || expectedList.length === 0) return true;
  const normalizedActual = normalize(actual);
  return expectedList.some((entry) => normalize(entry) === normalizedActual);
}

function ruleMatches(rule: RoutingRule, context: RoutingContext): boolean {
  if (rule.enabled === false) return false;
  return (
    matchesList(context.device, rule.devices) &&
    matchesList(context.country, rule.countries) &&
    matchesList(context.language, rule.languages)
  );
}

export function resolveDestinationWithRouting(link: ShortLink, context: RoutingContext): string {
  let destination = link.destinationUrl;
  for (const rule of link.routingRules) {
    if (!isHttpUrl(rule.destination_url)) {
      continue;
    }
    if (ruleMatches(rule, context)) {
      destination = rule.destination_url;
      break;
    }
  }
  return destination;
}

export function resolveDeepLinkDestination(
  webDestination: string,
  deepLinks: DeepLinksConfig,
  userAgent: UserAgentProfile
): string {
  if (!deepLinks) return webDestination;
  if (userAgent.os === "iOS" && isHttpUrl(deepLinks.ios_url)) {
    return deepLinks.ios_url;
  }
  if (userAgent.os === "Android" && isHttpUrl(deepLinks.android_url)) {
    return deepLinks.android_url;
  }
  if (isHttpUrl(deepLinks.fallback_url)) {
    return deepLinks.fallback_url;
  }
  return webDestination;
}

export function hasRetargetingScripts(scripts: RetargetingScript[]): boolean {
  return scripts.some((script) => {
    if (script.enabled === false) return false;
    return Boolean(script.content && script.content.trim()) || Boolean(script.src && script.src.trim());
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderScriptBlock(script: RetargetingScript): string {
  if (script.enabled === false) return "";
  const type = script.type ?? "inline";
  if (type === "external" && script.src && isHttpUrl(script.src)) {
    return `<script async src="${escapeHtml(script.src)}"></script>`;
  }
  if (type === "pixel" && script.src && isHttpUrl(script.src)) {
    return `<img src="${escapeHtml(script.src)}" alt="" width="1" height="1" style="position:absolute;left:-9999px;opacity:0;" />`;
  }
  if (script.content && script.content.trim()) {
    return `<script>${script.content}</script>`;
  }
  return "";
}

export function buildRetargetingIntermediaryHtml(finalUrl: string, scripts: RetargetingScript[]): string {
  const safeFinalUrl = escapeHtml(finalUrl);
  const blocks = scripts.map(renderScriptBlock).filter((block) => block.length > 0).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeFinalUrl}" />
  <title>Redirecting...</title>
</head>
<body style="margin:0;background:#0b0e14;color:#e5e7eb;font-family:Segoe UI,Helvetica,Arial,sans-serif;display:grid;min-height:100svh;place-items:center;">
  <div style="text-align:center;">
    <p style="margin:0 0 8px;font-size:14px;opacity:.85;">Redirecting...</p>
    <a href="${safeFinalUrl}" style="color:#f87171;">Continue</a>
  </div>
  ${blocks}
  <script>
    setTimeout(function () {
      window.location.replace(${JSON.stringify(finalUrl)});
    }, 20);
  </script>
</body>
</html>`;
}

interface InAppLandingHtmlInput {
  continueUrl: string;
  shortUrl: string;
  backgroundUrl: string | null;
}

export function buildInAppLandingHtml(input: InAppLandingHtmlInput): string {
  const safeContinueUrl = escapeHtml(input.continueUrl);
  const safeShortUrl = escapeHtml(input.shortUrl);
  const safeBackgroundUrl = input.backgroundUrl ? escapeHtml(input.backgroundUrl) : "";
  const hasBackground = safeBackgroundUrl.length > 0;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Ouvrir dans le navigateur</title>
  <style>
    :root {
      --bg: #0a0f19;
      --fg: #f8fafc;
      --muted: #cbd5e1;
      --card: rgba(15, 23, 42, 0.84);
      --accent: #f97316;
      --accent-2: #ef4444;
      --border: rgba(148, 163, 184, 0.35);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      min-height: 100%;
      font-family: "Space Grotesk", "Segoe UI", sans-serif;
      color: var(--fg);
      background:
        linear-gradient(145deg, rgba(249, 115, 22, 0.2), rgba(239, 68, 68, 0.08)),
        radial-gradient(circle at 20% 15%, rgba(56, 189, 248, 0.18), transparent 45%),
        var(--bg);
    }
    body {
      display: grid;
      place-items: center;
      padding: 20px 14px;
    }
    .wrap {
      width: min(520px, 100%);
      border-radius: 18px;
      border: 1px solid var(--border);
      overflow: hidden;
      box-shadow: 0 24px 40px rgba(0, 0, 0, 0.35);
      background: var(--card);
      backdrop-filter: blur(7px);
    }
    .hero {
      min-height: 170px;
      background:
        linear-gradient(to bottom, rgba(2, 6, 23, 0.08), rgba(2, 6, 23, 0.5)),
        ${hasBackground ? `url("${safeBackgroundUrl}") center/cover no-repeat` : "linear-gradient(135deg, #fb7185 0%, #f97316 45%, #0ea5e9 100%)"};
    }
    .content {
      padding: 18px 16px 16px;
      display: grid;
      gap: 14px;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.2rem, 2vw, 1.45rem);
      line-height: 1.25;
    }
    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.45;
      font-size: 0.95rem;
    }
    .steps {
      padding: 10px 11px;
      border: 1px dashed rgba(148, 163, 184, 0.5);
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.55);
      display: grid;
      gap: 8px;
    }
    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.93rem;
    }
    .arrow {
      width: 34px;
      height: 2px;
      background: linear-gradient(90deg, var(--accent), var(--accent-2));
      position: relative;
      border-radius: 999px;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .arrow::after {
      content: "";
      position: absolute;
      right: -5px;
      top: -3px;
      width: 8px;
      height: 8px;
      border-right: 2px solid var(--accent);
      border-top: 2px solid var(--accent);
      transform: rotate(45deg);
    }
    @keyframes pulse {
      0%, 100% { transform: translateX(0); opacity: 1; }
      50% { transform: translateX(4px); opacity: 0.7; }
    }
    .actions {
      display: grid;
      gap: 8px;
    }
    button, .alt {
      width: 100%;
      border: 0;
      border-radius: 12px;
      padding: 11px 12px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button {
      background: linear-gradient(135deg, #ef4444, #f97316);
      color: #fff;
    }
    .alt {
      display: inline-flex;
      justify-content: center;
      text-decoration: none;
      background: rgba(30, 41, 59, 0.75);
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.4);
    }
    .slug {
      font-size: 0.8rem;
      color: #93c5fd;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="hero"></div>
    <section class="content">
      <h1>Pour ouvrir correctement, passe par ton navigateur externe</h1>
      <p>Dans TikTok, appuie sur <strong>⋯</strong> puis <strong>Ouvrir dans le navigateur</strong>.</p>
      <div class="steps">
        <div class="step"><span>1. Appuie sur</span><span class="arrow"></span><strong>⋯</strong></div>
        <div class="step"><span>2. Choisis</span><span class="arrow"></span><strong>Ouvrir dans le navigateur</strong></div>
      </div>
      <div class="actions">
        <button id="continue">J'ai ouvert dans navigateur</button>
        <a class="alt" href="${safeContinueUrl}" rel="nofollow">Continuer quand meme</a>
      </div>
      <p class="slug">${safeShortUrl}</p>
    </section>
  </main>
  <script>
    (function () {
      var button = document.getElementById("continue");
      if (!button) return;
      button.addEventListener("click", function () {
        window.location.href = ${JSON.stringify(input.continueUrl)};
      });
    })();
  </script>
</body>
</html>`;
}
