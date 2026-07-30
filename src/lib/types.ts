export type SubmissionStatus = "submitted" | "approved" | "paid" | "rejected";

export interface Style {
  id: string;
  name: string;
  isCustomPricing: boolean;
  ratePerMinuteCents: number | null;
  perMinuteIncrementCents: number;
  active: boolean;
  sortOrder: number;
}

export interface Submission {
  id: string;
  editorId: string;
  styleId: string;
  styleName: string;
  title: string;
  clientOrProject: string | null;
  videoLink: string;
  durationMinutes: number;
  pricePerMinuteCents: number;
  calculatedPriceCents: number;
  status: SubmissionStatus;
  submittedAt: string;
  updatedAt: string;
  notes: string | null;
  editor?: { name: string; editorCode: string };
}

export interface EditorSummary {
  allTime: { totalCents: number; count: number };
  thisMonth: { totalCents: number; count: number };
  byStatus: { status: SubmissionStatus; totalCents: number; count: number }[];
}

export interface AdminEditor {
  id: string;
  name: string;
  editorCode: string;
  active: boolean;
  createdAt: string;
  _count: { submissions: number };
}

export interface AdminSummary {
  videosThisWeek: number;
  videosThisMonth: number;
  owed: { totalCents: number; count: number };
  paidOut: { totalCents: number; count: number };
  byStyle: { styleName: string; totalCents: number; count: number }[];
  topEditors: { editor: { id: string; name: string; editorCode: string } | null; count: number }[];
}
