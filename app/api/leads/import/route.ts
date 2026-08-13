import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { AppError } from "@/lib/api/errors";
import { handleApiError, ok } from "@/lib/api/response";
import { importLeadsFromCsv } from "@/services/import-leads.service";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    const contentType = req.headers.get("content-type") || "";

    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        throw new AppError("CSV_FILE_REQUIRED", "Please upload a CSV file.", 400);
      }

      if (!file.name.toLowerCase().endsWith(".csv") && file.type && !file.type.includes("csv") && file.type !== "text/plain") {
        throw new AppError("CSV_INVALID_TYPE", "Only CSV files are supported.", 400);
      }

      if (file.size > MAX_FILE_BYTES) {
        throw new AppError("CSV_TOO_LARGE", "CSV file must be 2MB or smaller.", 400);
      }

      csvText = await file.text();
    } else {
      const body = (await req.json().catch(() => null)) as { csv?: string } | null;
      csvText = body?.csv?.trim() || "";
      if (!csvText) {
        throw new AppError("CSV_FILE_REQUIRED", "Please upload a CSV file or provide csv text.", 400);
      }
    }

    const result = await importLeadsFromCsv(user.id, csvText);
    return ok(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
