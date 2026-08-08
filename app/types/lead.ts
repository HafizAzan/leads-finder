export type Lead = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  country: string;
  email?: string;
  phone?: string;
  description?: string;
  contactChannel: "email" | "phone";
  aiReview: {
    status: "pending" | "approved" | "warning";
    issues: string[];
  };
  outreach: {
    channel: "email" | "phone";
    subject: string;
    body: string;
    status: "not_generated" | "generated" | "ready" | "queued" | "sending" | "sent" | "failed";
    approval: "pending" | "approved";
    sendStatus: "not_sent" | "queued" | "sending" | "sent" | "failed" | "skipped";
  };
};

export type QueueItem = {
  leadId: string;
  businessName: string;
  email: string;
  status: "queued" | "sending" | "sent" | "failed";
  delaySec: number;
};

export type EmailProvider = "gmail" | "smtp";
export type ConnectionStatus = "not_connected" | "connecting" | "connected";

export type EmailSettings = {
  provider: EmailProvider;
  emailAddress: string;
  connectionStatus: ConnectionStatus;
  minDelay: number;
  maxDelay: number;
};
