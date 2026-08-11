import { AppError } from "@/lib/api/errors";

export function mapFirebaseError(error: unknown): never {
  const code =
    typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : undefined;
  const message = error instanceof Error ? error.message : "Firebase request failed.";

  // gRPC 5 NOT_FOUND usually means Firestore database was never created in this project.
  if (code === 5 || message.includes("NOT_FOUND")) {
    throw new AppError(
      "FIRESTORE_NOT_FOUND",
      "Cloud Firestore is not created for this Firebase project. Open Firebase Console → Build → Firestore Database → Create database (start in test/production mode), then retry.",
      503,
    );
  }

  if (code === 7 || message.toLowerCase().includes("permission")) {
    throw new AppError(
      "FIRESTORE_PERMISSION_DENIED",
      "Firebase Admin does not have permission for Firestore. Check the service account and that Firestore is enabled.",
      403,
    );
  }

  if (message.includes("Could not load the default credentials") || message.includes("invalid_grant")) {
    throw new AppError(
      "FIREBASE_AUTH_INVALID",
      "Firebase Admin credentials are invalid. Recheck FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
      500,
    );
  }

  throw error instanceof Error ? error : new Error(message);
}
