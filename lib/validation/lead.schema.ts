import { z } from "zod";

export const generateLeadsSchema = z.object({
  category: z.string().trim().min(1, "Category is required."),
  city: z.string().trim().min(1, "City is required."),
  country: z.string().trim().min(1, "Country is required."),
  limit: z.coerce.number().int().min(1).max(100),
  description: z.string().trim().optional(),
});

export const createLeadSchema = z.object({
  businessName: z.string().trim().min(1),
  category: z.string().trim().min(1),
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  description: z.string().trim().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  website: z.string().url().optional().or(z.literal("")),
  address: z.string().trim().optional(),
  contactChannel: z.enum(["email", "phone", "none"]).optional(),
  source: z.enum(["google_maps", "manual", "import"]).optional(),
});

const outreachUpdateSchema = z.object({
  channel: z.enum(["email", "whatsapp"]).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  status: z
    .enum([
      "not_generated",
      "generated",
      "ready",
      "queued",
      "sending",
      "sent",
      "delivered",
      "read",
      "failed",
      "skipped",
    ])
    .optional(),
  approval: z.enum(["pending", "approved"]).optional(),
  sendStatus: z
    .enum(["not_sent", "queued", "sending", "sent", "delivered", "read", "failed", "skipped"])
    .optional(),
});

const aiReviewUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "warning"]).optional(),
  issues: z.array(z.string()).optional(),
});

export const updateLeadSchema = z.object({
  businessName: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  description: z.string().trim().optional().or(z.literal("")),
  email: z.union([z.literal(""), z.string().trim().email("Valid email required.")]).optional(),
  phone: z.string().trim().optional().or(z.literal("")),
  // Allow non-strict URLs from scrapes / manual edits
  website: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().optional().or(z.literal("")),
  contactChannel: z.enum(["email", "phone", "none"]).optional(),
  source: z.enum(["google_maps", "manual", "import"]).optional(),
  outreach: outreachUpdateSchema.optional(),
  aiReview: aiReviewUpdateSchema.optional(),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one id is required."),
});

export const leadIdsSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1, "At least one leadId is required."),
});

export const leadIdSchema = z.object({
  leadId: z.string().min(1),
});
