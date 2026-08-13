"use client";

import React, { useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import Modal from "@/app/components/ui/modal";
import Button from "@/app/components/ui/button";
import Typography from "@/app/components/ui/typography";
import { ApiClientError, apiUpload } from "@/lib/api/client";
import { Lead } from "@/types/lead";

export type CsvImportResult = {
  imported: number;
  skipped: number;
  leads: Lead[];
  errors: Array<{ row: number; message: string }>;
};

type CsvUploadModalProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onImported: (result: CsvImportResult) => void;
};

const SAMPLE_HEADERS =
  "businessName,category,city,country,email,phone,website,address,description";

function CsvUploadModal({ open, busy = false, onClose, onImported }: CsvUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setError(null);
    setResult(null);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    if (uploading || busy) return;
    reset();
    onClose();
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] || null;
    setResult(null);
    setError(null);

    if (!next) {
      setFile(null);
      return;
    }

    if (!next.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Please select a .csv file.");
      return;
    }

    if (next.size > 2 * 1024 * 1024) {
      setFile(null);
      setError("CSV file must be 2MB or smaller.");
      return;
    }

    setFile(next);
  };

  const onUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiUpload<CsvImportResult>("/api/leads/import", formData);
      setResult(data);
      onImported(data);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to import CSV.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Upload CSV"
      description="Import leads from a CSV file. Required columns: businessName, category, city, country."
      size="lg"
      closeOnOverlayClick={!uploading}
      footer={
        <>
          <Button onClick={handleClose} disabled={uploading} className="flex-1 sm:flex-none">
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={() => void onUpload()}
              disabled={!file || uploading}
              className="flex-1 bg-purple-600 border-purple-600 sm:flex-none"
            >
              {uploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  Import Leads
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-sidebar/40 px-4 py-6 text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10">
            <FileUp className="size-5 text-purple-300" />
          </div>
          <Typography
            variants="p"
            text={file ? file.name : "Choose a CSV file to upload"}
            className="mb-3 text-sm! text-foreground"
          />
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFileChange}
            disabled={uploading}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="mx-auto"
          >
            {file ? "Change file" : "Select CSV"}
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-sidebar/20 px-3 py-3">
          <Typography variants="span" text="Expected headers" className="mb-1.5 block text-xs font-medium text-muted" />
          <code className="block overflow-x-auto whitespace-nowrap text-xs text-foreground/80">{SAMPLE_HEADERS}</code>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
            <Typography
              variants="p"
              text={`Imported ${result.imported} lead${result.imported === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped}` : ""}.`}
              className="text-sm! text-emerald-200"
            />
            {result.errors.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto text-left text-xs text-amber-200/90">
                {result.errors.map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Row {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default React.memo(CsvUploadModal);
