import { pixelConfigSchema } from "@/lib/validation";
import { insertPixelLog } from "@/lib/db";
import type { PixelConfig, PixelType, RedirectRule } from "@/lib/types";

interface PixelContext {
  slug: string;
  rule: RedirectRule;
  finalUrl: string;
  originalUrl: string;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  country: string;
  query: URLSearchParams;
}

interface PixelResponse {
  statusCode: number;
  responseBody: string;
}

class PixelHttpError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

function truncate(value: string, maxLength = 1000): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function parsePixelConfig(rule: RedirectRule): PixelConfig {
  if (!rule.pixelConfig) {
    throw new Error("pixel_config is missing");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rule.pixelConfig);
  } catch {
    throw new Error("pixel_config is not valid JSON");
  }

  return pixelConfigSchema.parse(parsedJson);
}

async function postJson(
  url: string,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<PixelResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000)
  });

  const body = truncate(await response.text());
  if (!response.ok) {
    throw new PixelHttpError(`Pixel request failed: ${response.status}`, response.status, body);
  }

  return {
    statusCode: response.status,
    responseBody: body
  };
}

function extractAttribution(searchParams: URLSearchParams): Record<string, string> {
  const keys = ["gclid", "fbclid", "ttclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const output: Record<string, string> = {};

  for (const key of keys) {
    const value = searchParams.get(key);
    if (value) output[key] = value;
  }

  return output;
}

async function sendMetaEvent(config: PixelConfig, context: PixelContext): Promise<PixelResponse> {
  if (!config.token) {
    throw new Error("Meta requires pixel_config.token");
  }

  const endpoint = `https://graph.facebook.com/v20.0/${encodeURIComponent(config.id)}/events?access_token=${encodeURIComponent(
    config.token
  )}`;

  return postJson(endpoint, {
    data: [
      {
        event_name: config.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: context.finalUrl,
        user_data: {
          client_ip_address: context.ip || undefined,
          client_user_agent: context.userAgent || undefined
        },
        custom_data: {
          ...(config.custom_params || {}),
          country: context.country,
          ...extractAttribution(context.query)
        }
      }
    ]
  });
}

async function sendTikTokEvent(config: PixelConfig, context: PixelContext): Promise<PixelResponse> {
  if (!config.token) {
    throw new Error("TikTok requires pixel_config.token");
  }

  const endpoint = "https://business-api.tiktok.com/open_api/v1.3/pixel/track/";
  return postJson(
    endpoint,
    {
      pixel_code: config.id,
      event: config.event_name,
      timestamp: Math.floor(Date.now() / 1000),
      context: {
        page: {
          url: context.finalUrl,
          referrer: context.referer || undefined
        },
        user: {
          ip: context.ip || undefined,
          user_agent: context.userAgent || undefined
        }
      },
      properties: {
        ...(config.custom_params || {}),
        country: context.country,
        ...extractAttribution(context.query)
      }
    },
    {
      "Access-Token": config.token
    }
  );
}

async function sendGoogleWebhook(config: PixelConfig, context: PixelContext): Promise<PixelResponse> {
  let endpoint: URL;
  try {
    endpoint = new URL(config.id);
  } catch {
    throw new Error("Google webhook expects pixel_config.id to be a valid URL");
  }

  const headers: Record<string, string> = {};
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return postJson(
    endpoint.toString(),
    {
      event_name: config.event_name,
      event_time: new Date().toISOString(),
      click_url: context.originalUrl,
      redirect_url: context.finalUrl,
      country: context.country,
      attribution: extractAttribution(context.query),
      custom_params: config.custom_params || {}
    },
    headers
  );
}

async function sendCustomPostback(config: PixelConfig, context: PixelContext): Promise<PixelResponse> {
  let endpoint: URL;
  try {
    endpoint = new URL(config.id);
  } catch {
    throw new Error("Postback expects pixel_config.id to be a valid URL");
  }

  const headers: Record<string, string> = {};
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return postJson(
    endpoint.toString(),
    {
      event_name: config.event_name,
      slug: context.slug,
      redirect_url: context.finalUrl,
      referer: context.referer || null,
      country: context.country,
      user_agent: context.userAgent || null,
      custom_params: config.custom_params || {}
    },
    headers
  );
}

async function dispatchPixelEvent(
  pixelType: PixelType,
  config: PixelConfig,
  context: PixelContext
): Promise<PixelResponse> {
  switch (pixelType) {
    case "meta":
      return sendMetaEvent(config, context);
    case "tiktok":
      return sendTikTokEvent(config, context);
    case "google":
      return sendGoogleWebhook(config, context);
    case "postback":
      return sendCustomPostback(config, context);
    default:
      throw new Error(`Unsupported pixel type: ${pixelType}`);
  }
}

export async function triggerPixelTracking(context: PixelContext): Promise<void> {
  const rule = context.rule;
  if (!rule.pixelEnabled || !rule.pixelType) return;
  const safeRuleId = rule.id > 0 ? rule.id : null;

  let config: PixelConfig;
  try {
    config = parsePixelConfig(rule);
  } catch (error) {
    await insertPixelLog({
      ruleId: safeRuleId,
      slug: context.slug,
      pixelType: rule.pixelType,
      eventName: "unknown",
      status: "error",
      responseCode: null,
      responseBody: null,
      errorMessage: error instanceof Error ? error.message : "Invalid pixel config",
      payload: {
        reason: "invalid_pixel_config"
      }
    });
    return;
  }

  try {
    const result = await dispatchPixelEvent(rule.pixelType, config, context);
    await insertPixelLog({
      ruleId: safeRuleId,
      slug: context.slug,
      pixelType: rule.pixelType,
      eventName: config.event_name,
      status: "success",
      responseCode: result.statusCode,
      responseBody: result.responseBody,
      errorMessage: null,
      payload: {
        event_name: config.event_name,
        target: context.finalUrl
      }
    });
  } catch (error) {
    if (error instanceof PixelHttpError) {
      await insertPixelLog({
        ruleId: safeRuleId,
        slug: context.slug,
        pixelType: rule.pixelType,
        eventName: config.event_name,
        status: "error",
        responseCode: error.statusCode,
        responseBody: error.responseBody,
        errorMessage: error.message,
        payload: {
          event_name: config.event_name,
          error_type: "http"
        }
      });
      return;
    }

    await insertPixelLog({
      ruleId: safeRuleId,
      slug: context.slug,
      pixelType: rule.pixelType,
      eventName: config.event_name,
      status: "error",
      responseCode: null,
      responseBody: null,
      errorMessage: error instanceof Error ? error.message : "Unknown pixel error",
      payload: {
        event_name: config.event_name,
        error_type: "runtime"
      }
    });
  }
}
