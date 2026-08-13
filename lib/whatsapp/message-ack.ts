export type MessageAckStatus = "pending" | "sent" | "delivered" | "read" | "played" | "error";

export function mapMessageAck(ack: number | undefined): MessageAckStatus {
  switch (ack) {
    case -1:
      return "error";
    case 1:
      return "sent";
    case 2:
      return "delivered";
    case 3:
      return "read";
    case 4:
      return "played";
    default:
      return "pending";
  }
}

/** Map WA ack to lead outreach sendStatus (played → read). */
export function ackToSendStatus(ack: number | undefined): "sent" | "delivered" | "read" | "failed" | null {
  const mapped = mapMessageAck(ack);
  if (mapped === "error") return "failed";
  if (mapped === "sent" || mapped === "pending") return "sent";
  if (mapped === "delivered") return "delivered";
  if (mapped === "read" || mapped === "played") return "read";
  return null;
}
