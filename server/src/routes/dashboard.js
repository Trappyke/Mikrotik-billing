/**
 * Dashboard Stats API
 * Returns real-time statistics for the main dashboard
 */

const express = require("express");
const router = express.Router();
const db = global.db || require("../db/memory");

// ─── GET DASHBOARD STATS ───
router.get("/stats", async (req, res) => {
  try {
    const stats = {};

    // Total projects
    const projectsResult = await db.query("SELECT COUNT(*) FROM projects");
    stats.totalProjects = parseInt(projectsResult.rows[0].count);

    // Total templates
    const templatesResult = await db.query("SELECT COUNT(*) FROM templates");
    stats.totalTemplates = parseInt(templatesResult.rows[0].count);

    // Total customers
    try {
      const customersResult = await db.query("SELECT COUNT(*) FROM customers");
      stats.totalCustomers = parseInt(customersResult.rows[0].count);
    } catch {
      stats.totalCustomers = 0;
    }

    // Total users
    const usersResult = await db.query("SELECT COUNT(*) FROM users");
    stats.totalUsers = parseInt(usersResult.rows[0].count);

    // Active customers (not suspended)
    try {
      const activeResult = await db.query(
        "SELECT COUNT(*) FROM customers WHERE status = 'active'",
      );
      stats.activeCustomers = parseInt(activeResult.rows[0].count);
    } catch {
      stats.activeCustomers = stats.totalCustomers;
    }

    // Suspended customers
    try {
      const suspendedResult = await db.query(
        "SELECT COUNT(*) FROM customers WHERE status = 'suspended'",
      );
      stats.suspendedCustomers = parseInt(suspendedResult.rows[0].count);
    } catch {
      stats.suspendedCustomers = 0;
    }

    // Total revenue (from invoices)
    try {
      const revenueResult = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'",
      );
      stats.totalRevenue = parseFloat(revenueResult.rows[0].total);
    } catch {
      stats.totalRevenue = 0;
    }

    // Pending revenue
    try {
      const pendingResult = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'pending'",
      );
      stats.pendingRevenue = parseFloat(pendingResult.rows[0].total);
    } catch {
      stats.pendingRevenue = 0;
    }

    // Active MikroTik connections
    try {
      const mikrotikResult = await db.query(
        "SELECT COUNT(*) FROM mikrotik_connections",
      );
      stats.activeDevices = parseInt(mikrotikResult.rows[0].count);
    } catch {
      stats.activeDevices = 0;
    }

    // Recent projects (last 7 days)
    const recentProjectsResult = await db.query(
      "SELECT COUNT(*) FROM projects WHERE created_at >= NOW() - INTERVAL '7 days'",
    );
    stats.recentProjects = parseInt(recentProjectsResult.rows[0].count);

    // Recent customers (last 7 days)
    try {
      const recentCustomersResult = await db.query(
        "SELECT COUNT(*) FROM customers WHERE created_at >= NOW() - INTERVAL '7 days'",
      );
      stats.recentCustomers = parseInt(recentCustomersResult.rows[0].count);
    } catch {
      stats.recentCustomers = 0;
    }

    // ── REVENUE WIDGETS ──

    // Today's revenue (from payments table)
    try {
      const todayResult = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      );
      stats.todayRevenue = parseFloat(todayResult.rows[0].total);
    } catch {
      stats.todayRevenue = 0;
    }

    // Today's payments count
    try {
      const todayCountResult = await db.query(
        "SELECT COUNT(*) as count FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      );
      stats.todayPayments = parseInt(todayCountResult.rows[0].count);
    } catch {
      stats.todayPayments = 0;
    }

    // This month's revenue
    try {
      const monthResult = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE)",
      );
      stats.monthRevenue = parseFloat(monthResult.rows[0].total);
    } catch {
      stats.monthRevenue = 0;
    }

    // Last month's revenue (for comparison)
    try {
      const lastMonthResult = await db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')",
      );
      stats.lastMonthRevenue = parseFloat(lastMonthResult.rows[0].total);
    } catch {
      stats.lastMonthRevenue = 0;
    }

    // Revenue change % month-over-month
    if (stats.lastMonthRevenue > 0) {
      stats.revenueChange = parseFloat(
        (
          ((stats.monthRevenue - stats.lastMonthRevenue) /
            stats.lastMonthRevenue) *
          100
        ).toFixed(1),
      );
    } else {
      stats.revenueChange = stats.monthRevenue > 0 ? 100 : 0;
    }

    // Outstanding balance (pending + partial + overdue invoices)
    try {
      const outstandingResult = await db.query(
        "SELECT COALESCE(SUM(total - COALESCE(paid_amount, 0)), 0) as total FROM invoices WHERE status IN ('pending', 'partial', 'overdue')",
      );
      stats.outstandingBalance = parseFloat(outstandingResult.rows[0].total);
    } catch {
      stats.outstandingBalance = 0;
    }

    // Overdue invoices count (status='overdue' OR pending past due)
    try {
      const overdueResult = await db.query(
        "SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE)",
      );
      stats.overdueInvoices = parseInt(overdueResult.rows[0].count);
    } catch {
      stats.overdueInvoices = 0;
    }

    // Active subscriptions
    try {
      const activeSubsResult = await db.query(
        "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'",
      );
      stats.activeSubscriptions = parseInt(activeSubsResult.rows[0].count);
    } catch {
      stats.activeSubscriptions = 0;
    }

    // Top plans by customer count
    try {
      const topPlansResult = await db.query(`
        SELECT p.name, p.price, COUNT(s.id) as customer_count
        FROM plans p
        LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'active'
        GROUP BY p.id, p.name, p.price
        ORDER BY customer_count DESC
        LIMIT 5
      `);
      stats.topPlans = topPlansResult.rows;
    } catch {
      stats.topPlans = [];
    }

    // Revenue by day (last 7 days)
    try {
      const revenueByDayResult = await db.query(`
        SELECT DATE(created_at) as date, SUM(amount) as total
        FROM invoices
        WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
      stats.revenueByDay = revenueByDayResult.rows;
    } catch {
      stats.revenueByDay = [];
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET QUICK ACTIONS ───
router.get("/quick-actions", async (req, res) => {
  try {
    const user = req.user;
    const actions = [];

    // Common actions for all users
    actions.push({
      id: "new-project",
      label: "New Project",
      icon: "FolderPlus",
      route: "/?action=create-project",
      color: "blue",
    });

    actions.push({
      id: "new-customer",
      label: "Add Customer",
      icon: "UserPlus",
      route: "/billing-customers?action=add",
      color: "emerald",
    });

    // Admin-only actions
    if (user?.role === "admin") {
      actions.push({
        id: "integrations",
        label: "Integrations",
        icon: "Key",
        route: "/integrations",
        color: "violet",
      });

      actions.push({
        id: "users",
        label: "Manage Users",
        icon: "Users",
        route: "/users",
        color: "orange",
      });
    }

    actions.push({
      id: "templates",
      label: "Browse Templates",
      icon: "FileCode",
      route: "/templates",
      color: "cyan",
    });

    res.json({ success: true, actions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
