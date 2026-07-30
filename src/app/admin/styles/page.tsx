import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { StylesClient } from "@/components/admin/styles-client";

export default async function AdminStylesPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <StylesClient />
    </div>
  );
}
