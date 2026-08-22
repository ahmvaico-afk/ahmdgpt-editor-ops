import { redirect } from "next/navigation";
import { requireOwnerSession } from "@/lib/auth";
import { AdminHeader } from "@/components/nav/admin-header";
import { ApplicantsClient } from "@/components/admin/applicants-client";

export default async function AdminApplicantsPage() {
  // Owner only — QA has no business reading people's phone numbers.
  const session = await requireOwnerSession();
  if (!session) {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-text">Applications</h1>
          <p className="mt-1 text-sm text-muted">
            From the public hiring form. Share{" "}
            <span className="font-mono text-text">/apply</span> on your story.
          </p>
        </div>
        <ApplicantsClient />
      </div>
    </div>
  );
}
