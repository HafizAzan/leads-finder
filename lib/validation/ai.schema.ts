import { z } from "zod";

export const generatedEmailSchema = z.object({
  subject: z.string().trim().optional().default(""),
  body: z.string().trim().min(1),
});

export const reviewEmailSchema = z.object({
  status: z.enum(["approved", "warning"]),
  issues: z.array(z.string()).default([]),
});

/** Single-call generate + review (faster for local models). */
export const generatedOutreachWithReviewSchema = z.object({
  subject: z.string().trim().optional().default(""),
  body: z.string().trim().min(1),
  websiteFindings: z.array(z.string()).optional().default([]),
  reviewStatus: z.enum(["approved", "warning"]).default("approved"),
  issues: z.array(z.string()).default([]),
});
