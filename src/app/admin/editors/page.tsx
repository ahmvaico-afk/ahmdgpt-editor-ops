import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { EditorsClient } from "@/components/admin/editors-client";

export default async function AdminEditorsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <EditorsClient />
    </div>
  );
}
