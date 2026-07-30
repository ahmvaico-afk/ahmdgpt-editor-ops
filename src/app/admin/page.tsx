import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { EyeLogo } from "@/components/eye-logo";
import { SystemLabel } from "@/components/ui/system-label";
import { AdminLoginForm } from "@/components/admin-login-form";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session?.role === "admin") {
    redirect("/admin/dashboard");
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24">
      <div className="bg-accent-glow pointer-events-none absolute inset-x-0 bottom-0 h-[50vh]" />
      <div className="relative z-10 flex w-full max-w-xs flex-col items-center gap-8 text-center">
        <EyeLogo className="h-8 w-8 text-text" />
        <div className="flex flex-col items-center gap-3">
          <SystemLabel>Owner Access</SystemLabel>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-text">
            Master Dashboard
          </h1>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
