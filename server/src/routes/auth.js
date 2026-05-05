const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { generateSecret, generateURI, verify: verifyTotp } = require("otplib");
const QRCode = require("qrcode");
const { JWT_SECRET } = require("../middleware/auth");
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const logger = require("../utils/logger");
const { authLimiter } = require("../middleware/rateLimiter");
const { audit } = require("../utils/audit");

// Valid RBAC roles
const VALID_ROLES = [
  "admin",
  "staff",
  "technician",
  "reseller",
  "customer",
  "customer_care",
  "sales_team",
];

// Lazy db getter - avoids requiring pg at module load time
const getDb = () => (global.dbAvailable ? global.db : require("../db/memory"));

// ─── REGISTER ───
router.post("/register", authLimiter, async (req, res) => {
  try {
    const db = getDb();
    const { email, password, name, role } = req.body;
    if (!email || !password || !name)
      return res
        .status(400)
        .json({ error: "email, password, and name required" });

    // Validate role if provided, default to 'staff'
    const userRole = role && VALID_ROLES.includes(role) ? role : "staff";

    const existing = await db.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, created_at`,
      [uuidv4(), email, hash, name, userRole],
    );

    const token = jwt.sign(
      {
        id: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES },
    );

    logger.info("User registered", {
      email,
      userId: result.rows[0].id,
      role: userRole,
    });
    audit.userCreated(
      result.rows[0],
      { id: "system", name: "Self-registration", role: "system" },
      req,
    );

    res.status(201).json({ user: result.rows[0], token });
  } catch (e) {
    logger.error("Registration error", {
      error: e.message,
      email: req.body.email,
    });
    res.status(500).json({ error: e.message || String(e) });
  }
});

// ─── LOGIN ───
router.post("/login", authLimiter, async (req, res) => {
  try {
    const db = getDb();
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const user = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (user.rows.length === 0) {
      logger.warn("Login failed - user not found", { email, ip: req.ip });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!valid) {
      logger.warn("Login failed - invalid password", {
        email,
        userId: user.rows[0].id,
        ip: req.ip,
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check 2FA
    if (user.rows[0].two_factor_enabled) {
      const { two_factor_code } = req.body;
      if (!two_factor_code) {
        return res.status(200).json({
          requires_2fa: true,
          temp_token: jwt.sign(
            { id: user.rows[0].id, step: "2fa" },
            JWT_SECRET,
            { expiresIn: "5m" },
          ),
        });
      }

      const isValid = verifyTotp({
        token: two_factor_code,
        secret: user.rows[0].two_factor_secret,
      });

      if (!isValid) {
        return res.status(401).json({ error: "Invalid 2FA code" });
      }
    }

    await db.query(
      "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, is_online = true WHERE id = $1",
      [user.rows[0].id],
    );

    const token = jwt.sign(
      {
        id: user.rows[0].id,
        email: user.rows[0].email,
        role: user.rows[0].role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES },
    );

    logger.info("User logged in", {
      email,
      userId: user.rows[0].id,
      role: user.rows[0].role,
      ip: req.ip,
    });
    audit.userLogin(
      {
        id: user.rows[0].id,
        email: user.rows[0].email,
        name: user.rows[0].name,
        role: user.rows[0].role,
      },
      req,
    );

    res.json({
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        name: user.rows[0].name,
        role: user.rows[0].role,
      },
      token,
    });
  } catch (e) {
    logger.error("Login error", { error: e.message, email: req.body.email });
    res.status(500).json({ error: e.message });
  }
});

// ─── LOGOUT ───
router.post("/logout", async (req, res) => {
  try {
    const db = getDb();
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);

        // Set user as offline
        await db.query("UPDATE users SET is_online = false WHERE id = $1", [
          decoded.id,
        ]);

        logger.info("User logged out", {
          userId: decoded.id,
          email: decoded.email,
        });
      } catch (e) {
        // Token might be expired, but still try to proceed
        logger.warn("Logout with invalid token", { error: e.message });
      }
    }

    res.json({ success: true });
  } catch (e) {
    logger.error("Logout error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── GET ME ───
router.get("/me", async (req, res) => {
  try {
    const db = getDb();
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    const user = await db.query(
      "SELECT id, email, name, role, created_at, last_login_at FROM users WHERE id = $1",
      [decoded.id],
    );
    if (user.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(user.rows[0]);
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// ─── HEARTBEAT (update user activity) ───
router.post("/heartbeat", async (req, res) => {
  try {
    const db = getDb();
    const authHeader = req.headers.authorization;

    console.log("Heartbeat request received");
    console.log("Auth header:", authHeader ? "Present" : "Missing");

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("Heartbeat failed: No valid auth header");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    console.log("Heartbeat for user ID:", decoded.id, "Email:", decoded.email);

    const now = new Date();

    const result = await db.query(
      `UPDATE users
       SET last_seen = $1, is_online = true
       WHERE id = $2
       RETURNING id, email, is_online, last_seen`,
      [now.toISOString(), decoded.id],
    );

    console.log("Heartbeat update result:", result.rows[0]);

    res.json({ success: true, last_seen: now.toISOString() });
  } catch (e) {
    console.error("Heartbeat error:", e.message);
    console.error("Heartbeat error stack:", e.stack);
    res.status(500).json({ error: "Failed to update activity" });
  }
});

// ─── Auth middleware (defined before 2FA routes reference it)
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ error: "Authentication required" });
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─── 2FA SETUP ─── Generate secret and QR code
router.post("/2fa/setup", authenticate, async (req, res) => {
  try {
    const secret = generateSecret();
    const db = getDb();

    await db.query("UPDATE users SET two_factor_secret = $1 WHERE id = $2", [
      secret,
      req.user.id,
    ]);

    const otpauth = generateURI({
      issuer: "MikroTik Billing",
      label: req.user.email,
      secret,
      type: "totp",
    });
    const qrCode = await QRCode.toDataURL(otpauth);

    res.json({ secret, qrCode });
  } catch (e) {
    logger.error("2FA setup error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── 2FA ENABLE ─── Verify setup code and enable 2FA
router.post("/2fa/enable", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const db = getDb();
    const result = await db.query(
      "SELECT two_factor_secret FROM users WHERE id = $1",
      [req.user.id],
    );
    const secret = result.rows[0]?.two_factor_secret;

    if (!secret) return res.status(400).json({ error: "Setup 2FA first" });

    const isValid = verifyTotp({ token: code, secret });
    if (!isValid) return res.status(400).json({ error: "Invalid code" });

    await db.query("UPDATE users SET two_factor_enabled = true WHERE id = $1", [
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (e) {
    logger.error("2FA enable error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── 2FA DISABLE ─── Requires current code
router.post("/2fa/disable", authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    const db = getDb();
    const result = await db.query(
      "SELECT two_factor_secret FROM users WHERE id = $1",
      [req.user.id],
    );
    const secret = result.rows[0]?.two_factor_secret;

    const isValid = verifyTotp({ token: code, secret });
    if (!isValid) return res.status(400).json({ error: "Invalid code" });

    await db.query(
      "UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1",
      [req.user.id],
    );
    res.json({ success: true });
  } catch (e) {
    logger.error("2FA disable error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ─── 2FA STATUS ───
router.get("/2fa/status", authenticate, async (req, res) => {
  try {
    const result = await getDb().query(
      "SELECT two_factor_enabled FROM users WHERE id = $1",
      [req.user.id],
    );
    res.json({ enabled: result.rows[0]?.two_factor_enabled || false });
  } catch (e) {
    logger.error("2FA status error", { error: e.message });
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
module.exports.authenticate = authenticate;
