/**
 * Dashboard Stats API
 * Returns real-time statistics for the main dashboard
 * Optimized: all independent queries run in parallel via Promise.all
 */

const express = require("express");
const router = express.Router();

function getDb() {
  return global.db || require("../db/memory");
}

// ─── GET DASHBOARD STATS ───
router.get("/stats", async (req, res) => {
  try {
    const db = getDb();
    const stats = {};

    // Run ALL independent queries in parallel (single round-trip overhead)
    const [
      projectsResult,
      templatesResult,
      customersResult,
      usersResult,
      activeResult,
      suspendedResult,
      revenueResult,
      pendingResult,
      mikrotikResult,
      recentProjectsResult,
      recentCustomersResult,
      todayResult,
      todayCountResult,
      monthResult,
      lastMonthResult,
      outstandingResult,
      overdueResult,
      activeSubsResult,
      topPlansResult,
      revenueByDayResult,
    ] = await Promise.allSettled([
      db.query("SELECT COUNT(*) FROM projects"),
      db.query("SELECT COUNT(*) FROM templates"),
      db.query("SELECT COUNT(*) FROM customers"),
      db.query("SELECT COUNT(*) FROM users"),
      db.query("SELECT COUNT(*) FROM customers WHERE status = 'active'"),
      db.query("SELECT COUNT(*) FROM customers WHERE status = 'suspended'"),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'pending'",
      ),
      db.query("SELECT COUNT(*) FROM mikrotik_connections"),
      db.query(
        "SELECT COUNT(*) FROM projects WHERE created_at >= NOW() - INTERVAL '7 days'",
      ),
      db.query(
        "SELECT COUNT(*) FROM customers WHERE created_at >= NOW() - INTERVAL '7 days'",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM payments WHERE DATE(received_at) = CURRENT_DATE",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE)",
      ),
      db.query(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE EXTRACT(MONTH FROM received_at) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM received_at) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')",
      ),
      db.query(
        "SELECT COALESCE(SUM(total - COALESCE(paid_amount, 0)), 0) as total FROM invoices WHERE status IN ('pending', 'partial', 'overdue')",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM invoices WHERE status = 'overdue' OR (status = 'pending' AND due_date < CURRENT_DATE)",
      ),
      db.query(
        "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'",
      ),
      db.query(
        `SELECT p.name, p.price, COUNT(s.id) as customer_count FROM service_plans p LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'active' GROUP BY p.id, p.name, p.price ORDER BY customer_count DESC LIMIT 5`,
      ),
      db.query(
        `SELECT DATE(created_at) as date, SUM(amount) as total FROM invoices WHERE status = 'paid' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY DATE(created_at) ORDER BY date DESC`,
      ),
    ]);

    const val = (result, field = "count", fallback = 0) => {
      if (result.status === "fulfilled" && result.value?.rows?.[0]) {
        return field === "total"
          ? parseFloat(result.value.rows[0].total) || fallback
          : parseInt(result.value.rows[0][field]) || fallback;
      }
      return fallback;
    };

    stats.totalProjects = val(projectsResult);
    stats.totalTemplates = val(templatesResult);
    stats.totalCustomers = val(customersResult);
    stats.totalUsers = val(usersResult);
    stats.activeCustomers = val(activeResult);
    stats.suspendedCustomers = val(suspendedResult);
    stats.totalRevenue = val(revenueResult, "total");
    stats.pendingRevenue = val(pendingResult, "total");
    stats.activeDevices = val(mikrotikResult);
    stats.recentProjects = val(recentProjectsResult);
    stats.recentCustomers = val(recentCustomersResult);
    stats.todayRevenue = val(todayResult, "total");
    stats.todayPayments = val(todayCountResult);
    stats.monthRevenue = val(monthResult, "total");
    stats.lastMonthRevenue = val(lastMonthResult, "total");

    // Revenue change %
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

    stats.outstandingBalance = val(outstandingResult, "total");
    stats.overdueInvoices = val(overdueResult);
    stats.activeSubscriptions = val(activeSubsResult);

    if (topPlansResult.status === "fulfilled") {
      stats.topPlans = topPlansResult.value.rows;
    } else {
      stats.topPlans = [];
    }

    if (revenueByDayResult.status === "fulfilled") {
      stats.revenueByDay = revenueByDayResult.value.rows;
    } else {
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
    const actions = [
      {
        id: "new-project",
        label: "New Project",
        icon: "FolderPlus",
        route: "/?action=create-project",
        color: "blue",
      },
      {
        id: "new-customer",
        label: "Add Customer",
        icon: "UserPlus",
        route: "/billing-customers?action=add",
        color: "emerald",
      },
    ];

    if (user?.role === "admin") {
      actions.push(
        {
          id: "integrations",
          label: "Integrations",
          icon: "Key",
          route: "/integrations",
          color: "violet",
        },
        {
          id: "users",
          label: "Manage Users",
          icon: "Users",
          route: "/users",
          color: "orange",
        },
      );
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
