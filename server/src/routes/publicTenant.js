/**
 * Public Tenant Branding Route
 * No auth required — used by the login page to display ISP branding
 */

const express = require("express");
const router = express.Router();

function getDb() {
  return global.dbAvailable ? global.db : require("../db/memory");
}

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";

// GET /api/public/tenant-branding?slug=my-isp
// Returns branding for a tenant by slug, domain, or falls back to default
router.get("/tenant-branding", async (req, res) => {
  try {
    const db = getDb();
    let tenant = null;

    // 1. Try by slug query param
    if (req.query.slug) {
      const result = await db.query(
        "SELECT * FROM tenants WHERE slug = $1 AND is_active = true",
        [req.query.slug],
      );
      tenant = result.rows[0];
    }

    // 2. Try by domain (from host header)
    if (!tenant && req.headers.host) {
      const hostname = req.headers.host.split(":")[0];
      const result = await db.query(
        "SELECT * FROM tenants WHERE domain = $1 AND is_active = true",
        [hostname],
      );
      tenant = result.rows[0];
    }

    // 3. Fall back to default tenant
    if (!tenant) {
      const result = await db.query(
        "SELECT * FROM tenants WHERE id = $1 AND is_active = true",
        [DEFAULT_TENANT_ID],
      );
      tenant = result.rows[0];
    }

    // 4. If still nothing, return hardcoded defaults
    if (!tenant) {
      return res.json({
        company_name: "MikroTik Billing",
        logo_url: null,
        primary_color: "#3b82f6",
        secondary_color: "#1e293b",
        accent_color: "#f59e0b",
        is_default: true,
      });
    }

    res.json({
      id: tenant.id,
      slug: tenant.slug,
      company_name: tenant.company_name || tenant.name,
      logo_url: tenant.logo_url || null,
      primary_color: tenant.primary_color || "#3b82f6",
      secondary_color: tenant.secondary_color || "#1e293b",
      accent_color: tenant.accent_color || "#f59e0b",
      is_default: tenant.id === DEFAULT_TENANT_ID,
    });
  } catch (e) {
    // Always return something — never break the login page
    res.json({
      company_name: "MikroTik Billing",
      logo_url: null,
      primary_color: "#3b82f6",
      secondary_color: "#1e293b",
      accent_color: "#f59e0b",
      is_default: true,
    });
  }
});

module.exports = router;
