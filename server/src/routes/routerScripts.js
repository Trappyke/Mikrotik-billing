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
    const wgEndpoint = process.env.WIREGUARD_ENDPOINT || "";
    const wgServerPubkey = process.env.WIREGUARD_SERVER_PUBKEY || "";

    const scriptLines = [
      "#############################################",
      "# MikroTik Billing - Router Link Script",
      `# Server: ${baseUrl}`,
      "#############################################",
      "",
      `:log info "[Billing] Starting..."`,
      "",
      "# RADIUS",
      `:do { /radius add address=${radiusServer} secret="${radiusSecret}" service=ppp,hotspot timeout=300ms comment="Billing RADIUS" disabled=no } on-error={ :log warning "[Billing] RADIUS setup skipped" }`,
      "",
      "# PPPoE",
      ":do {",
      "  :if ([:len [/interface pppoe-server server find]] = 0) do={",
      "    /interface pppoe-server server add service-name=pppoe-internet interface=bridge1 authentication=pap,chap,mschap1,mschap2 one-session-per-host=yes disabled=no",
      "  }",
      '  :log info "[Billing] PPPoE checked"',
      '} on-error={ :log warning "[Billing] PPPoE setup skipped" }',
      "",
    ];

    // WireGuard tunnel (conditional on env vars)
    if (wgEndpoint && wgServerPubkey) {
      scriptLines.push(
        "# WireGuard Tunnel",
        `:global wgPubKey; :set wgPubKey ""`,
        ":do {",
        `  :if ([:len [/interface wireguard find name=mgmt-tunnel]] = 0) do={`,
        `    /interface wireguard add name=mgmt-tunnel listen-port=13231 comment="Billing management tunnel"`,
        `    /interface wireguard peers add interface=mgmt-tunnel public-key="${wgServerPubkey}" endpoint-address="${wgEndpoint}" endpoint-port=13231 allowed-address=0.0.0.0/0 persistent-keepalive=25s comment="Billing server"`,
        `    :set wgPubKey [/interface wireguard get [find name=mgmt-tunnel] public-key]`,
        `    /ip firewall filter add chain=input protocol=udp dst-port=13231 action=accept comment="Allow WireGuard billing"`,
        `    :log info "[Billing] WireGuard tunnel created"`,
        `  } else={`,
        `    :set wgPubKey [/interface wireguard get [find name=mgmt-tunnel] public-key]`,
        `    :log info "[Billing] WireGuard tunnel already exists"`,
        `  }`,
        '} on-error={ :log warning "[Billing] WireGuard setup failed" }',
        "",
      );
    } else {
      scriptLines.push(`:global wgPubKey; :set wgPubKey ""`, "");
    }

    scriptLines.push(
      "# Report back to server",
      ":local model [/system routerboard get model]",
      ":local serial [/system routerboard get serial-number]",
      ":local version [/system package get [find name=routeros] version]",
      ":local mac [/interface ethernet get [find default-name=ether1] mac-address]",
      `:local url "${baseUrl}/api/router/v1/report?model=\$model&serial=\$serial&version=\$version&mac=\$mac"`,
      `:if ([:len \$wgPubKey] > 0) do={ :set url (\$url . "&wg_pubkey=" . \$wgPubKey) }`,
      `:do { /tool fetch url=\$url http-header-field="Authorization: Bearer ${apiKey}" mode=https output=none } on-error={ :log warning "[Billing] Report failed" }`,
      "",
      "# Schedule auto-sync",
      "/system scheduler remove [find name=billing-sync]",
      `/system scheduler add name=billing-sync interval=5m on-event="/tool fetch url=\\"${baseUrl}/api/router/v1/scripts/sync\\" http-header-field=\\"Authorization: Bearer ${apiKey}\\" mode=https output=none" comment="Billing Sync" disabled=no`,
      "",
      `:log info "[Billing] Done!"`,
      `:put "[Billing] Router linked to ${baseUrl}"`,
    );

    const script = scriptLines.join("\n");

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
    const { model, serial, version, mac, wg_pubkey } = req.query;
    const db = getDb();

    // Find tenant by API key
    let tenant;
    try {
      const tenantResult = await db.query(
        "SELECT * FROM tenants WHERE settings->>'api_key' = $1 AND is_active = true LIMIT 1",
        [apiKey],
      );
      tenant = tenantResult.rows[0];
    } catch (e) {
      tenant = null;
    }

    // Upsert router record if we have a MAC and tenant
    let routerId = null;
    if (tenant && mac) {
      try {
        // Find project for this tenant (use first project or create default)
        const projectResult = await db.query(
          "SELECT id FROM projects ORDER BY created_at ASC LIMIT 1",
        );
        const projectId =
          projectResult.rows.length > 0 ? projectResult.rows[0].id : null;

        // Check if router already exists by MAC
        const existingRouter = await db.query(
          "SELECT id FROM routers WHERE mac_address = $1 LIMIT 1",
          [mac],
        );

        const routerName =
          model || `Router-${(mac || "unknown").replace(/:/g, "-")}`;
        const routerIp = req.ip || req.connection?.remoteAddress || "unknown";

        if (existingRouter.rows.length > 0) {
          // Update existing router
          routerId = existingRouter.rows[0].id;
          await db.query(
            `UPDATE routers SET
              model = COALESCE(NULLIF($1, ''), model),
              ip_address = $2,
              provision_status = 'online',
              wireguard_public_key = COALESCE(NULLIF($4, ''), wireguard_public_key),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $3`,
            [model, routerIp, routerId, wg_pubkey || null],
          );
        } else {
          // Create new router
          const newRouter = await db.query(
            `INSERT INTO routers (project_id, name, identity, model, mac_address, ip_address, wireguard_public_key, provision_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'online')
             RETURNING id`,
            [
              projectId,
              routerName,
              routerName,
              model,
              mac,
              routerIp,
              wg_pubkey || null,
            ],
          );
          routerId = newRouter.rows[0].id;
        }
      } catch (e) {
        // Router upsert failed but we still log the scan
        console.error("Failed to upsert router:", e.message);
      }
    }

    // Log the scan
    await db.query(
      "INSERT INTO provision_logs (id, token, router_id, ip_address, action, status, details) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        require("uuid").v4(),
        apiKey.substring(0, 16),
        routerId,
        req.ip,
        "router_scan",
        "success",
        JSON.stringify({ model, serial, version, mac, wg_pubkey }),
      ],
    );

    res.json({ success: true, router_id: routerId });
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
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const apiKey = authHeader.split(" ")[1];
      const db = getDb();

      // Find tenant by API key
      const tenantResult = await db.query(
        "SELECT * FROM tenants WHERE settings->>'api_key' = $1 AND is_active = true LIMIT 1",
        [apiKey],
      );

      if (tenantResult.rows.length > 0) {
        // Update last_seen for routers linked via provision_logs
        await db.query(
          `UPDATE routers SET
            provision_status = 'online',
            updated_at = CURRENT_TIMESTAMP
           WHERE id IN (
             SELECT router_id FROM provision_logs
             WHERE token = $1 AND router_id IS NOT NULL
             ORDER BY created_at DESC LIMIT 1
           )`,
          [apiKey.substring(0, 16)],
        );
      }
    }
  } catch (e) {
    // Sync update is best-effort
  }

  res.type("text/plain").send(':log info "[Billing] Sync OK"');
});

module.exports = router;
