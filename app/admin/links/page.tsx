import { redirect } from "next/navigation";
import AdminLinksPageClient from "@/components/admin-links-page-client";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSettings, listShortLinksWithStats } from "@/lib/links";

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
  const [links, settings] = await Promise.all([listShortLinksWithStats(page, pageSize), getAdminSettings()]);

  return <AdminLinksPageClient initialLinks={links} initialSettings={settings} />;
}
