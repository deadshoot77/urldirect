import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_-]{0,119}$/, "slug must match ^[a-z0-9][a-z0-9_-]{0,119}$");

export const pixelTypeSchema = z.enum(["meta", "tiktok", "google", "postback"]);
export const adminPixelTypeSchema = z.union([pixelTypeSchema, z.literal("none")]);

export const pixelConfigSchema = z.object({
  id: z.string().min(1, "pixel_config.id is required"),
  token: z.string().optional(),
  event_name: z.string().min(1, "pixel_config.event_name is required").default("PageView"),
  custom_params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

export const adminLoginSchema = z.object({
  password: z.string().min(1, "password is required")
});

export const redirectRuleInputSchema = z
  .object({
    slug: slugSchema,
    target_url: z.string().url("target_url must be a valid URL"),
    status_code: z.union([z.literal(301), z.literal(302)]).default(302),
    is_active: z.boolean().default(true),
    pixel_enabled: z.boolean().default(false),
    pixel_type: adminPixelTypeSchema.nullable().optional().default("none"),
    pixel_config: z.unknown().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.pixel_enabled && value.pixel_config) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pixel_enabled"],
        message: "pixel_config must be omitted when pixel_enabled is false"
      });
    }
  });

const optionalUrlSchema = z
  .union([z.string().url("must be a valid URL"), z.literal(""), z.null(), z.undefined()])
  .transform((value) => {
    if (value === null) return null;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

export const routingRuleSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().max(120).optional(),
  destination_url: z.string().trim().url("destination_url must be a valid URL"),
  devices: z.array(z.string().trim().min(1)).optional().default([]),
  countries: z.array(z.string().trim().min(1).max(3)).optional().default([]),
  languages: z.array(z.string().trim().min(1).max(20)).optional().default([]),
  enabled: z.boolean().optional().default(true)
});

export const deepLinksSchema = z.object({
  ios_url: optionalUrlSchema.transform((value) => value ?? undefined),
  android_url: optionalUrlSchema.transform((value) => value ?? undefined),
  fallback_url: optionalUrlSchema.transform((value) => value ?? undefined)
});

export const landingModeSchema = z.enum(["inherit", "on", "off"]);

export const retargetingScriptSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().max(120).optional(),
  type: z.enum(["inline", "external", "pixel"]).optional().default("inline"),
  content: z.string().optional(),
  src: optionalUrlSchema.transform((value) => value ?? undefined),
  enabled: z.boolean().optional().default(true)
});

export const shortLinkCreateSchema = z.object({
  slug: slugSchema,
  destination_url: z.string().trim().url("destination_url must be a valid URL"),
  title: z.union([z.string().trim().max(140), z.null(), z.undefined()]).optional(),
  is_favorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  redirect_type: z.union([z.literal(301), z.literal(302)]).default(302),
  routing_rules: z.array(routingRuleSchema).default([]),
  deep_links: deepLinksSchema.default({}),
  retargeting_scripts: z.array(retargetingScriptSchema).default([]),
  landing_mode: landingModeSchema.default("inherit"),
  background_url: optionalUrlSchema,
  is_active: z.boolean().default(true)
});

export const shortLinkPatchSchema = shortLinkCreateSchema
  .partial()
  .extend({
    slug: slugSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export const adminSettingsPatchSchema = z
  .object({
    tracking_enabled: z.boolean().optional(),
    landing_enabled: z.boolean().optional(),
    global_background_url: optionalUrlSchema
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting must be provided"
  });

export const analyticsGranularitySchema = z.enum(["hours", "days", "months"]);
