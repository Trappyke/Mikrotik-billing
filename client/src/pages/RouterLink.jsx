import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Router,
  Copy,
  Check,
  Key,
  Terminal,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useToastStore } from "../stores/toastStore";
import { getToken } from "../lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";

const API = import.meta.env.VITE_API_URL || "/api";

export default function RouterLink() {
  const toast = useToastStore();
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [appUrl, setAppUrl] = useState(window.location.origin);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    fetchTenant();
    if (apiKey) setPolling(true);
  }, []);

  // Auto-start polling when apiKey becomes available
  useEffect(() => { if (apiKey) setPolling(true); }, [apiKey]);

  const fetchTenant = async () => {
    try {
      const token = getToken();
      const { data } = await axios.get(`${API}/tenants/current`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenantId(data.id);
      if (data.settings?.api_key) {
        setApiKey(data.settings.api_key);
      }
    } catch (e) {
      toast.error("Failed to load tenant");
    } finally {
      setLoading(false);
    }
  };

  const generateKey = async () => {
    setGenerating(true);
    try {
      const token = getToken();
      const key =
        "mtk-" +
        Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join(
          "",
        );
      await axios.put(
        `${API}/tenants/${tenantId}`,
        { settings: { api_key: key } },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setApiKey(key);
    setPolling(true);
      toast.success("API key generated");
    } catch (e) {
      toast.error("Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const copyCommand = () => {
    const cmd = `/tool fetch url="${appUrl}/api/router/v1/scripts/install" http-header-field="Authorization: Bearer ${apiKey}" dst-path="install.rsc" mode=https\r\n:delay 2s\r\n/import file-name="install.rsc"\r\n:delay 1s\r\n/file remove "install.rsc"`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  };

  const checkConnection = async () => {
    try {
      const token = getToken();
      const { data } = await axios.get(API + "/router/v1/status", {
        headers: { Authorization: "Bearer " + apiKey },
      });
      setConnectionStatus(data);
    } catch (e) {}
  };

  useEffect(() => {
    if (apiKey && polling) {
      checkConnection();
      const interval = setInterval(checkConnection, 5000);
      return () => clearInterval(interval);
    }
  }, [apiKey, polling]);

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Router className="w-6 h-6 text-blue-400" />
          Link MikroTik Router
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          One command to connect your MikroTik router to your billing system
        </p>
      </div>

      {/* API Key Card */}
      <Card className="bg-zinc-900/60 border-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            Your API Key
          </CardTitle>
          <CardDescription>
            This key authenticates your router with the billing server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiKey ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-amber-400 font-mono break-all">
                {apiKey}
              </code>
              <Button
                variant="outline"
                onClick={copyApiKey}
                className="gap-2 border-zinc-700/50 text-zinc-300 shrink-0"
              >
                <Copy className="w-4 h-4" /> Copy
              </Button>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">
              No API key yet. Generate one to get started.
            </p>
          )}
          <Button onClick={generateKey} disabled={generating} className="gap-2">
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Key className="w-4 h-4" />
            )}
            {apiKey ? "Regenerate API Key" : "Generate API Key"}
          </Button>
        </CardContent>
      </Card>

      {/* Connection Status Card */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <div
                className={
                  "w-3 h-3 rounded-full " +
                  (connectionStatus?.connected
                    ? "bg-green-500 animate-pulse"
                    : polling
                      ? "bg-amber-500 animate-pulse"
                      : "bg-zinc-600")
                }
              />
              {connectionStatus?.connected
                ? "Router Connected"
                : polling
                  ? "Waiting for connection..."
                  : "Connection Status"}
            </CardTitle>
            <CardDescription>
              {connectionStatus?.connected
                ? "Last seen: " +
                  new Date(connectionStatus.lastSeen).toLocaleString() +
                  (connectionStatus.ip ? " from " + connectionStatus.ip : "")
                : polling
                  ? "Run the installation command on your MikroTik router"
                  : "Click Start Monitoring to check for router connection"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!polling && !connectionStatus?.connected && (
              <Button onClick={() => setPolling(true)} className="gap-2 w-full">
                Start Monitoring
              </Button>
            )}
            {polling && !connectionStatus?.connected && (
              <div className="flex items-center gap-3 text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">
                  Listening for router connection... Run the command on your
                  MikroTik now.
                </span>
              </div>
            )}
            {connectionStatus?.connected && (
              <div className="flex items-center gap-3 text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Router linked successfully! You can now manage it from the
                  dashboard.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Installation Command Card */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-green-400" />
              Installation Command
            </CardTitle>
            <CardDescription>
              Copy and paste this into your MikroTik terminal (SSH or Winbox)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-zinc-950 border border-zinc-700/50 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {`/tool fetch url="${appUrl}/api/router/v1/scripts/install" http-header-field="Authorization: Bearer ${apiKey}" dst-path="install.rsc" mode=https
:delay 2s
/import file-name="install.rsc"
:delay 1s
/file remove "install.rsc"`}
            </pre>
            <Button onClick={copyCommand} className="gap-2 w-full">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* What This Does */}
      <Card className="bg-zinc-900/60 border-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-white">
            What this configures on your router
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              RADIUS client pointing to your billing server for PPPoE/Hotspot
              auth
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              PPPoE server on bridge1 with RADIUS authentication
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              Hotspot server with RADIUS profile
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              Firewall rule allowing billing API access
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              Auto-sync scheduler every 5 minutes
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
