import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Router,
  Copy,
  Check,
  Key,
  Terminal,
  Loader2,
  Shield,
  User,
  Lock,
  Wifi,
  ArrowRight,
  AlertCircle,
  Link2,
  Plug,
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
  const [appUrl, setAppUrl] = useState(
    () => localStorage.getItem("router_link_app_url") || window.location.origin
  );
  const [mgmtUser, setMgmtUser] = useState(
    () => localStorage.getItem("router_link_mgmt_user") || "admin"
  );
  const [mgmtPass, setMgmtPass] = useState("");
  const [mgmtPort, setMgmtPort] = useState("8728");
  const [showCredentials, setShowCredentials] = useState(false);

  const handleAppUrlChange = (e) => {
    const val = e.target.value;
    setAppUrl(val);
    localStorage.setItem("router_link_app_url", val);
  };

  const [connectionStatus, setConnectionStatus] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, []);

  useEffect(() => {
    if (apiKey) setPolling(true);
  }, [apiKey]);

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
        `${API}/tenants/${tenantId}/api-key`,
        { api_key: key },
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

  const buildCommand = () => {
    const mode = appUrl.startsWith("https") ? "https" : "http";
    const certFlag = appUrl.startsWith("https") ? " check-certificate=no" : "";
    let prefix = "";

    if (mgmtUser && mgmtPass) {
      prefix = `:global ztpMgmtUser "${mgmtUser}"; :global ztpMgmtPass "${mgmtPass}"; `;
    }

    return `${prefix}/tool fetch url="${appUrl}/api/router/v1/scripts/install" http-header-field="Authorization: Bearer ${apiKey}" dst-path=install.rsc mode=${mode}${certFlag}; :delay 4s; /import file-name=install.rsc; :delay 1s; /file remove install.rsc`;
  };

  const copyCommand = () => {
    localStorage.setItem("router_link_mgmt_user", mgmtUser);
    navigator.clipboard.writeText(buildCommand());
    setCopied(true);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleUpgrade = async () => {
    if (!mgmtUser || !mgmtPass) {
      toast.error("Enter management username and password first");
      return;
    }
    if (!connectionStatus?.router?.mac) {
      toast.error("Router MAC address not available. Wait for the router to connect first.");
      return;
    }

    setIsUpgrading(true);
    try {
      const { data } = await axios.put(
        `${API}/router/v1/upgrade`,
        {
          mac: connectionStatus.router.mac,
          username: mgmtUser,
          password: mgmtPass,
          port: mgmtPort,
          connection_type: "api",
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      );
      toast.success("Router upgraded to full management");
      localStorage.setItem("router_link_mgmt_user", mgmtUser);
      // Refresh status
      checkConnection();
    } catch (e) {
      toast.error(e.response?.data?.error || "Upgrade failed");
    } finally {
      setIsUpgrading(false);
    }
  };

  const checkConnection = async () => {
    try {
      const { data } = await axios.get(API + "/router/v1/status", {
        headers: { Authorization: "Bearer " + apiKey },
      });
      setConnectionStatus(data);
    } catch (e) {
      console.error("[RouterLink] Status check failed:", e.message);
    }
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

  const isLinked = connectionStatus?.connected && connectionStatus?.router?.has_connection;

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

      {/* Step 1: API Key */}
      <Card className="bg-zinc-900/60 border-zinc-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span>
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

      {/* Step 2: Management Credentials */}
      {apiKey && (
        <Card className={`bg-zinc-900/60 border-zinc-800/50 ${showCredentials ? "" : "opacity-70"}`}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span>
              Management Credentials
              {!showCredentials && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">Recommended</span>
              )}
            </CardTitle>
            <CardDescription>
              {showCredentials
                ? "So the billing system can manage your router (sync PPPoE, push scripts, monitor)"
                : "Add credentials for full router management. The router will still link without them."}
            </CardDescription>
          </CardHeader>
          {showCredentials && (
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Router Username</label>
                <input
                  type="text"
                  value={mgmtUser}
                  onChange={(e) => setMgmtUser(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Router Password</label>
                <input
                  type="password"
                  value={mgmtPass}
                  onChange={(e) => setMgmtPass(e.target.value)}
                  placeholder="Enter router admin password"
                  className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">API Port</label>
                <input
                  type="text"
                  value={mgmtPort}
                  onChange={(e) => setMgmtPort(e.target.value)}
                  placeholder="8728"
                  className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <p className="text-xs text-zinc-500 mt-1">Default MikroTik API port is 8728</p>
              </div>
            </CardContent>
          )}
          {!showCredentials && (
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setShowCredentials(true)}
                className="gap-2 border-zinc-700/50 text-zinc-300"
              >
                <Shield className="w-4 h-4" />
                Add Credentials (For Full Management)
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 3: Installation Command */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">3</span>
              Run on Your MikroTik
            </CardTitle>
            <CardDescription>
              Paste this single command into your MikroTik terminal (SSH or Winbox). It runs immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                Server URL
              </label>
              <input
                type="text"
                value={appUrl}
                onChange={handleAppUrlChange}
                placeholder="https://your-server.com"
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Your server URL. The MikroTik router must be able to reach this address.
              </p>
            </div>

            {mgmtUser && mgmtPass && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  Management credentials included. The router will automatically be linked for full management when it reports in.
                </p>
              </div>
            )}

            {!mgmtPass && (
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-400">
                  No management credentials set. The router will link but you won't be able to sync PPPoE or push scripts until you{" "}
                  <button onClick={() => setShowCredentials(true)} className="text-blue-400 hover:underline">add credentials</button>.
                </p>
              </div>
            )}

            <pre className="bg-zinc-950 border border-zinc-700/50 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
              {buildCommand()}
            </pre>
            <p className="text-xs text-zinc-500">
              Run Step 0 first if you set credentials above. Then run Steps 1-3 in order.
            </p>
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

      {/* Step 4: Connection Status */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span>
              Connection Status
            </CardTitle>
            <CardDescription>
              {isLinked
                ? "Router is fully linked and manageable"
                : connectionStatus?.connected
                  ? "Router is connected. Add credentials for full management."
                  : "Waiting for your router to report in..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status indicator */}
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${
                  isLinked
                    ? "bg-green-500 shadow-lg shadow-green-500/30"
                    : connectionStatus?.connected
                      ? "bg-green-500 animate-pulse"
                      : polling
                        ? "bg-amber-500 animate-pulse"
                        : "bg-zinc-600"
                }`}
              />
              <span className="text-sm text-zinc-300">
                {isLinked
                  ? "Fully Linked & Managed"
                  : connectionStatus?.connected
                    ? "Router Connected"
                    : polling
                      ? "Listening..."
                      : "Not Monitoring"}
              </span>
            </div>

            {/* Connection details */}
            {connectionStatus?.router && (
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Router className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium">{connectionStatus.router.name}</span>
                  <span className="text-zinc-500">({connectionStatus.router.model || "Unknown"})</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>MAC: {connectionStatus.router.mac}</span>
                  <span>IP: {connectionStatus.router.ip}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {connectionStatus.router.has_connection ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Check className="w-3 h-3" /> Fully managed (API connection active)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <AlertCircle className="w-3 h-3" /> Not yet manageable — credentials needed
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Last seen */}
            {connectionStatus?.lastSeen && (
              <p className="text-xs text-zinc-500">
                Last seen: {new Date(connectionStatus.lastSeen).toLocaleString()}
                {connectionStatus.ip ? ` from ${connectionStatus.ip}` : ""}
              </p>
            )}

            {/* Upgrade button for linked-but-not-managed routers */}
            {connectionStatus?.connected && !connectionStatus?.router?.has_connection && (
              <Card className="bg-amber-500/5 border-amber-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Plug className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-amber-300 font-medium">Upgrade to Full Management</p>
                      <p className="text-xs text-amber-400/70 mt-1">
                        Your router is linked but not yet manageable. Add credentials to unlock PPPoE sync, script push, and monitoring.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      value={mgmtUser}
                      onChange={(e) => setMgmtUser(e.target.value)}
                      placeholder="Router username (usually admin)"
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={mgmtPass}
                        onChange={(e) => setMgmtPass(e.target.value)}
                        placeholder="Router admin password"
                        className="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                      <input
                        type="text"
                        value={mgmtPort}
                        onChange={(e) => setMgmtPort(e.target.value)}
                        placeholder="8728"
                        className="w-20 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                    <Button
                      onClick={handleUpgrade}
                      disabled={isUpgrading || !mgmtUser || !mgmtPass}
                      className="gap-2 w-full bg-amber-500 hover:bg-amber-600 text-black"
                    >
                      {isUpgrading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2 className="w-4 h-4" />
                      )}
                      {isUpgrading ? "Upgrading..." : "Upgrade to Full Management"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Waiting state */}
            {polling && !connectionStatus?.connected && (
              <div className="flex items-center gap-3 text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">
                  Listening for router connection... Run the command on your MikroTik now.
                </span>
              </div>
            )}

            {connectionStatus?.connected && isLinked && (
              <div className="flex items-center gap-3 text-green-400">
                <Check className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Router fully linked and managed! You can now sync PPPoE, push scripts, and monitor this router.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* What This Does */}
      {apiKey && (
        <Card className="bg-zinc-900/60 border-zinc-800/50">
          <CardHeader>
            <CardTitle className="text-white">
              What this configures on your router
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                RADIUS client pointing to your billing server for PPPoE/Hotspot auth
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                PPPoE server on bridge1 with RADIUS authentication
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Hotspot server with RADIUS profile
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Firewall rule allowing billing API access
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-0.5">&#10003;</span>
                Auto-sync scheduler every 5 minutes
              </li>
              {mgmtUser && mgmtPass && (
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">&#10003;</span>
                  API connection created automatically for full management (PPPoE sync, script push, monitoring)
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
