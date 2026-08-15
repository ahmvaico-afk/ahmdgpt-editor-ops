import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { MetersClient } from "@/components/meters-client";

export default async function AdminMetersPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text">Meters</h1>
          <p className="mt-1 text-sm text-muted">
            Quality and speed per editor. Log revisions from the Dashboard against each video.
          </p>
        </div>
        {/* Owner sees capped-session flags; editors don't need the noise. */}
        <MetersClient showFlags />
      </div>
    </div>
  );
}
