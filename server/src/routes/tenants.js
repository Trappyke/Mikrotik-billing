/**
 * Tenant Management Routes
 * Super admin only: create, update, delete tenants
 * Tenant admin: view own tenant, update branding
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { tenantFilter, requireSuperAdmin, DEFAULT_TENANT_ID } = require("../middleware/tenantContext");

function getDb() {
  return global.dbAvailable ? global.db : require("../db/memory");
}

// ─── Super Admin: List all tenants ───
router.get("/", requireSuperAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count,
        (SELECT COUNT(*) FROM mikrotik_connections WHERE tenant_id = t.id) as router_count,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count
       FROM tenants t ORDER BY t.created_at DESC`,
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Get current tenant (any authenticated user) ───
router.get("/current", async (req, res) => {
  try {
    const db = getDb();
    const tenantId = req.tenantId || req.user?.tenant_id || DEFAULT_TENANT_ID;
    const result = await db.query("SELECT * FROM tenants WHERE id = $1", [tenantId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Super Admin: Create tenant ───
router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const db = getDb();
    const { name, slug, company_name, email, phone, address, domain, max_customers, max_routers } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "name and slug are required" });
    }

    // Check slug uniqueness
    const existing = await db.query("SELECT id FROM tenants WHERE slug = $1", [slug]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "A tenant with this slug already exists" });
    }

    const id = uuidv4();
    const result = await db.query(
      `INSERT INTO tenants (id, name, slug, company_name, email, phone, address, domain, max_customers, max_routers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name, slug, company_name || name, email, phone, address, domain, max_customers || 0, max_routers || 0],
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Update tenant (super admin or tenant admin for own tenant) ───
router.put("/:id", async (req, res) => {
  try {
    const db = getDb();

    // Check authorization: super admin or tenant's own admin
    const isSuperAdmin = req.user?.role === "admin" && !req.user?.tenant_id;
    const isOwnTenant = req.user?.tenant_id === req.params.id;
    if (!isSuperAdmin && !isOwnTenant) {
      return res.status(403).json({ error: "You can only edit your own tenant" });
    }

    const { name, company_name, email, phone, address, logo_url, primary_color, secondary_color, accent_color, domain, is_active, max_customers, max_routers } = req.body;

    const existing = await db.query("SELECT * FROM tenants WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const result = await db.query(
      `UPDATE tenants SET
        name = COALESCE($1, name),
        company_name = COALESCE($2, company_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        address = COALESCE($5, address),
        logo_url = COALESCE($6, logo_url),
        primary_color = COALESCE($7, primary_color),
        secondary_color = COALESCE($8, secondary_color),
        accent_color = COALESCE($9, accent_color),
        domain = COALESCE($10, domain),
        is_active = COALESCE($11, is_active),
        max_customers = COALESCE($12, max_customers),
        max_routers = COALESCE($13, max_routers),
        updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [name, company_name, email, phone, address, logo_url, primary_color, secondary_color, accent_color, domain, is_active, max_customers, max_routers, req.params.id],
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Super Admin: Delete tenant ───
router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (req.params.id === DEFAULT_TENANT_ID) {
      return res.status(400).json({ error: "Cannot delete the default tenant" });
    }
    await db.query("DELETE FROM tenants WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Get tenant stats ───
router.get("/:id/stats", async (req, res) => {
  try {
    const db = getDb();
    const isSuperAdmin = req.user?.role === "admin" && !req.user?.tenant_id;
    const isOwnTenant = req.user?.tenant_id === req.params.id;
    if (!isSuperAdmin && !isOwnTenant) {
      return res.status(403).json({ error: "Access denied" });
    }

    const stats = await db.query(
      `SELECT
        (SELECT COUNT(*) FROM customers WHERE tenant_id = $1) as customers,
        (SELECT COUNT(*) FROM customers WHERE tenant_id = $1 AND status = 'active') as active_customers,
        (SELECT COUNT(*) FROM subscriptions WHERE tenant_id = $1 AND status = 'active') as active_subs,
        (SELECT COUNT(*) FROM mikrotik_connections WHERE tenant_id = $1) as routers,
        (SELECT COUNT(*) FROM users WHERE tenant_id = $1) as users,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE tenant_id = $1) as total_revenue,
        (SELECT COUNT(*) FROM tickets WHERE tenant_id = $1 AND status != 'closed') as open_tickets`,
      [req.params.id],
    );
    res.json(stats.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
