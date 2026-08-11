import { z } from "zod";

export const settingsUpdateSchema = z
  .object({
    emailProvider: z.enum(["gmail", "smtp"]).optional(),
    emailAddress: z.string().email("Valid email address is required.").optional().or(z.literal("")),
    emailConnected: z.boolean().optional(),
    minDelay: z.coerce.number().int().min(0, "Minimum delay cannot be negative.").optional(),
    maxDelay: z.coerce.number().int().min(0, "Maximum delay cannot be negative.").optional(),
    disconnect: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.minDelay != null && value.maxDelay != null && value.maxDelay < value.minDelay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum delay cannot be smaller than minimum.",
        path: ["maxDelay"],
      });
    }
  });
