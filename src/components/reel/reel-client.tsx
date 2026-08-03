"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ReelComposition } from "@/components/reel/reel-composition";
import type { SerializedReelJob } from "@/lib/reel/jobs";
import { ACCEPT_ATTRIBUTE, formatBytes, looksLikeVideo } from "@/lib/reel/limits";
import { CAPTION_TEXT, REEL_RATIOS, ratioLabel, type ReelRatio } from "@/lib/reel/spec";

type Phase = "idle" | "uploading" | "ready" | "rendering" | "done";

const MONO = "font-mono text-[11px] uppercase tracking-wider";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200 ease-brand"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={`${MONO} text-muted-2`}>{label}</span>
      <span className={`${MONO} text-muted`}>{value}</span>
    </div>
  );
}

export function ReelClient({ maxUploadMb }: { maxUploadMb: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renderProgress, setRenderProgress] = useState(0);
  const [job, setJob] = useState<SerializedReelJob | null>(null);
  const [ratio, setRatio] = useState<ReelRatio>("9x16");
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number } | null>(null);
  const [muted, setMuted] = useState(true);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  /** Set once the ratio pills are touched, so the probe stops overriding it. */
  const ratioLockedRef = useRef(false);

  const maxBytes = maxUploadMb * 1024 * 1024;

  useEffect(() => {
    return () => {
      xhrRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const resetLocal = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    ratioLockedRef.current = false;
    setVideoUrl(null);
    setFileMeta(null);
    setJob(null);
    setPhase("idle");
    setUploadProgress(0);
    setRenderProgress(0);
    setMuted(true);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const upload = useCallback(
    (file: File) => {
      setError(null);

      if (!looksLikeVideo(file.name, file.type)) {
        setError(`"${file.name}" isn't a video. Pick an MP4, MOV, M4V or WebM file.`);
        return;
      }
      if (file.size === 0) {
        setError(`"${file.name}" is empty.`);
        return;
      }
      if (file.size > maxBytes) {
        setError(
          `"${file.name}" is ${formatBytes(file.size)} — the limit is ${maxUploadMb} MB.`,
        );
        return;
      }

      // Show the composition straight away rather than waiting on the upload.
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setVideoUrl(url);
      setFileMeta({ name: file.name, size: file.size });
      setJob(null);
      setUploadProgress(0);
      setRenderProgress(0);
      setPhase("uploading");

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("POST", "/api/reel/upload");
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("x-reel-filename", encodeURIComponent(file.name));

      // `fetch` gives no upload progress, so this stays on XHR deliberately.
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setUploadProgress(event.loaded / event.total);
      };

      xhr.onload = () => {
        xhrRef.current = null;
        let payload: { job?: SerializedReelJob; error?: string } | null = null;
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload?.job) {
          setUploadProgress(1);
          setJob(payload.job);
          if (!ratioLockedRef.current) setRatio(payload.job.ratio);
          setPhase("ready");
        } else {
          setError(payload?.error ?? `The upload failed (HTTP ${xhr.status}).`);
          setPhase("idle");
        }
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        setError("Could not reach the server. Is the app still running?");
        setPhase("idle");
      };

      xhr.send(file);
    },
    [maxBytes, maxUploadMb],
  );

  // Poll for render progress; the render itself outlives any single request.
  useEffect(() => {
    if (phase !== "rendering" || !job) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`/api/reel/jobs/${job.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { job: SerializedReelJob };
        if (cancelled) return;

        setRenderProgress(payload.job.progress);
        if (payload.job.status === "done") {
          setJob(payload.job);
          setRenderProgress(1);
          setPhase("done");
        } else if (payload.job.status === "error") {
          setError(payload.job.error ?? "The render failed.");
          setPhase("ready");
        }
      } catch {
        // Transient poll failure — the next tick will pick it up.
      }
    };

    const timer = setInterval(tick, 600);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, job]);

  const startRender = useCallback(async () => {
    if (!job) return;
    setError(null);
    setRenderProgress(0);
    setPhase("rendering");

    try {
      const res = await fetch("/api/reel/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, ratio, caption }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setError(payload?.error ?? `The render could not be started (HTTP ${res.status}).`);
        setPhase("ready");
      }
    } catch {
      setError("Could not reach the server to start the render.");
      setPhase("ready");
    }
  }, [job, ratio, caption]);

  const replaceVideo = useCallback(() => {
    if (job) {
      void fetch(`/api/reel/jobs/${job.id}`, { method: "DELETE" }).catch(() => {});
    }
    setError(null);
    resetLocal();
  }, [job, resetLocal]);

  const chooseRatio = useCallback(
    (next: ReelRatio) => {
      ratioLockedRef.current = true;
      setRatio(next);
      // A finished render no longer matches the new shape.
      setPhase((current) => (current === "done" ? "ready" : current));
    },
    [],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) upload(file);
    },
    [upload],
  );

  const busy = phase === "uploading" || phase === "rendering";

  const statusText = {
    idle: "Waiting for a video",
    uploading: `Uploading — ${Math.round(uploadProgress * 100)}%`,
    ready: "Ready to render",
    rendering: `Rendering — ${Math.round(renderProgress * 100)}%`,
    done: "Done",
  }[phase];

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-center lg:gap-14">
      {/* Preview */}
      {/* Capped on phones so the render button isn't a full screen-height scroll away. */}
      <div className="mx-auto w-full max-w-[280px] shrink-0 sm:max-w-[380px] lg:mx-0">
        <ReelComposition
          ratio={ratio}
          videoUrl={videoUrl}
          muted={muted}
          hasAudio={job ? job.source.hasAudio : true}
          caption={caption}
        />
        {videoUrl && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className={`${MONO} text-muted-2 transition-colors hover:text-muted`}
            >
              {muted ? "Unmute preview" : "Mute preview"}
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-6 lg:mx-0">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
            {busy && <span className="status-dot" />}
            {statusText}
          </span>
          {busy && <ProgressBar value={phase === "uploading" ? uploadProgress : renderProgress} />}
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-xl border border-dashed p-6 text-center transition-colors ${
            dragging ? "border-accent bg-accent/5" : "border-border bg-surface-2"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
          />
          <p className={`${MONO} text-muted`}>
            {fileMeta ? fileMeta.name : "Drop a testimonial video"}
          </p>
          <p className={`${MONO} mt-1 text-muted-2`}>
            {fileMeta
              ? formatBytes(fileMeta.size)
              : `MP4 · MOV · M4V · WebM — up to ${maxUploadMb} MB`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${MONO} mt-4`}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {fileMeta ? "Choose another" : "Choose file"}
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-warning/40 bg-warning/5 px-4 py-3"
          >
            <p className={`${MONO} text-warning`}>Problem</p>
            <p className="mt-1 text-sm text-text">{error}</p>
          </div>
        )}

        {/* Ratio */}
        <div className="flex flex-col gap-2">
          <span className={`${MONO} text-muted-2`}>Source ratio</span>
          <div className="flex gap-2">
            {REEL_RATIOS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => chooseRatio(option)}
                disabled={busy}
                className={`${MONO} rounded-full px-4 py-1.5 transition-colors duration-200 ease-brand disabled:opacity-40 ${
                  ratio === option
                    ? "bg-accent text-white shadow-accent-glow"
                    : "border border-border text-muted hover:text-text"
                }`}
              >
                {ratioLabel(option)}
              </button>
            ))}
          </div>
        </div>

        {/*
         * Caption. Only 16:9 leaves room above the card, so the field is hidden
         * for 9:16 rather than shown as a control that silently does nothing.
         */}
        {ratio === "16x9" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="reel-caption" className={`${MONO} text-muted-2`}>
              Caption <span className="text-muted-2/60">optional</span>
            </label>
            <input
              id="reel-caption"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={busy}
              maxLength={CAPTION_TEXT.maxChars}
              placeholder="Client name, handle or a short quote"
              className={`${MONO} rounded-xl border border-border bg-surface px-4 py-2.5 uppercase text-text placeholder:normal-case placeholder:text-muted-2 focus:border-accent focus:outline-none disabled:opacity-40`}
            />
            <span className={`${MONO} text-muted-2`}>
              {caption.trim()
                ? `${CAPTION_TEXT.maxChars - caption.length} left`
                : "Sits between the headline and the video"}
            </span>
          </div>
        )}

        {job && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <Row label="Source" value={`${job.source.width}×${job.source.height}`} />
            <Row label="Length" value={`${job.source.durationSeconds.toFixed(1)}s`} />
            <Row label="Codec" value={job.source.videoCodec.toUpperCase()} />
            <Row
              label="Audio"
              value={job.source.hasAudio ? "Kept · drives waveform" : "None in source"}
            />
            <Row label="Output" value="1080×1920 · H.264 · AAC" />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {phase === "done" && job ? (
            <a
              href={`/api/reel/jobs/${job.id}/download`}
              download={job.downloadName ?? undefined}
              className={buttonClasses({ size: "lg", className: MONO })}
            >
              Download reel
            </a>
          ) : (
            <Button
              type="button"
              size="lg"
              className={MONO}
              disabled={phase !== "ready"}
              onClick={startRender}
            >
              {phase === "rendering" ? "Rendering…" : "Render reel"}
            </Button>
          )}

          {videoUrl && (
            <Button
              type="button"
              variant="ghost"
              size="md"
              className={MONO}
              disabled={phase === "uploading"}
              onClick={replaceVideo}
            >
              Replace video
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
