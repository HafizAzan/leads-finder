export type ContactChannel = "email" | "phone" | "none";
export type LeadSource = "google_maps" | "manual" | "import";
export type OutreachChannel = "email" | "whatsapp";

export type AiReviewStatus = "pending" | "approved" | "warning";
export type OutreachStatus =
  | "not_generated"
  | "generated"
  | "ready"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";
export type ApprovalStatus = "pending" | "approved";
export type SendStatus =
  | "not_sent"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";
export type EmailProvider = "gmail" | "smtp";
export type QueueStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

export type LeadAiReview = {
  status: AiReviewStatus;
  issues: string[];
  reviewedAt?: string | null;
};

export type LeadOutreach = {
  channel: OutreachChannel;
  subject?: string;
  body?: string;
  status: OutreachStatus;
  approval: ApprovalStatus;
  sendStatus: SendStatus;
  generatedAt?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  whatsappMessageId?: string | null;
};

export type Lead = {
  id: string;
  userId: string;
  businessName: string;
  category: string;
  city: string;
  country: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  contactChannel: ContactChannel;
  source: LeadSource;
  aiReview: LeadAiReview;
  outreach: LeadOutreach;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type UserSettings = {
  id: string;
  emailProvider: EmailProvider;
  emailAddress: string;
  emailConnected: boolean;
  minDelay: number;
  maxDelay: number;
  whatsappConnected: boolean;
  whatsappDisplayNumber: string;
  whatsappMinDelay: number;
  whatsappMaxDelay: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type EmailQueueItem = {
  id: string;
  userId: string;
  leadId: string;
  businessName?: string;
  email: string;
  subject: string;
  body: string;
  status: QueueStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  delaySeconds: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type WhatsAppQueueItem = {
  id: string;
  userId: string;
  leadId: string;
  businessName?: string;
  phone: string;
  body: string;
  status: QueueStatus;
  scheduledAt?: string | null;
  sentAt?: string | null;
  delaySeconds: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type DiscoveredBusiness = {
  businessName: string;
  category: string;
  city: string;
  country: string;
  description?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
};
