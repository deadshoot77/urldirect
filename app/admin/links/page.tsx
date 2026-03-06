import { redirect } from "next/navigation";
import AdminLinksPageClient from "@/components/admin-links-page-client";
import { isAdminAuthenticated } from "@/lib/auth";
import { createEmptyGlobalAnalyticsData, getAdminSettings, listShortLinksWithStats } from "@/lib/links";

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
  const [links, settings] = await Promise.all([
    listShortLinksWithStats(page, pageSize),
    getAdminSettings({ includeUsage: false })
  ]);
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
