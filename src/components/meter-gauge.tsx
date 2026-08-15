"use client";

/**
 * Credit-score style arc gauge for an editor's quality meter.
 *
 * Drawn as SVG rather than a progress bar because the bands carry meaning on
 * their own — an editor can see they are in "Good" without reading the number,
 * and can see how far the next band is.
 */

const BANDS = [
  { from: 0, to: 40, label: "Poor", colour: "#ff2a3c" },
  { from: 40, to: 60, label: "Fair", colour: "#ff7a2f" },
  { from: 60, to: 80, label: "Good", colour: "#d4a853" },
  { from: 80, to: 93, label: "Very Good", colour: "#8ed94b" },
  { from: 93, to: 100, label: "Excellent", colour: "#00ff85" },
] as const;

export function bandFor(value: number) {
  return BANDS.find((b) => value >= b.from && value <= b.to) ?? BANDS[0];
}

const CX = 100;
const CY = 104;
const R_OUT = 88;
const R_IN = 62;
/** Degrees of arc dropped between bands, so the segments read as separate. */
const GAP = 2;

/** 0 -> hard left, 100 -> hard right, sweeping over the top. */
function angleFor(value: number): number {
  const t = Math.max(0, Math.min(100, value)) / 100;
  return Math.PI - t * Math.PI;
}

function point(angle: number, radius: number): [number, number] {
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

/** Annulus sector between two values, as a closed path. */
function bandPath(from: number, to: number): string {
  const gapValue = (GAP / 180) * 100;
  const a0 = angleFor(from + gapValue / 2);
  const a1 = angleFor(to - gapValue / 2);

  const [ox0, oy0] = point(a0, R_OUT);
  const [ox1, oy1] = point(a1, R_OUT);
  const [ix1, iy1] = point(a1, R_IN);
  const [ix0, iy0] = point(a0, R_IN);

  // Outer edge runs left-to-right over the top (clockwise on screen, sweep 1);
  // the inner edge comes back the other way (sweep 0).
  return [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${R_OUT} ${R_OUT} 0 0 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${R_IN} ${R_IN} 0 0 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function MeterGauge({
  value,
  size = 200,
  showLabel = true,
}: {
  value: number;
  size?: number;
  showLabel?: boolean;
}) {
  const band = bandFor(value);
  const angle = angleFor(value);

  // Needle as a slim triangle: a wide base at the hub tapering to the reading.
  const [tipX, tipY] = point(angle, R_OUT - 6);
  const [bl, blY] = point(angle + Math.PI / 2, 7);
  const [br, brY] = point(angle - Math.PI / 2, 7);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 124"
        width={size}
        height={(size * 124) / 200}
        role="img"
        aria-label={`Meter ${value} percent, ${band.label}`}
      >
        {BANDS.map((b) => (
          <path key={b.label} d={bandPath(b.from, b.to)} fill={b.colour} />
        ))}

        <polygon
          points={`${tipX.toFixed(2)},${tipY.toFixed(2)} ${bl.toFixed(2)},${blY.toFixed(2)} ${br.toFixed(2)},${brY.toFixed(2)}`}
          fill="var(--color-text)"
        />
        <circle cx={CX} cy={CY} r="11" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="3" />
        <circle cx={CX} cy={CY} r="4" fill="var(--color-text)" />
      </svg>

      <div className="-mt-1 flex flex-col items-center">
        <span className="font-mono text-2xl font-medium tabular-nums" style={{ color: band.colour }}>
          {value}%
        </span>
        {showLabel && (
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {band.label}
          </span>
        )}
      </div>
    </div>
  );
}
