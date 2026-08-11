import { Suspense } from "react";
import Settings from "@/app/container/pages/Settings";

export default function page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading settings...</div>}>
      <Settings />
    </Suspense>
  );
}
