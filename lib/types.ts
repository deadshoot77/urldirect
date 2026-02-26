export type RedirectStatus = 301 | 302;
export type DeviceType = "mobile" | "desktop" | "bot" | "unknown";
export type PixelType = "meta" | "tiktok" | "google" | "postback";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | {
      [key: string]: JsonValue;
    }
  | JsonValue[];

export interface RedirectRule {
  id: number;
  slug: string;
  targetUrl: string;
  statusCode: RedirectStatus;
  isActive: boolean;
  pixelEnabled: boolean;
  pixelType: PixelType | null;
  pixelConfig: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedRedirect {
  slug: string;
  targetUrl: string;
  statusCode: RedirectStatus;
  pixelEnabled: boolean;
  pixelType: PixelType | null;
  pixelConfig: string | null;
  ruleId: number | null;
}

export interface PixelLogInput {
  ruleId: number | null;
  slug: string;
  pixelType: PixelType;
  eventName: string;
  status: "success" | "error";
  responseCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  payload: Record<string, JsonValue> | null;
}

export interface PixelConfig {
  id: string;
  token?: string;
  event_name: string;
  custom_params?: Record<string, string | number | boolean>;
}
