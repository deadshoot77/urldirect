import { notFound, redirect } from "next/navigation";
import LinkDetailPageClient from "@/components/link-detail-page-client";
import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminSettings, getLinkAnalyticsData, getShortLinkById } from "@/lib/links";

export const dynamic = "force-dynamic";

interface LinkDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function LinkDetailPage({ params }: LinkDetailPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const resolved = await params;
  const link = await getShortLinkById(resolved.id);
  if (!link) {
    notFound();
  }

  const [analytics, settings] = await Promise.all([getLinkAnalyticsData(link.id), getAdminSettings()]);

  return <LinkDetailPageClient initialLink={link} initialAnalytics={analytics} initialSettings={settings} />;
}
