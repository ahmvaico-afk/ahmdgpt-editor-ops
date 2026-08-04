import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { TotalsClient } from "@/components/admin/totals-client";

export default async function AdminTotalsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <TotalsClient />
    </div>
  );
}
