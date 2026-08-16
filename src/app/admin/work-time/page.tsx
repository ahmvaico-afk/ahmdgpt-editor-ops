import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { WorkTimeClient } from "@/components/admin/work-time-client";

export default async function AdminWorkTimePage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text">Time Approvals</h1>
          <p className="mt-1 text-sm text-muted">
            Sign off the hours editors logged. Nothing counts toward the leaderboard until it
            passes through here.
          </p>
        </div>
        <WorkTimeClient />
      </div>
    </div>
  );
}
