import { redirect } from "next/navigation";
import AdminCharts from "@/components/admin-charts";
import LogoutButton from "@/components/logout-button";
import { getDashboardData } from "@/lib/analytics";
import { isAdminAuthenticated } from "@/lib/auth";
import { listRedirectRules } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const [dashboard, rules] = await Promise.all([getDashboardData(), listRedirectRules()]);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Redirect Analytics</h1>
          <p>Real-time redirect tracking dashboard.</p>
        </div>
        <div className="header-actions">
          <a className="secondary-button" href="/api/admin/export">
            Export CSV
          </a>
          <LogoutButton />
        </div>
      </header>

      <section className="metrics-grid">
        <article className="metric-card">
          <span>Total clicks</span>
          <strong>{formatNumber(dashboard.totalClicks)}</strong>
        </article>
        <article className="metric-card">
          <span>Unique slugs</span>
          <strong>{formatNumber(dashboard.clicksBySlug.length)}</strong>
        </article>
        <article className="metric-card">
          <span>Top referer</span>
          <strong>{dashboard.topReferers[0]?.label ?? "direct"}</strong>
        </article>
        <article className="metric-card">
          <span>Top country</span>
          <strong>{dashboard.topCountries[0]?.label ?? "UNK"}</strong>
        </article>
      </section>

      <AdminCharts
        daily7={dashboard.daily7}
        daily30={dashboard.daily30}
        hourly={dashboard.hourly}
        topDevices={dashboard.topDevices}
        topCountries={dashboard.topCountries}
      />

      <section className="tables-grid">
        <article className="card">
          <h3>Clicks by slug</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Slug</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.clicksBySlug.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{formatNumber(item.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <article className="card">
          <h3>Top referers</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Referer</th>
                <th>Clicks</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.topReferers.map((item) => (
                <tr key={item.label}>
                  <td>{item.label}</td>
                  <td>{formatNumber(item.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>

      <section className="card">
        <h3>Redirect rules</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Target</th>
              <th>Status</th>
              <th>Active</th>
              <th>Pixel</th>
              <th>Pixel type</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.slug}</td>
                <td className="cell-url">{rule.targetUrl}</td>
                <td>{rule.statusCode}</td>
                <td>{rule.isActive ? "yes" : "no"}</td>
                <td>{rule.pixelEnabled ? "yes" : "no"}</td>
                <td>{rule.pixelType ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
