import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { AdminDashboardClient } from "@/components/admin/dashboard-client";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <AdminDashboardClient />
    </div>
  );
}
