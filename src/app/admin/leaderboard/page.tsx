import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { LeaderboardClient } from "@/components/leaderboard-client";

export default async function AdminLeaderboardPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <LeaderboardClient />
    </div>
  );
}
