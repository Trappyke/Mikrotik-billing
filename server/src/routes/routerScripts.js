/**
 * Router Installation Scripts
 * Public endpoint - Bearer token auth via API key in tenant settings.
 */

const express = require("express");
const router = express.Router();

function getDb() {
  return global.dbAvailable ? global.db : require("../db/memory");
}

// GET /api/router/v1/scripts/install
router.get("/v1/scripts/install", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .type("text/plain")
        .send("# ERROR: Missing Bearer token");
    }
    const apiKey = authHeader.split(" ")[1];
    if (!apiKey || apiKey.length < 10) {
      return res
        .status(401)
        .type("text/plain")
        .send("# ERROR: Invalid API key");
    }

    const db = getDb();
    let tenant;
    try {
      const result = await db.query(
        "SELECT * FROM tenants WHERE settings->>'api_key' = $1 AND is_active = true LIMIT 1",
        [apiKey],
      );
      tenant = result.rows[0];
    } catch (e) {
      tenant = null;
    }

    if (!tenant) {
      return res
        .status(403)
        .type("text/plain")
        .send("# ERROR: Invalid API key");
    }

    const baseUrl = process.env.APP_URL || `https://${req.get("host")}`;
    const radiusServer = process.env.RADIUS_SERVER || req.get("host");
    const radiusSecret = process.env.RADIUS_SECRET || apiKey.substring(0, 16);

    const script = [
      "#############################################",
      "# MikroTik Billing - Router Link Script",
      `# Server: ${baseUrl}`,
      "#############################################",
      "",
      `:log info "[Billing] Starting..."`,
      "",
      "# RADIUS",
      `/radius add address=${radiusServer} secret="${radiusSecret}" service=ppp,hotspot timeout=300ms comment="Billing RADIUS" disabled=no`,
      "",
      "# PPPoE",
      ":if ([:len [/interface pppoe-server server find]] = 0) do={",
      "  /interface pppoe-server server add service-name=pppoe-internet interface=bridge1 authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes disabled=no",
      "}",
      "/ppp profile set [find name=default] use-radius=yes",
      "",
      "# Report back to server",
      ":local model [/system routerboard get model]",
      ":local serial [/system routerboard get serial-number]",
      ":local version [/system package get [find name=routeros] version]",
      ":local mac [/interface ethernet get [find default-name=ether1] mac-address]",
      `:local url "${baseUrl}/api/router/v1/report?model=\$model&serial=\$serial&version=\$version&mac=\$mac"`,
      `:do { /tool fetch url=\$url http-header-field="Authorization: Bearer ${apiKey}" mode=https output=none } on-error={ :log warning "[Billing] Report failed" }`,
      "",
      "# Schedule auto-sync",
      "/system scheduler remove [find name=billing-sync]",
      `/system scheduler add name=billing-sync interval=5m on-event="/tool fetch url=\\"${baseUrl}/api/router/v1/scripts/sync\\" http-header-field=\\"Authorization: Bearer ${apiKey}\\" mode=https output=none" comment="Billing Sync" disabled=no`,
      "",
      `:log info "[Billing] Done!"`,
      `:put "[Billing] Router linked to ${baseUrl}"`,
    ].join("\n");

    // Log
    try {
      const ip = req.ip || "unknown";
      await db.query(
        "INSERT INTO provision_logs (id, token, ip_address, action, status, details) VALUES ($1,$2,$3,$4,$5,$6)",
        [
          require("uuid").v4(),
          apiKey.substring(0, 16),
          ip,
          "install_script_fetch",
          "success",
          tenant.name,
        ],
      );
    } catch (e) {}

    res.type("text/plain").send(script);
  } catch (error) {
    res.status(500).type("text/plain").send("# ERROR: Internal server error");
  }
});

// GET /api/router/v1/report - Router scan report via query params
router.get("/v1/report", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const apiKey = authHeader.split(" ")[1];
    const { model, serial, version, mac } = req.query;
    const db = getDb();

    await db.query(
      "INSERT INTO provision_logs (id, token, ip_address, action, status, details) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        require("uuid").v4(),
        apiKey.substring(0, 16),
        req.ip,
        "router_scan",
        "success",
        JSON.stringify({ model, serial, version, mac }),
      ],
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/router/v1/status - Check connection status
router.get("/v1/status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing token" });
    }
    const apiKey = authHeader.split(" ")[1];
    const db = getDb();

    const result = await db.query(
      "SELECT action, status, ip_address, created_at FROM provision_logs WHERE token = $1 ORDER BY created_at DESC LIMIT 1",
      [apiKey.substring(0, 16)],
    );

    if (result.rows.length === 0) {
      return res.json({
        connected: false,
        status: "waiting",
        message: "Awaiting router connection...",
      });
    }

    const log = result.rows[0];
    res.json({
      connected: true,
      status: "online",
      message: "Router connected",
      lastSeen: log.created_at,
      ip: log.ip_address,
      lastAction: log.action,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/router/v1/scripts/sync
router.get("/v1/scripts/sync", async (req, res) => {
  res.type("text/plain").send(':log info "[Billing] Sync OK"');
});

module.exports = router;
