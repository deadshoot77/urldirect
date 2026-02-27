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
