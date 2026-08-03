"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { CARD, CARD_RADIUS, CONIC, REEL_H, REEL_W, type ReelRatio } from "@/lib/reel/spec";
import { BROWSER_FONTS, buildBackgroundSvg, buildConicSvg } from "@/lib/reel/svg";

type Props = {
  ratio: ReelRatio;
  videoUrl: string | null;
  videoRef?: RefObject<HTMLVideoElement | null>;
  muted: boolean;
  /** Drives the waveform strip; the export omits it for silent clips. */
  hasAudio?: boolean;
  /** Per-reel caption; ignored for 9:16, which has no room for it. */
  caption?: string;
  className?: string;
};

/**
 * WYSIWYG preview of the exported reel.
 *
 * The plate is the very same SVG that `lib/reel/background.ts` rasterises for
 * FFmpeg, and the video sits at the same card rect FFmpeg overlays into — with
 * the grain *under* it, matching the export, where the footage stays clean.
 * Everything is laid out in 1080x1920 units and scaled as a whole, so the
 * preview cannot drift from the output.
 */
export function ReelComposition({
  ratio,
  videoUrl,
  videoRef,
  muted,
  hasAudio = true,
  caption,
  className,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / REEL_W);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Split the same three ways the export composites, so the rotating sweep can
  // sit between the backdrop and the card frame in both.
  //
  // Everything here comes from module constants except `caption`, which is
  // user-typed and therefore escaped by `buildBackgroundSvg` before it reaches
  // the markup below.
  const backdrop = useMemo(
    () => buildBackgroundSvg(ratio, BROWSER_FONTS, { layer: "backdrop" }),
    [ratio],
  );
  const cardFrame = useMemo(
    () => buildBackgroundSvg(ratio, BROWSER_FONTS, { layer: "cardframe" }),
    [ratio],
  );
  const textLayer = useMemo(
    () =>
      buildBackgroundSvg(ratio, BROWSER_FONTS, {
        layer: "text",
        showWaveform: hasAudio,
        caption,
      }),
    [ratio, hasAudio, caption],
  );
  const conic = useMemo(() => buildConicSvg(), []);
  const card = CARD[ratio];

  // Full-scale disc, centred on the card band exactly as the export's crop does.
  const discSize = CONIC.radius * 2;

  return (
    <div
      ref={hostRef}
      /*
       * `outline` rather than `border`: a border would shrink the content box
       * below the aspect-ratio'd border box, leaving the scaled composition a
       * pixel short of the frame.
       */
      className={`relative w-full overflow-hidden rounded-xl bg-bg outline outline-1 -outline-offset-1 outline-border ${className ?? ""}`}
      style={{ aspectRatio: `${REEL_W} / ${REEL_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: REEL_W,
          height: REEL_H,
          transform: `scale(${scale})`,
          // Avoid a flash of unscaled 1080px content on first paint.
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <div
          className="absolute inset-0"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: backdrop }}
        />

        {/*
         * The sweep. `screen` matches the export's blend, so it only adds light.
         * The disc is oversized and offset so its centre lands on the card band
         * and the rotation never drags an empty corner into frame.
         */}
        <div
          className="reel-sweep absolute"
          aria-hidden
          style={{
            left: CONIC.cx - CONIC.radius,
            top: CONIC.cy - CONIC.radius,
            width: discSize,
            height: discSize,
            animationDuration: `${CONIC.periodSeconds}s`,
          }}
          dangerouslySetInnerHTML={{ __html: conic }}
        />

        <div
          className="absolute inset-0"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: cardFrame }}
        />


        <div
          className="absolute overflow-hidden"
          style={{
            left: card.x,
            top: card.y,
            width: card.w,
            height: card.h,
            borderRadius: CARD_RADIUS,
          }}
        >
          {videoUrl ? (
            /*
             * Kept on-screen and never `display:none` — Safari refuses to decode
             * a hidden video, which is what broke earlier attempts at this.
             */
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted={muted}
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-surface-2">
              <span
                className="font-mono uppercase text-muted-2"
                style={{ fontSize: 26, letterSpacing: "0.28em" }}
              >
                Your video here
              </span>
            </div>
          )}
        </div>

        {/* Last, as in the export, where the text overlay lands on the composite. */}
        <div
          className="absolute inset-0"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: textLayer }}
        />
      </div>
    </div>
  );
}
