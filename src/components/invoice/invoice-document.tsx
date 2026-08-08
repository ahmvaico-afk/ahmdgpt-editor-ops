"use client";

import { formatCents, formatUsdCents } from "@/lib/pricing";
import { formatDuration } from "@/lib/duration";
import { EyeLogo } from "@/components/eye-logo";

export interface InvoiceLineItem {
  title: string;
  detail: string;
  durationMinutes: number;
  amountCents: number | null;
}

/**
 * One document for both invoices an editor sends the owner and invoices the
 * owner sends a client — same AHMD.GPT brand tokens and typefaces as the rest
 * of the app, only the currency and the names differ. The `invoice-sheet` class
 * is what makes the dark brand colours survive Print / Save as PDF; see
 * globals.css.
 */
export function InvoiceDocument({
  fromName,
  toName,
  invoiceNumber,
  dateLabel,
  batchLabel,
  items,
  totalCents,
  footerNote,
  currency,
}: {
  fromName: string;
  toName?: string;
  invoiceNumber?: string;
  dateLabel: string;
  batchLabel: string;
  items: InvoiceLineItem[];
  totalCents: number;
  footerNote?: string;
  currency?: "PKR" | "USD";
}) {
  const format = currency === "USD" ? formatUsdCents : formatCents;
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 print:px-0 print:py-0">
      <div className="mb-3 flex items-center justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-accent px-5 py-2 font-mono text-xs uppercase tracking-wider text-bg transition-colors hover:bg-accent-light"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="invoice-sheet rounded-2xl border border-border bg-surface px-8 py-10 text-text print:rounded-none print:border-0">
        <div className="flex items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex items-center gap-2.5">
            <EyeLogo className="h-8 w-8 text-accent" />
            <span className="font-display text-xl font-extrabold tracking-tight text-text">
              {fromName}
            </span>
          </div>
          <div className="text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Invoice</p>
            {invoiceNumber && (
              <p className="mt-1 font-mono text-sm text-muted">#{invoiceNumber}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-6 text-sm">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">Billed to</p>
            <p className="mt-1 font-medium text-text">{toName || "—"}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">Date</p>
            <p className="mt-1 text-text">{dateLabel}</p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted-2">
              Batch
            </p>
            <p className="mt-1 text-text">{batchLabel}</p>
          </div>
        </div>

        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted">
              <th className="pb-2 font-normal">Video</th>
              <th className="pb-2 font-normal">Duration</th>
              <th className="pb-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-border-soft">
                <td className="py-3 pr-4">
                  <p className="font-medium text-text">{item.title}</p>
                  <p className="text-xs text-muted">{item.detail}</p>
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-muted">
                  {formatDuration(item.durationMinutes)}
                </td>
                <td className="py-3 text-right font-mono text-text">
                  {item.amountCents == null ? "—" : format(item.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <div className="w-60">
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
                Total
              </span>
              <span className="font-mono text-lg font-medium text-gold">{format(totalCents)}</span>
            </div>
          </div>
        </div>

        {footerNote && (
          <p className="mt-10 border-t border-border-soft pt-4 font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {footerNote}
          </p>
        )}
      </div>
    </div>
  );
}
