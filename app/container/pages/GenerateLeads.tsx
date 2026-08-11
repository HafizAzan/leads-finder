"use client";

import React, { FormEvent, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import Textarea from "@/app/components/ui/textarea";
import { ApiClientError, apiSend } from "@/lib/api/client";
import { Lead } from "@/types/lead";
import { useRouter } from "next/navigation";

type GenerateLeadsForm = {
  category: string;
  city: string;
  country: string;
  leadLimit: string;
  description: string;
};

const initialForm: GenerateLeadsForm = {
  category: "",
  city: "",
  country: "",
  leadLimit: "25",
  description: "",
};

function GenerateLeads() {
  const router = useRouter();
  const [form, setForm] = useState<GenerateLeadsForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof GenerateLeadsForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await apiSend<{ leads: Lead[]; source: string; warning?: string }>("/api/leads/generate", "POST", {
        category: form.category.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        limit: Number(form.leadLimit) || 1,
        description: form.description.trim() || undefined,
      });

      if (result.warning) {
        sessionStorage.setItem("leads-generate-warning", result.warning);
      }

      router.push("/leads");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to generate leads.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="w-full">
        <div className="mb-5 sm:mb-6">
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2.5 py-1">
            <Sparkles className="size-3.5 text-purple-400" />
            <Typography variants="span" text="AI Lead Finder" className="text-xs! font-medium text-purple-300" />
          </div>
          <Typography variants="h3" text="Generate new leads" className="mb-1.5 text-foreground" />
          <Typography
            variants="p"
            text="Uses Google Places first. If Places fails or the key is missing, manual fallback leads are created."
            className="max-w-2xl text-sm!"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              name="category"
              label="Category"
              placeholder="e.g. Dental Clinic, Software Company"
              value={form.category}
              onChange={updateField("category")}
              required
              autoComplete="off"
            />
            <Input
              name="city"
              label="City"
              placeholder="e.g. New York"
              value={form.city}
              onChange={updateField("city")}
              required
              autoComplete="address-level2"
            />
            <Input
              name="country"
              label="Country"
              placeholder="e.g. United States"
              value={form.country}
              onChange={updateField("country")}
              required
              autoComplete="country-name"
            />
            <Input
              name="leadLimit"
              type="number"
              label="Lead limit"
              placeholder="25"
              min={1}
              max={100}
              value={form.leadLimit}
              onChange={updateField("leadLimit")}
              required
              hint="How many leads to generate (1–100)."
            />
            <div className="sm:col-span-2">
              <Textarea
                name="description"
                label="Description"
                optional
                placeholder="Add extra targeting notes, niches, or exclusions..."
                value={form.description}
                onChange={updateField("description")}
                rows={4}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              label="Reset"
              onClick={() => setForm(initialForm)}
              disabled={loading}
              className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground sm:min-w-28"
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-purple-600 border-purple-600 hover:bg-purple-500 hover:border-purple-500 hover:opacity-100 sm:min-w-40"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate Leads
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default React.memo(GenerateLeads);
