import { z } from "zod";

export const editorLoginSchema = z.object({
  editorCode: z.string().trim().min(1).max(64),
  pin: z.string().trim().min(4).max(6).regex(/^\d+$/),
});

export const adminLoginSchema = z.object({
  loginCode: z.string().trim().min(1).max(64),
  pin: z.string().trim().min(4).max(6).regex(/^\d+$/),
});

export const createSubmissionSchema = z.object({
  styleId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  clientOrProject: z.string().trim().max(200).optional().or(z.literal("")),
  videoLink: z.string().trim().url().max(1000),
  durationMinutes: z.number().positive().max(10000),
  customRatePerMinuteDollars: z.number().nonnegative().max(100000).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  /// Optional: timed work the editor logged before this record existed.
  workItemId: z.string().min(1).max(64).optional(),
});

export const updateSubmissionSchema = z.object({
  status: z.enum(["submitted", "approved", "paid", "rejected"]).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  clientOrProject: z.string().trim().max(200).optional().or(z.literal("")),
  videoLink: z.string().trim().url().max(1000).optional(),
  durationMinutes: z.number().positive().max(10000).optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createStyleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  isCustomPricing: z.boolean().default(false),
  ratePerMinuteDollars: z.number().nonnegative().max(100000).optional(),
  perMinuteIncrementDollars: z.number().nonnegative().max(100000).optional(),
});

export const updateStyleSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  ratePerMinuteDollars: z.number().nonnegative().max(100000).nullable().optional(),
  perMinuteIncrementDollars: z.number().nonnegative().max(100000).optional(),
  isCustomPricing: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const createEditorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  pin: z.string().trim().min(4).max(6).regex(/^\d+$/),
});

export const updateEditorSchema = z.object({
  active: z.boolean().optional(),
  pin: z.string().trim().min(4).max(6).regex(/^\d+$/).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  /// Owner-only: promotes this editor to QA, or takes the hat away.
  isQa: z.boolean().optional(),
});

export const updateBatchSettingsSchema = z.object({
  currentBatch: z.number().int().positive(),
});

export const wipeBatchSchema = z.object({
  confirm: z.literal(true),
});

export const updateClientRateSchema = z.object({
  clientRateDollars: z.number().nonnegative().max(100000).nullable(),
  clientIncrementDollars: z.number().nonnegative().max(100000).optional(),
  // The shape of the ladder, not just its numbers. Previously only settable by
  // editing the database directly, which meant any style added from the UI
  // could only ever bill as a plain per-minute rate.
  clientBaseSeconds: z.number().int().min(0).max(3600).optional(),
  clientOverageUnitSeconds: z.number().int().min(1).max(3600).optional(),
  clientOverageGraceSeconds: z.number().int().min(0).max(600).optional(),
  clientOverageProportional: z.boolean().optional(),
});

export const invoiceUnlockSchema = z.object({
  password: z.string().min(1).max(200),
});

/**
 * The config blob is deliberately `unknown` here — `normalizeConfig` in
 * lib/hook/spec.ts is the single authority on shape and bounds, so validating
 * it twice would just be two places to keep in sync.
 */
export const startWorkItemSchema = z.object({
  /// What the editor calls the video they're starting, e.g. "Rosabella #2".
  /// Not a submission id — that record doesn't exist until the work is done.
  label: z.string().trim().min(1).max(120),
});

export const workItemActionSchema = z.object({
  action: z.enum(["submit", "resume", "finish"]),
  /// Required for "finish": the literal word, typed out.
  confirm: z.string().trim().max(20).optional(),
});

export const approveWorkTimeSchema = z.object({
  approved: z.boolean(),
});

/**
 * QA logs a whole round at once — "3 minor and 1 major" — rather than filling
 * the form in three times. Counts, not a single severity.
 */
export const createRevisionSchema = z
  .object({
    counts: z.object({
      minor: z.number().int().min(0).max(50),
      moderate: z.number().int().min(0).max(50),
      major: z.number().int().min(0).max(50),
    }),
    reason: z.enum(["editor_error", "brief_change"]),
    note: z.string().trim().max(400).optional(),
  })
  .refine((d) => d.counts.minor + d.counts.moderate + d.counts.major > 0, {
    message: "Count at least one revision.",
  });

export const createHookPresetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  config: z.unknown(),
});

export const updateHookPresetSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  config: z.unknown().optional(),
});
