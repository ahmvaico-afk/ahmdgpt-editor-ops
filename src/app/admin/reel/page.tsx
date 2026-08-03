import { redirect } from "next/navigation";
import { AdminHeader } from "@/components/nav/admin-header";
import { ReelClient } from "@/components/reel/reel-client";
import { SystemLabel } from "@/components/ui/system-label";
import { requireAdminSession } from "@/lib/auth";
import { MAX_UPLOAD_MB } from "@/lib/reel/limits";

export const metadata = {
  title: "Testimonial Reel — AHMD.GPT",
};

export default async function ReelPage() {
  // `proxy.ts` already gates this route; this is the belt-and-braces check so
  // the page can never render without an owner session.
  const session = await requireAdminSession();
  if (!session) redirect("/admin");

  return (
    <>
      <AdminHeader />
      {/*
       * No `overflow-hidden` here: on a flex child it drops the automatic
       * minimum size to zero, so tall content gets clipped and the page stops
       * scrolling entirely — which put the render button out of reach on
       * phones. The glow is inset-x-0/bottom-0 and so needs no clipping.
       */}
      <main className="relative flex-1 px-6 py-12">
        <div className="bg-accent-glow pointer-events-none absolute inset-x-0 bottom-0 h-[40vh]" />

        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10">
          <div className="flex flex-col gap-3">
            <SystemLabel>Testimonial Reel</SystemLabel>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
              Drop a clip.
              <br />
              Get a reel.
            </h1>
            <p className="max-w-md text-sm text-muted">
              Your raw testimonial gets composited into the AHMD.GPT template at
              1080×1920 with the original audio, ready to post.
            </p>
          </div>

          <ReelClient maxUploadMb={MAX_UPLOAD_MB} />
        </div>
      </main>
    </>
  );
}
