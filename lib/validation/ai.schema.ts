import { z } from "zod";

export const generatedEmailSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export const reviewEmailSchema = z.object({
  status: z.enum(["approved", "warning"]),
  issues: z.array(z.string()).default([]),
});
