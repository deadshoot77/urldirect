import { getSupabaseAdminClient } from "@/lib/db";

export interface LabelCount {
  label: string;
  clicks: number;
}

export interface DailyPoint {
  day: string;
  clicks: number;
}

export interface HourlyPoint {
  hour: string;
  clicks: number;
}

export interface DashboardData {
  totalClicks: number;
  clicksBySlug: LabelCount[];
  daily7: DailyPoint[];
  daily30: DailyPoint[];
  hourly: HourlyPoint[];
  topReferers: LabelCount[];
  topDevices: LabelCount[];
  topCountries: LabelCount[];
}

interface RpcLabelCountRow {
  label: string;
  clicks: number;
}

interface RpcDailyRow {
  day: string;
  clicks: number;
}

interface RpcHourlyRow {
  hour: string;
  clicks: number;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function mapLabelCount(rows: RpcLabelCountRow[]): LabelCount[] {
  return rows.map((row) => ({
    label: toString(row.label) || "unknown",
    clicks: toNumber(row.clicks)
  }));
}

async function runRpcList<T>(functionName: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await getSupabaseAdminClient().rpc(functionName, args ?? {});
  if (error) {
    throw new Error(`${functionName} failed: ${error.message}`);
  }
  if (!data) return [];
  return Array.isArray(data) ? (data as T[]) : ([data] as T[]);
}

async function getTotalClicks(): Promise<number> {
  const rows = await runRpcList<{ total_clicks: number }>("stats_total_clicks");
  return toNumber(rows[0]?.total_clicks);
}

async function getClicksBySlug(): Promise<LabelCount[]> {
  const rows = await runRpcList<RpcLabelCountRow>("stats_clicks_by_slug", { p_limit: 100 });
  return mapLabelCount(rows);
}

async function getDailyClicks(days: 7 | 30): Promise<DailyPoint[]> {
  const rows = await runRpcList<RpcDailyRow>("stats_daily", { p_days: days });
  return rows.map((row) => ({
    day: toString(row.day),
    clicks: toNumber(row.clicks)
  }));
}

async function getHourlyClicks(): Promise<HourlyPoint[]> {
  const rows = await runRpcList<RpcHourlyRow>("stats_hourly", { p_days: 30 });
  return rows.map((row) => ({
    hour: toString(row.hour).padStart(2, "0"),
    clicks: toNumber(row.clicks)
  }));
}

async function getTopReferers(): Promise<LabelCount[]> {
  const rows = await runRpcList<RpcLabelCountRow>("stats_top_referrers", { p_limit: 10 });
  return mapLabelCount(rows);
}

async function getTopDevices(): Promise<LabelCount[]> {
  const rows = await runRpcList<RpcLabelCountRow>("stats_top_devices", { p_limit: 10 });
  return mapLabelCount(rows);
}

async function getTopCountries(): Promise<LabelCount[]> {
  const rows = await runRpcList<RpcLabelCountRow>("stats_top_countries", { p_limit: 10 });
  return mapLabelCount(rows);
}

export async function getDashboardData(): Promise<DashboardData> {
  const [totalClicks, clicksBySlug, daily7, daily30, hourly, topReferers, topDevices, topCountries] =
    await Promise.all([
      getTotalClicks(),
      getClicksBySlug(),
      getDailyClicks(7),
      getDailyClicks(30),
      getHourlyClicks(),
      getTopReferers(),
      getTopDevices(),
      getTopCountries()
    ]);

  return {
    totalClicks,
    clicksBySlug,
    daily7,
    daily30,
    hourly,
    topReferers,
    topDevices,
    topCountries
  };
}

export interface CsvLogRow {
  createdAt: string;
  slug: string;
  targetUrl: string;
  statusCode: number;
  ipHash: string;
  referer: string;
  refererDomain: string;
  country: string;
  deviceType: string;
  userAgent: string;
  queryString: string;
}

interface LogRow {
  created_at: string;
  slug: string;
  target_url: string;
  status_code: number;
  ip_hash: string;
  referer: string | null;
  referer_domain: string;
  country: string;
  device_type: string;
  user_agent: string | null;
  query_string: string | null;
}

export async function getLogsForCsv(fromIso: string, toIso: string): Promise<CsvLogRow[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("logs")
    .select(
      "created_at, slug, target_url, status_code, ip_hash, referer, referer_domain, country, device_type, user_agent, query_string"
    )
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getLogsForCsv failed: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const typed = row as LogRow;
    return {
      createdAt: toString(typed.created_at),
      slug: toString(typed.slug),
      targetUrl: toString(typed.target_url),
      statusCode: toNumber(typed.status_code),
      ipHash: toString(typed.ip_hash),
      referer: toString(typed.referer),
      refererDomain: toString(typed.referer_domain),
      country: toString(typed.country),
      deviceType: toString(typed.device_type),
      userAgent: toString(typed.user_agent),
      queryString: toString(typed.query_string)
    };
  });
}
