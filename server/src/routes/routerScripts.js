/**
 * Router Installation Scripts
 * Public endpoint that returns RouterOS scripts for linking routers to billing.
 * Authentication via Bearer token (API key stored in tenant settings).
 *
 * Usage (on MikroTik router):
 * /tool fetch url="https://your-app.com/api/router/v1/scripts/install" \
 *   http-header-field="Authorization: Bearer YOUR_API_KEY" \
 *   dst-path="install.rsc" mode=https
 * :delay 2s
 * /import file-name="install.rsc"
 * :delay 1s
 * /file remove "install.rsc"
 */

const express = require("express");
const router = express.Router();

function getDb() {
  return global.dbAvailable ? global.db : require("../db/memory");
}

// GET /api/router/v1/scripts/install
router.get("/v1/scripts/install", async (req, res) => {
  try {
    // Authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).type("text/plain").send("# ERROR: Missing Bearer token");
    }

    const apiKey = authHeader.split(" ")[1];
    if (!apiKey || apiKey.length < 10) {
      return res.status(401).type("text/plain").send("# ERROR: Invalid API key");
    }

    // Find tenant by API key
    const db = getDb();
    let tenant;
    try {
      const result = await db.query(
        "SELECT * FROM tenants WHERE settings->>'api_key' = $1 AND is_active = true LIMIT 1",
        [apiKey],
      );
      tenant = result.rows[0];
    } catch (e) {
      // Fallback: check if any mikrotik_connection has this as a token
      const result = await db.query(
        "SELECT * FROM mikrotik_connections WHERE password_encrypted = $1 LIMIT 1",
        [apiKey],
      );
      tenant = result.rows[0] ? { id: result.rows[0].tenant_id, name: result.rows[0].name } : null;
    }

    if (!tenant) {
      return res.status(403).type("text/plain").send("# ERROR: Invalid API key");
    }

    // Get tenant settings
    const baseUrl = process.env.APP_URL || `https://${req.get("host")}`;
    const radiusServer = process.env.RADIUS_SERVER || req.get("host");
    const radiusSecret = process.env.RADIUS_SECRET || apiKey.substring(0, 16);

    // Generate the installation script
    const script = [
      "#############################################",
      "# MikroTik Billing - Router Installation Script",
      `# Tenant: ${tenant.name || "Unknown"}`,
      `# Server: ${baseUrl}`,
      `# Generated: ${new Date().toISOString()}`,
      "#############################################",
      "",
      ":log info \"[Billing] Starting router installation...\"",
      "",
      "# ── System Identity ──",
      `:local tenantName "${(tenant.name || "ISP").replace(/"/g, '\\"')}"`,
      ":if ([/system identity get name] = \"MikroTik\") do={",
      `  /system identity set name=\"$tenantName-Router\"`,
      "}",
      "",
      "# ── RADIUS Client ──",
      `/radius add address=${radiusServer} secret=${radiusSecret} service=ppp,hotspot,wireless,dhcp timeout=300ms src-address=0.0.0.0 comment="Billing RADIUS" disabled=no`,
      "",
      "# ── PPPoE Server ──",
      ":if ([:len [/interface pppoe-server server find]] = 0) do={",
      "  /interface pppoe-server server add service-name=pppoe-internet interface=bridge1 max-mtu=1480 max-mru=1480 authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes default-profile=default keepalive-timeout=30 disabled=no",
      "}",
      "/ppp profile set [find name=default] local-address=10.10.0.1 remote-address=pppoe-pool use-radius=yes",
      "",
      "# ── PPPoE IP Pool ──",
      ":if ([:len [/ip pool find name=pppoe-pool]] = 0) do={",
      "  /ip pool add name=pppoe-pool ranges=10.10.0.10-10.10.255.254",
      "}",
      "",
      "# ── Hotspot Server ──",
      ":if ([:len [/ip hotspot find]] = 0) do={",
      `  /ip hotspot add name=hotspot1 interface=bridge1 address-pool=dhcp profile=hsprof1 disabled=no`,
      "}",
      "/ip hotspot profile set [find name=hsprof1] use-radius=yes",
      "",
      "# ── Firewall - Allow API ──",
      "/ip firewall filter add chain=input protocol=tcp dst-port=8728,8729 src-address-list=billing-servers action=accept comment=\"Allow Billing API\" place-before=0",
      `/ip firewall address-list add address=${req.get("host") || "0.0.0.0"} list=billing-servers comment="Billing Server" disabled=no`,
      "",
      "# ── Scheduled Auto-Sync (every 5 min) ──",
      "/system scheduler remove [find name=billing-sync]",
      `/system scheduler add name=billing-sync interval=5m on-event=\"/tool fetch url=\\"${baseUrl}/api/router/v1/scripts/sync\\" http-header-field=\\"Authorization: Bearer ${apiKey}\\" dst-path=sync.rsc mode=https; :delay 2s; /import file-name=sync.rsc; :delay 1s; /file remove sync.rsc\" comment="Sync with Billing Server" disabled=no`,
      "",
      "# ── Done ──",
      ":log info \"[Billing] Router installation complete!\"",
      ":put \"[Billing] Router linked successfully to ${baseUrl}\"",
    ].join("\n");

    // Log the installation
    try {
      const ip = req.ip || req.connection?.remoteAddress || "unknown";
      await db.query(
        "INSERT INTO provision_logs (id, token, ip_address, user_agent, action, status, details) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [require("uuid").v4(), apiKey.substring(0, 16), ip, req.get("User-Agent") || "router", "router_install", "success", `Tenant: ${tenant.name}`],
      );
    } catch (e) {
      // Logging failure is non-critical
    }

    res.type("text/plain").send(script);
  } catch (error) {
    console.error("Router install script error:", error);
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

// GET /api/router/v1/scripts/sync
router.get("/v1/scripts/sync", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).type("text/plain").send("# ERROR: Missing token");
  }

  // Return minimal sync script
  const script = [
    ":log info \"[Billing] Sync check complete\"",
    "# No pending changes",
  ].join("\n");

  res.type("text/plain").send(script);
});

module.exports = router;
