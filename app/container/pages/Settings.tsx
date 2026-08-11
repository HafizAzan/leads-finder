"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import { ApiClientError, apiGet, apiSend } from "@/lib/api/client";
import { UserSettings } from "@/types/lead";
import { Loader2, Mail } from "lucide-react";

const fallbackSettings: UserSettings = {
  id: "local",
  emailProvider: "gmail",
  emailAddress: "",
  emailConnected: false,
  minDelay: 10,
  maxDelay: 90,
};

function Settings() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<UserSettings>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gmailParam = searchParams.get("gmail");
  const oauthMessage =
    gmailParam === "connected"
      ? `Gmail connected${searchParams.get("email") ? `: ${searchParams.get("email")}` : ""}.`
      : null;
  const oauthError = gmailParam === "error" ? searchParams.get("message") || "Gmail connection failed." : null;
  const bannerMessage = oauthMessage || message;
  const bannerError = oauthError || error;

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const data = await apiGet<UserSettings>("/api/settings");
        if (cancelled) return;
        setSettings(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gmailParam !== "connected") return;
    void apiGet<UserSettings>("/api/settings")
      .then((data) => setSettings(data))
      .catch(() => undefined);
  }, [gmailParam]);

  const statusLabel = useMemo(() => {
    return settings.emailConnected ? "Connected" : "Not Connected";
  }, [settings.emailConnected]);

  const statusClass = settings.emailConnected
    ? "text-green-400 border-green-500/20 bg-green-500/10"
    : "text-muted border-border bg-sidebar";

  const persistDelays = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiSend<UserSettings>("/api/settings", "PATCH", {
        minDelay: settings.minDelay,
        maxDelay: settings.maxDelay,
      });
      setSettings(data);
      setMessage("Delay settings saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiSend<UserSettings>("/api/settings", "PATCH", { disconnect: true });
      setSettings(data);
      setMessage("Gmail disconnected.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to disconnect Gmail.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="size-6 animate-spin text-purple-300" />
      </section>
    );
  }

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <Typography variants="h3" text="Settings" className="mb-1.5 text-foreground" />
          <Typography variants="p" text="Connect Gmail and configure send delays between emails." className="text-sm!" />
        </div>

        {(bannerError || bannerMessage) && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              bannerError ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-green-500/30 bg-green-500/10 text-green-300"
            }`}
          >
            {bannerError || bannerMessage}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10">
              <Mail className="size-4 text-purple-400" />
            </div>
            <Typography variants="h4" text="Email Settings" className="text-foreground" />
          </div>

          <div className="space-y-4">
            <div>
              <Typography variants="span" text="Provider" className="mb-1.5 block text-sm font-medium text-foreground" />
              <div className="rounded-lg border border-border bg-sidebar px-3 py-2.5 text-sm text-foreground">Gmail</div>
            </div>

            <div>
              <Typography variants="span" text="Connected Email" className="mb-1.5 block text-sm font-medium text-foreground" />
              <div className="rounded-lg border border-border bg-sidebar px-3 py-2.5 text-sm text-foreground">
                {settings.emailAddress || "No Gmail account connected"}
              </div>
            </div>

            <div>
              <Typography variants="span" text="Connection Status" className="mb-1.5 block text-sm font-medium text-foreground" />
              <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${statusClass}`}>
                {statusLabel}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              label="Disconnect Gmail"
              onClick={() => void disconnect()}
              disabled={!settings.emailConnected || saving}
              className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground"
            />
            <a
              href="/api/gmail/connect"
              className={`inline-flex items-center justify-center gap-2 rounded-lg border border-purple-600 bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-purple-500 hover:border-purple-500 ${
                saving ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <Mail className="size-4" />
              {settings.emailConnected ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <Typography variants="h4" text="Email Delay" className="mb-1 text-foreground" />
          <Typography
            variants="p"
            text="Each outgoing email waits a random delay between min and max seconds before the next send."
            className="mb-5 text-sm!"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Minimum Delay"
              type="number"
              min={0}
              value={settings.minDelay}
              onChange={(event) => setSettings((prev) => ({ ...prev, minDelay: Number(event.target.value) }))}
              onBlur={() => void persistDelays()}
              hint="Seconds"
            />
            <Input
              label="Maximum Delay"
              type="number"
              min={settings.minDelay}
              value={settings.maxDelay}
              onChange={(event) => setSettings((prev) => ({ ...prev, maxDelay: Number(event.target.value) }))}
              onBlur={() => void persistDelays()}
              hint="Seconds"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(Settings);
