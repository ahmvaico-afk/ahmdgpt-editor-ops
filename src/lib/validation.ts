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
});

export const updateBatchSettingsSchema = z.object({
  currentBatch: z.number().int().positive(),
});

export const wipeBatchSchema = z.object({
  confirm: z.literal(true),
});
