"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Typography from "@/app/components/ui/typography";
import Button from "@/app/components/ui/button";
import Input from "@/app/components/ui/input";
import { ApiClientError, apiGet, apiSend } from "@/lib/api/client";
import { UserSettings } from "@/types/lead";
import type { WhatsAppConnectionState } from "@/lib/whatsapp/types";
import { Loader2, Mail, MessageCircle } from "lucide-react";

const fallbackSettings: UserSettings = {
  id: "local",
  emailProvider: "gmail",
  emailAddress: "",
  emailConnected: false,
  minDelay: 10,
  maxDelay: 90,
  whatsappConnected: false,
  whatsappDisplayNumber: "",
  whatsappMinDelay: 10,
  whatsappMaxDelay: 90,
};

function waStatusLabel(status: WhatsAppConnectionState["status"] | "unknown") {
  switch (status) {
    case "ready":
      return "Connected";
    case "qr":
      return "Scan QR";
    case "initializing":
      return "Starting…";
    case "authenticated":
      return "Syncing…";
    case "error":
      return "Error";
    case "disconnected":
    default:
      return "Not Connected";
  }
}

function Settings() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<UserSettings>(fallbackSettings);
  const [waState, setWaState] = useState<WhatsAppConnectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
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

  const refreshWaStatus = useCallback(async () => {
    try {
      const state = await apiGet<WhatsAppConnectionState>("/api/whatsapp/status");
      setWaState(state);
      if (state.status === "ready" && state.phoneNumber) {
        setSettings((prev) => ({
          ...prev,
          whatsappConnected: true,
          whatsappDisplayNumber: state.phoneNumber || prev.whatsappDisplayNumber,
        }));
      }
      return state;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchSettings() {
      try {
        const data = await apiGet<UserSettings>("/api/settings");
        if (cancelled) return;
        setSettings(data);
        setError(null);
        await refreshWaStatus();
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
  }, [refreshWaStatus]);

  useEffect(() => {
    if (gmailParam !== "connected") return;
    void apiGet<UserSettings>("/api/settings")
      .then((data) => setSettings(data))
      .catch(() => undefined);
  }, [gmailParam]);

  // Poll while connecting / QR / syncing
  useEffect(() => {
    const status = waState?.status;
    const shouldPoll =
      connecting || status === "initializing" || status === "qr" || status === "authenticated";
    if (!shouldPoll) return;

    const id = window.setInterval(() => {
      void refreshWaStatus().then((state) => {
        if (state?.status === "ready") {
          setConnecting(false);
          setMessage(`WhatsApp connected${state.phoneNumber ? `: +${state.phoneNumber}` : ""}.`);
        }
        if (state?.status === "error") {
          setConnecting(false);
          setError(state.error || "WhatsApp connection failed.");
        }
      });
    }, 2000);

    return () => window.clearInterval(id);
  }, [connecting, waState?.status, refreshWaStatus]);

  const emailStatusLabel = useMemo(() => {
    return settings.emailConnected ? "Connected" : "Not Connected";
  }, [settings.emailConnected]);

  const liveStatus = waState?.status || (settings.whatsappConnected ? "ready" : "disconnected");
  const isWaReady = liveStatus === "ready";
  const whatsappStatusLabel = waStatusLabel(liveStatus);

  const connectedClass = "text-green-400 border-green-500/20 bg-green-500/10";
  const pendingClass = "text-amber-300 border-amber-500/20 bg-amber-500/10";
  const disconnectedClass = "text-muted border-border bg-sidebar";
  const statusBadgeClass = isWaReady
    ? connectedClass
    : liveStatus === "qr" || liveStatus === "initializing" || liveStatus === "authenticated"
      ? pendingClass
      : disconnectedClass;

  const persistEmailDelays = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiSend<UserSettings>("/api/settings", "PATCH", {
        minDelay: settings.minDelay,
        maxDelay: settings.maxDelay,
      });
      setSettings(data);
      setMessage("Email delay settings saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const persistWhatsAppSettings = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiSend<UserSettings>("/api/settings", "PATCH", {
        whatsappMinDelay: settings.whatsappMinDelay,
        whatsappMaxDelay: settings.whatsappMaxDelay,
      });
      setSettings(data);
      setMessage("WhatsApp delay settings saved.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save WhatsApp settings.");
    } finally {
      setSaving(false);
    }
  };

  const connectWhatsApp = async (forceNewQr = false) => {
    setConnecting(true);
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const state = await apiSend<WhatsAppConnectionState>("/api/whatsapp/connect", "POST", {
        forceNewQr,
        restore: !forceNewQr,
      });
      setWaState(state);
      if (state.status === "ready") {
        setConnecting(false);
        setMessage(`WhatsApp connected${state.phoneNumber ? `: +${state.phoneNumber}` : ""}.`);
        setSettings((prev) => ({
          ...prev,
          whatsappConnected: true,
          whatsappDisplayNumber: state.phoneNumber || prev.whatsappDisplayNumber,
        }));
      } else if (state.status === "error") {
        setConnecting(false);
        setError(state.error || "Failed to start WhatsApp.");
      } else {
        setMessage("WhatsApp starting — scan QR when it appears.");
      }
    } catch (err) {
      setConnecting(false);
      setError(err instanceof ApiClientError ? err.message : "Failed to connect WhatsApp.");
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

  const disconnectWhatsApp = async () => {
    setSaving(true);
    setConnecting(false);
    setError(null);
    setMessage(null);
    try {
      const state = await apiSend<WhatsAppConnectionState>("/api/whatsapp/disconnect", "POST", {
        removeSession: true,
      });
      setWaState(state);
      setSettings((prev) => ({
        ...prev,
        whatsappConnected: false,
        whatsappDisplayNumber: "",
      }));
      setMessage("WhatsApp disconnected.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to disconnect WhatsApp.");
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

  const displayNumber =
    waState?.phoneNumber || settings.whatsappDisplayNumber
      ? `+${waState?.phoneNumber || settings.whatsappDisplayNumber}`
      : "No mobile connected yet";

  return (
    <section className="px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        <div>
          <Typography variants="h3" text="Settings" className="mb-1.5 text-foreground" />
          <Typography
            variants="p"
            text="Connect Gmail for email outreach, and link WhatsApp Web via QR for WhatsApp messages."
            className="text-sm!"
          />
        </div>

        {(bannerMessage || bannerError) && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm ${
              bannerError
                ? "border-red-500/30 bg-red-500/10 text-red-300"
                : "border-green-500/30 bg-green-500/10 text-green-300"
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
              <div
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${
                  settings.emailConnected ? connectedClass : disconnectedClass
                }`}
              >
                {emailStatusLabel}
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
              onBlur={() => void persistEmailDelays()}
              hint="Seconds"
            />
            <Input
              label="Maximum Delay"
              type="number"
              min={settings.minDelay}
              value={settings.maxDelay}
              onChange={(event) => setSettings((prev) => ({ ...prev, maxDelay: Number(event.target.value) }))}
              onBlur={() => void persistEmailDelays()}
              hint="Seconds"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10">
              <MessageCircle className="size-4 text-purple-400" />
            </div>
            <div>
              <Typography variants="h4" text="Connect Mobile (WhatsApp Web)" className="text-foreground" />
              <Typography
                variants="span"
                text="whatsapp-web.js — phone pe WhatsApp scan karke shared session link karo"
                className="text-xs! text-muted"
              />
            </div>
          </div>

          <div className="mb-5 rounded-lg border border-border bg-sidebar/40 px-3 py-3 sm:px-4">
            <Typography variants="span" text="Kaise connect karein" className="mb-2 block text-sm font-medium text-foreground" />
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
              <li>
                <span className="text-foreground">Connect / Show QR</span> dabao — server Chrome session start karega
              </li>
              <li>
                Phone pe WhatsApp → Linked devices → <span className="text-foreground">Link a device</span>
              </li>
              <li>Neeche QR scan karo; status Connected ho jaye to outreach ready</li>
              <li>Session local disk pe save hoti hai (`data/.wwebjs_auth`) — restart ke baad Restore try karo</li>
            </ol>
            <p className="mt-3 text-xs text-muted">
              Note: Yeh Meta Cloud API nahi hai. Ek shared WhatsApp number se saari outreach jati hai. Local/long-running
              Node process chahiye (serverless pe reliable nahi).
            </p>
          </div>

          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Typography variants="span" text="Connected mobile" className="mb-1.5 block text-sm font-medium text-foreground" />
                <div className="rounded-lg border border-border bg-sidebar px-3 py-2.5 text-sm text-foreground">
                  {displayNumber}
                </div>
              </div>
              <div>
                <Typography variants="span" text="Connection status" className="mb-1.5 block text-sm font-medium text-foreground" />
                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide ${statusBadgeClass}`}
                >
                  {whatsappStatusLabel}
                  {typeof waState?.syncPercent === "number" ? ` ${waState.syncPercent}%` : ""}
                </div>
              </div>
            </div>

            {waState?.qrCodeDataUrl && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-sidebar/50 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={waState.qrCodeDataUrl} alt="WhatsApp QR code" className="size-56 rounded-md bg-white p-2" />
                <Typography variants="span" text="Phone se yeh QR scan karo" className="text-xs! text-muted" />
              </div>
            )}

            {waState?.error && (
              <p className="text-sm text-red-300">{waState.error}</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              label="Disconnect Mobile"
              onClick={() => void disconnectWhatsApp()}
              disabled={(!isWaReady && liveStatus === "disconnected") || saving}
              className="border-border bg-transparent text-muted hover:bg-sidebar hover:text-foreground"
            />
            <Button
              type="button"
              onClick={() => void connectWhatsApp(isWaReady)}
              disabled={saving || connecting}
              className="bg-purple-600 border-purple-600"
            >
              {(saving || connecting) && liveStatus !== "ready" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageCircle className="size-4" />
              )}
              {isWaReady ? "Reconnect (new QR)" : connecting || liveStatus === "qr" ? "Waiting…" : "Connect / Show QR"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-md sm:p-6">
          <Typography variants="h4" text="WhatsApp send delay" className="mb-1 text-foreground" />
          <Typography
            variants="p"
            text="AI queue har WhatsApp message se pehle random delay wait karti hai (email jaisa)."
            className="mb-5 text-sm!"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Minimum Delay"
              type="number"
              min={0}
              value={settings.whatsappMinDelay}
              onChange={(event) => setSettings((prev) => ({ ...prev, whatsappMinDelay: Number(event.target.value) }))}
              onBlur={() => void persistWhatsAppSettings()}
              hint="Seconds"
            />
            <Input
              label="Maximum Delay"
              type="number"
              min={settings.whatsappMinDelay}
              value={settings.whatsappMaxDelay}
              onChange={(event) => setSettings((prev) => ({ ...prev, whatsappMaxDelay: Number(event.target.value) }))}
              onBlur={() => void persistWhatsAppSettings()}
              hint="Seconds"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(Settings);
