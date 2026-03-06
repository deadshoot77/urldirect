import { redirect } from "next/navigation";
import AdminLinksPageClient from "@/components/admin-links-page-client";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  createEmptyGlobalAnalyticsData,
  getAdminSettings,
  listShortLinksPage,
  type PaginatedShortLinks
} from "@/lib/links";
import type { AdminSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LinksPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}

export default async function AdminLinksPage({ searchParams }: LinksPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const resolvedSearch = await searchParams;
  const page = Number(resolvedSearch.page ?? "1");
  const pageSize = Number(resolvedSearch.pageSize ?? "20");
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
  let links: PaginatedShortLinks = {
    items: [],
    page: safePage,
    pageSize: safePageSize,
    total: 0,
    totalPages: 1
  };
  let settings: AdminSettings = {
    plan: "pro" as const,
    clickLimitMonthly: Number.MAX_SAFE_INTEGER,
    trackingEnabled: true,
    landingEnabled: false,
    globalBackgroundUrl: null as string | null,
    limitBehavior: "drop" as const,
    usageThisMonth: 0,
    limitReached: false
  };

  try {
    const [loadedLinks, loadedSettings] = await Promise.all([
      listShortLinksPage(safePage, safePageSize),
      getAdminSettings({ includeUsage: false })
    ]);
    links = loadedLinks;
    settings = loadedSettings;
  } catch (error) {
    console.error("admin links page load fallback", error);
  }
  const initialGlobalAnalytics = createEmptyGlobalAnalyticsData(links.total);

  return (
    <AdminLinksPageClient
      initialLinks={links}
      initialGlobalAnalytics={initialGlobalAnalytics}
      initialGlobalAnalyticsLoaded={false}
      initialSettings={settings}
    />
  );
}
