import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Router, Copy, Check, Key, Terminal, Loader2, Shield, AlertCircle,
  Link2, Plug, Wifi, WifiOff, Activity, Server, Trash2,
} from "lucide-react";
import { useToastStore } from "../stores/toastStore";
import { getToken } from "../lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";

const API = import.meta.env.VITE_API_URL || "/api";

const TABS = [
  { id: "link", label: "Link New Router", icon: Link2 },
  { id: "routers", label: "All Routers", icon: Server },
];

export default function RoutersPage() {
  const toast = useToastStore();
  const [activeTab, setActiveTab] = useState("routers");
  const [loading, setLoading] = useState(true);

  // Router list state
  const [routers, setRouters] = useState([]);
  const [routersLoading, setRoutersLoading] = useState(false);

  // Link wizard state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("router_link_api_key") || "");
  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [appUrl, setAppUrl] = useState(() => localStorage.getItem("router_link_app_url") || window.location.origin);
  const [mgmtUser, setMgmtUser] = useState(() => localStorage.getItem("router_link_mgmt_user") || "admin");
  const [mgmtPass, setMgmtPass] = useState("");
  const [mgmtPort, setMgmtPort] = useState("8728");
  const [showCredentials, setShowCredentials] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [watchAttempts, setWatchAttempts] = useState(0);
  const [watchRemaining, setWatchRemaining] = useState(0);
  const watchIntervalRef = React.useRef(null);

  useEffect(() => { fetchTenant(); return () => stopWatching(); }, []);

  const fetchTenant = async () => {
    try {
      const token = getToken();
      const { data } = await axios.get(`${API}/tenants/current`, { headers: { Authorization: `Bearer ${token}` } });
      setTenantId(data.id);
      setTenantSlug(data.slug || data.name?.toLowerCase().replace(/\s+/g, "-") || "");
      const storedKey = localStorage.getItem("router_link_api_key");
      const tenantKey = data.settings?.api_key;
      const activeKey = tenantKey || storedKey || "";
      if (activeKey && activeKey !== apiKey) {
        setApiKey(activeKey);
        localStorage.setItem("router_link_api_key", activeKey);
      }
    } catch (e) {
      const storedKey = localStorage.getItem("router_link_api_key");
      if (storedKey && !apiKey) setApiKey(storedKey);
    } finally { setLoading(false); }
  };

  const fetchRouters = async () => {
    if (!tenantSlug) return;
    setRoutersLoading(true);
    try {
      const { data } = await axios.get(`${API}/router/v1/${tenantSlug}/routers`);
      setRouters(data.routers || []);
    } catch (e) { /* silent */ } finally { setRoutersLoading(false); }
  };

  useEffect(() => { if (tenantSlug) { fetchRouters(); const i = setInterval(fetchRouters, 15000); return () => clearInterval(i); } }, [tenantSlug]);

  const deleteRouter = async (routerId, routerName) => {
    if (!confirm(`Delete "${routerName}"? This removes the router and its API connection permanently.`)) return;
    setDeleting(routerId);
    try {
      await axios.delete(`${API}/router/v1/${tenantSlug}/routers/${routerId}`);
      toast.success("Router deleted");
      fetchRouters();
    } catch (e) {
      toast.error(e.response?.data?.error || "Delete failed");
    } finally { setDeleting(null); }
  };

  // Watch session
  const startWatching = async () => {
    if (!tenantSlug) return;
    stopWatching();
    try {
      const { data } = await axios.post(`${API}/router/v1/${tenantSlug}/watch/start`);
      setConnectionStatus({ connected: false, status: "watching", message: "Watch session started" });
      setWatchAttempts(0); setLastError(null);
      const poll = async () => {
        try {
          const { data } = await axios.get(`${API}/router/v1/${tenantSlug}/watch/${data.sessionId}`);
          setWatchAttempts((c) => c + 1);
          if (data.found) {
            stopWatching();
            setConnectionStatus({ connected: true, status: "online", router: data.router, message: data.message });
            fetchRouters();
            toast.success(data.message);
          } else if (data.expired) {
            stopWatching();
            setConnectionStatus({ connected: false, status: "timeout", message: data.message });
          } else { setWatchRemaining(Math.max(0, 600 - (data.elapsed || 0))); }
        } catch (e) {}
      };
      poll();
      watchIntervalRef.current = setInterval(poll, 3000);
    } catch (e) { setLastError("Failed to start watch: " + (e.response?.data?.error || e.message)); }
  };
  const stopWatching = () => { if (watchIntervalRef.current) { clearInterval(watchIntervalRef.current); watchIntervalRef.current = null; } };

  useEffect(() => { if (tenantSlug && apiKey) startWatching(); }, [tenantSlug, apiKey]);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const token = getToken();
      const key = "mtk-" + Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join("");
      await axios.put(`${API}/tenants/${tenantId}/api-key`, { api_key: key }, { headers: { Authorization: `Bearer ${token}` } });
      setApiKey(key);
      localStorage.setItem("router_link_api_key", key);
      toast.success("API key generated");
    } catch (e) { toast.error("Failed to generate key"); } finally { setGenerating(false); }
  };

  const buildCommand = () => {
    const mode = appUrl.startsWith("https") ? "https" : "http";
    const certFlag = appUrl.startsWith("https") ? " check-certificate=no" : "";
    const slugPath = tenantSlug ? `/v1/${tenantSlug}/install` : "/v1/scripts/install";
    let prefix = "";
    if (mgmtUser && mgmtPass) prefix = `:global ztpMgmtUser "${mgmtUser}"; :global ztpMgmtPass "${mgmtPass}"; `;
    return `${prefix}/tool fetch url="${appUrl}/api/router${slugPath}" http-header-field="Authorization: Bearer ${apiKey}" dst-path=install.rsc mode=${mode}${certFlag}; :delay 4s; /import file-name=install.rsc; :delay 1s; /file remove install.rsc`;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;

  const isLinked = connectionStatus?.connected && connectionStatus?.router?.has_connection;
  const isOnline = connectionStatus?.router?.is_online !== false;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Router className="w-6 h-6 text-blue-400" /> Routers
        </h1>
        <p className="text-zinc-400 text-sm mt-1">Link, manage, and monitor your MikroTik routers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id ? "bg-blue-500/10 text-blue-400" : "text-zinc-500 hover:text-zinc-300"}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* ALL ROUTERS TAB */}
      {activeTab === "routers" && (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div><p className="text-2xl font-bold text-white">{routers.filter(r => r.is_online).length}</p><p className="text-xs text-zinc-500">Online</p></div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div><p className="text-2xl font-bold text-white">{routers.filter(r => !r.is_online).length}</p><p className="text-xs text-zinc-500">Offline</p></div>
              </CardContent>
            </Card>
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <div><p className="text-2xl font-bold text-white">{routers.filter(r => !r.linked_mikrotik_connection_id).length}</p><p className="text-xs text-zinc-500">Unmanaged</p></div>
              </CardContent>
            </Card>
          </div>

          {routers.length === 0 ? (
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardContent className="p-8 text-center">
                <Router className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">No routers yet</p>
                <p className="text-zinc-600 text-sm mt-1 mb-4">Link your first MikroTik router to get started</p>
                <Button onClick={() => setActiveTab("link")} className="gap-2"><Link2 className="w-4 h-4" /> Link a Router</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {routers.map((r) => (
                <div key={r.id} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${r.is_online ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-white font-medium">{r.name}</p>
                      <p className="text-xs text-zinc-500">{r.model || "Unknown"} &middot; {r.ip_address || "no IP"} &middot; {r.mac_address || "no MAC"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${r.is_online ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {r.is_online ? <Wifi className="w-3 h-3 inline mr-1" /> : <WifiOff className="w-3 h-3 inline mr-1" />}
                      {r.is_online ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${r.linked_mikrotik_connection_id ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {r.linked_mikrotik_connection_id ? 'managed' : 'unmanaged'}
                    </span>
                    <button
                      onClick={() => deleteRouter(r.id, r.name)}
                      disabled={deleting === r.id}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete router"
                    >
                      {deleting === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-center">
            <Button variant="outline" onClick={() => setActiveTab("link")} className="gap-2 border-zinc-700/50 text-zinc-300">
              <Link2 className="w-4 h-4" /> Link New Router
            </Button>
          </div>
        </div>
      )}

      {/* LINK NEW ROUTER TAB */}
      {activeTab === "link" && (
        <div className="space-y-6">
          {/* Step 1: API Key */}
          <Card className="bg-zinc-900/60 border-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">1</span> Your API Key
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKey ? (
                <code className="block w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-sm text-amber-400 font-mono break-all">{apiKey}</code>
              ) : (
                <p className="text-zinc-500 text-sm">No API key yet.</p>
              )}
              <Button onClick={generateKey} disabled={generating} className="gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {apiKey ? "Regenerate" : "Generate API Key"}
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Credentials */}
          {apiKey && (
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold">2</span> Management Credentials
                  {!showCredentials && <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full ml-2">Recommended</span>}
                </CardTitle>
              </CardHeader>
              {showCredentials ? (
                <CardContent className="space-y-3">
                  <input type="text" value={mgmtUser} onChange={(e) => setMgmtUser(e.target.value)} placeholder="Username (usually admin)" className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <input type="password" value={mgmtPass} onChange={(e) => setMgmtPass(e.target.value)} placeholder="Password" className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                  <input type="text" value={mgmtPort} onChange={(e) => setMgmtPort(e.target.value)} placeholder="8728" className="w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </CardContent>
              ) : (
                <CardContent><Button variant="outline" onClick={() => setShowCredentials(true)} className="gap-2 border-zinc-700/50 text-zinc-300"><Shield className="w-4 h-4" /> Add Credentials (For Full Management)</Button></CardContent>
              )}
            </Card>
          )}

          {/* Step 3: Command */}
          {apiKey && (
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">3</span> Run on MikroTik</CardTitle>
                <CardDescription>Paste this single command into your MikroTik terminal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input type="text" value={appUrl} onChange={(e) => { setAppUrl(e.target.value); localStorage.setItem("router_link_app_url", e.target.value); }} placeholder="https://your-server.com" className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                {mgmtUser && mgmtPass && <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2"><Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /><p className="text-xs text-amber-300">Credentials included. Router auto-links for full management.</p></div>}
                <pre className="bg-zinc-950 border border-zinc-700/50 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">{buildCommand()}</pre>
                <Button onClick={() => { navigator.clipboard.writeText(buildCommand()); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 3000); }} className="gap-2 w-full">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copied ? "Copied!" : "Copy to Clipboard"}</Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Status */}
          {apiKey && (
            <Card className="bg-zinc-900/60 border-zinc-800/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">4</span> Connection Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isLinked && isOnline ? "bg-green-500 shadow-lg shadow-green-500/30" : connectionStatus?.connected && isOnline ? "bg-green-500 animate-pulse" : connectionStatus?.connected && !isOnline ? "bg-red-500" : connectionStatus?.status === "watching" ? "bg-amber-500 animate-pulse" : "bg-zinc-600"}`} />
                  <span className="text-sm text-zinc-300">{isLinked && isOnline ? "Online & Managed" : connectionStatus?.connected && isOnline ? "Connected" : connectionStatus?.connected && !isOnline ? "Offline" : connectionStatus?.status === "watching" ? `Watching... (${watchAttempts} checks, ${Math.ceil((watchRemaining * 3) / 60)}m left)` : "Not monitoring"}</span>
                </div>
                {connectionStatus?.router && (
                  <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm text-white font-medium">{connectionStatus.router.name} ({connectionStatus.router.model || "Unknown"})</p>
                    <p className="text-xs text-zinc-500">MAC: {connectionStatus.router.mac} &middot; IP: {connectionStatus.router.ip}</p>
                    <p className="text-xs">{connectionStatus.router.has_connection ? <span className="text-green-400">Fully managed</span> : <span className="text-amber-400">Needs credentials for management</span>}</p>
                  </div>
                )}
                {lastError && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2"><AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /><p className="text-xs text-red-400">{lastError}</p></div>}
                {connectionStatus?.status === "timeout" && <Button onClick={startWatching} className="gap-2 w-full">Start New Watch</Button>}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
