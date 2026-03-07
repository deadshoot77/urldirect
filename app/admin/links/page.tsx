import { redirect } from "next/navigation";
import AdminLinksPageClient from "@/components/admin-links-page-client";
import { isAdminAuthenticated } from "@/lib/auth";
import { loadAdminLinksPageData } from "@/lib/admin-links-page-data";
import { getAdminSettings, type PaginatedShortLinks } from "@/lib/links";
import type { AdminSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

interface LinksPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
  }>;
}

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  plan: "pro",
  clickLimitMonthly: Number.MAX_SAFE_INTEGER,
  trackingEnabled: true,
  landingEnabled: false,
  globalBackgroundUrl: null,
  limitBehavior: "drop",
  usageThisMonth: 0,
  limitReached: false
};

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
  let settings: AdminSettings = DEFAULT_ADMIN_SETTINGS;
  let initialLinkStatsFallback = false;

  try {
    const [loadedLinks, loadedSettings] = await Promise.allSettled([
      loadAdminLinksPageData(safePage, safePageSize),
      getAdminSettings({ includeUsage: false })
    ]);

    if (loadedLinks.status === "fulfilled") {
      links = loadedLinks.value.links;
      initialLinkStatsFallback = loadedLinks.value.linkStatsFallback;
    } else {
      console.error("admin links page base load failed", loadedLinks.reason);
    }

    if (loadedSettings.status === "fulfilled") {
      settings = loadedSettings.value;
    } else {
      console.error("admin links page settings fallback", loadedSettings.reason);
    }
  } catch (error) {
    console.error("admin links page load fallback", error);
  }
  return (
    <AdminLinksPageClient
      initialLinks={links}
      initialLinkStatsFallback={initialLinkStatsFallback}
      initialGlobalAnalytics={null}
      initialGlobalAnalyticsLoaded={false}
      initialSettings={settings}
    />
  );
}
