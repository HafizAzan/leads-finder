import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";

export default function NotFound() {
  return (
    <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
      <div className="relative w-full max-w-md text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-6 h-32 w-32 -translate-x-1/2 rounded-full bg-purple-500/15 blur-3xl sm:top-8 sm:h-40 sm:w-40"
        />

        <div className="relative rounded-xl border border-border bg-card px-5 py-8 shadow-md sm:px-8 sm:py-12">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl border border-purple-500/25 bg-purple-500/10 sm:mb-6 sm:size-14">
            <SearchX className="size-5 text-purple-400 sm:size-6" strokeWidth={1.75} />
          </div>

          <Typography
            variants="span"
            text="404"
            className="mb-3 block font-mono text-xs! font-semibold tracking-[0.25em] text-purple-400 uppercase"
          />

          <Typography variants="h2" text="Page not found" className="mb-3 text-2xl! text-foreground sm:text-3xl!" />

          <Typography
            variants="p"
            text="This route doesn’t exist, or the lead you tried to open has moved. Head back to your leads list to keep going."
            className="mx-auto mb-6 max-w-sm text-sm! leading-relaxed sm:mb-8"
          />

          <Link href="/leads" className="inline-flex w-full sm:w-auto">
            <Button className="w-full bg-purple-600 border-purple-600 hover:bg-purple-500 hover:border-purple-500 hover:opacity-100 sm:w-auto">
              <ArrowLeft className="size-4" />
              Back to My Leads
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
