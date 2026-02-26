import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/admin-login-form";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) {
    redirect("/admin");
  }

  return (
    <main className="auth-page">
      <AdminLoginForm />
    </main>
  );
}
