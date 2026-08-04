"use client";

import { formatCents } from "@/lib/pricing";
import { formatDuration } from "@/lib/duration";
import { EyeLogo } from "@/components/eye-logo";

export interface InvoiceLineItem {
  title: string;
  detail: string;
  durationMinutes: number;
  amountCents: number | null;
}

export function InvoiceDocument({
  fromName,
  toName,
  invoiceNumber,
  dateLabel,
  batchLabel,
  items,
  totalCents,
  footerNote,
}: {
  fromName: string;
  toName?: string;
  invoiceNumber?: string;
  dateLabel: string;
  batchLabel: string;
  items: InvoiceLineItem[];
  totalCents: number;
  footerNote?: string;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white px-10 py-12 text-neutral-900 print:px-0 print:py-0">
      <div className="mb-2 flex items-center justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="flex items-start justify-between border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-2">
          <EyeLogo className="h-7 w-7 text-neutral-900" />
          <span className="text-lg font-extrabold tracking-tight">{fromName}</span>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase tracking-wide text-neutral-800">Invoice</p>
          {invoiceNumber && <p className="text-sm text-neutral-500">#{invoiceNumber}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-400">Billed to</p>
          <p className="mt-1 font-medium text-neutral-900">{toName || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-400">Date</p>
          <p className="mt-1 text-neutral-900">{dateLabel}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-neutral-400">Batch</p>
          <p className="mt-1 text-neutral-900">{batchLabel}</p>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="pb-2">Video</th>
            <th className="pb-2">Duration</th>
            <th className="pb-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-neutral-100">
              <td className="py-3 pr-4">
                <p className="font-medium text-neutral-900">{item.title}</p>
                <p className="text-xs text-neutral-500">{item.detail}</p>
              </td>
              <td className="py-3 pr-4 text-neutral-700">
                {formatDuration(item.durationMinutes)}
              </td>
              <td className="py-3 text-right font-mono text-neutral-900">
                {item.amountCents == null ? "—" : formatCents(item.amountCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-56">
          <div className="flex justify-between border-t border-neutral-300 pt-3 text-base font-bold text-neutral-900">
            <span>Total</span>
            <span className="font-mono">{formatCents(totalCents)}</span>
          </div>
        </div>
      </div>

      {footerNote && <p className="mt-10 text-xs text-neutral-400">{footerNote}</p>}
    </div>
  );
}
