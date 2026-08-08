"use client";

import React, { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import Textarea from "@/app/components/ui/textarea";
import { useLeads } from "@/app/context/leads-context";
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
  const { addGeneratedLeads } = useLeads();
  const [form, setForm] = useState<GenerateLeadsForm>(initialForm);

  const updateField = (field: keyof GenerateLeadsForm) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addGeneratedLeads({
      category: form.category.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      leadLimit: Number(form.leadLimit) || 1,
      description: form.description.trim() || undefined,
    });
    router.push("/leads");
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
            text="Set your target market and lead limit. We’ll find matching businesses based on your filters."
            className="max-w-2xl text-sm!"
          />
        </div>

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
              max={500}
              value={form.leadLimit}
              onChange={updateField("leadLimit")}
              required
              hint="How many leads to generate (1–500)."
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
              className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground sm:min-w-28"
            />
            <Button
              type="submit"
              className="bg-purple-600 border-purple-600 hover:bg-purple-500 hover:border-purple-500 hover:opacity-100 sm:min-w-40"
            >
              <Sparkles className="size-4" />
              Generate Leads
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default React.memo(GenerateLeads);
