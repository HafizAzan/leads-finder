import { NextResponse } from "next/server";
import { AppError, isAppError } from "./errors";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (isAppError(error)) {
    return fail(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    return fail("INVALID_INPUT", error.issues[0]?.message || "Invalid request input.", 400);
  }

  console.error("[api-error]", error);

  const message = error instanceof Error ? error.message : "Unexpected server error.";

  if (message.includes("Firebase Admin is not configured")) {
    return fail("FIREBASE_NOT_CONFIGURED", message, 500);
  }

  if (message.includes("OPENAI_API_KEY")) {
    return fail("OPENAI_NOT_CONFIGURED", message, 500);
  }

  // Surface Firestore setup issues instead of generic INTERNAL_ERROR
  if (message.includes("Cloud Firestore is not created") || message.includes("FIRESTORE_NOT_FOUND")) {
    return fail("FIRESTORE_NOT_FOUND", message, 503);
  }

  const code =
    typeof error === "object" && error && "code" in error ? Number((error as { code?: number }).code) : undefined;
  if (code === 5 || message.includes("5 NOT_FOUND")) {
    return fail(
      "FIRESTORE_NOT_FOUND",
      "Cloud Firestore is not created for this Firebase project. Open Firebase Console → Build → Firestore Database → Create database, then retry.",
      503,
    );
  }

  return fail("INTERNAL_ERROR", "Something went wrong.", 500);
}

export function assertFound<T>(value: T | null | undefined, message = "Resource not found."): T {
  if (value == null) {
    throw new AppError("NOT_FOUND", message, 404);
  }
  return value;
}
