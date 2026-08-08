"use client";

import React, { useMemo } from "react";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import Select from "@/app/components/ui/select";
import { useSettings } from "@/app/context/settings-context";
import { Loader2, Mail } from "lucide-react";
import { EmailProvider } from "@/app/types/lead";

function Settings() {
  const { settings, setProvider, setEmailAddress, setMinDelay, setMaxDelay, connectEmail, disconnectEmail } = useSettings();

  const statusLabel = useMemo(() => {
    if (settings.connectionStatus === "connected") return "Connected";
    if (settings.connectionStatus === "connecting") return "Connecting...";
    return "Not Connected";
  }, [settings.connectionStatus]);

  const statusClass =
    settings.connectionStatus === "connected"
      ? "text-green-400 border-green-500/20 bg-green-500/10"
      : settings.connectionStatus === "connecting"
        ? "text-yellow-300 border-yellow-500/20 bg-yellow-500/10"
        : "text-muted border-border bg-sidebar";

  const delayError =
    settings.minDelay < 0
      ? "Minimum delay cannot be negative."
      : settings.maxDelay < settings.minDelay
        ? "Maximum delay cannot be smaller than minimum."
        : "";

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="w-full space-y-5">
        <div>
          <Typography variants="h3" text="Settings" className="mb-1.5 text-foreground" />
          <Typography variants="p" text="Configure mock email connection and send delays for the frontend workflow." className="text-sm!" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10">
              <Mail className="size-4 text-purple-400" />
            </div>
            <Typography variants="h4" text="Email Settings" className="text-foreground" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Email Provider"
              name="provider"
              value={settings.provider}
              onChange={(event) => setProvider(event.target.value as EmailProvider)}
              options={[
                { label: "Gmail", value: "gmail" },
                { label: "SMTP", value: "smtp" },
              ]}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              value={settings.emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
            />

            <div className="sm:col-span-2">
              <Typography variants="span" text="Connection Status" className="mb-1.5 block text-sm font-medium text-foreground" />
              <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${statusClass}`}>
                {settings.connectionStatus === "connecting" && <Loader2 className="mr-2 size-3.5 animate-spin" />}
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              label="Disconnect Email"
              onClick={disconnectEmail}
              disabled={settings.connectionStatus === "not_connected"}
              className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground"
            />
            <Button
              type="button"
              onClick={connectEmail}
              disabled={settings.connectionStatus === "connecting" || !settings.emailAddress.trim()}
              className="bg-purple-600 border-purple-600 hover:bg-purple-500 hover:border-purple-500 hover:opacity-100"
            >
              {settings.connectionStatus === "connecting" ? <Loader2 className="size-4 animate-spin" /> : null}
              Connect Email
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <Typography variants="h4" text="Email Delay" className="mb-1 text-foreground" />
          <Typography
            variants="p"
            text="Emails will be sent with a random delay between the minimum and maximum values."
            className="mb-5 text-sm!"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Minimum Delay"
              type="number"
              min={0}
              value={settings.minDelay}
              onChange={(event) => setMinDelay(Number(event.target.value))}
              hint="Seconds"
              error={settings.minDelay < 0 ? "Minimum cannot be negative." : undefined}
            />
            <Input
              label="Maximum Delay"
              type="number"
              min={settings.minDelay}
              value={settings.maxDelay}
              onChange={(event) => setMaxDelay(Number(event.target.value))}
              hint="Seconds"
              error={settings.maxDelay < settings.minDelay ? "Maximum cannot be smaller than minimum." : undefined}
            />
          </div>

          {delayError ? <p className="mt-3 text-xs text-red-400">{delayError}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default React.memo(Settings);
