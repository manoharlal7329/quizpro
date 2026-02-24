const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const router = express.Router();

/**
 * ONLY ONE ADMIN
 */
const ADMIN = {
  name: "Manohar Lal Prajapati",
  email: "manoharlala02911@gmail.com",

  // Password: Manohar2005@@
  passwordHash: "$2b$10$P6Fn7xRkj/9EZgPoYu.Ca.6thydLw5yaIjkXMsHaasMgwwhABc18W"
};

const { data } = require('../database/db');

router.post("/login", async (req, res) => {
  try {
    console.log(`[ADMIN-AUTH] Login attempt for: ${req.body.email}`);
    const { email, password } = req.body;

    if (email !== ADMIN.email) {
      console.log(`[ADMIN-AUTH] Email mismatch: ${email} !== ${ADMIN.email}`);
      return res.status(401).json({ error: "Invalid admin email" });
    }

    const ok = await bcrypt.compare(password, ADMIN.passwordHash);
    if (!ok) {
      console.log(`[ADMIN-AUTH] Password mismatch for: ${email}`);
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      {
        role: "admin",
        id: 1, // Admin user ID
        email: ADMIN.email,
        name: ADMIN.name
      },
      process.env.JWT_SECRET || 'fallback_secret_key_dont_use_in_production',
      { expiresIn: "7d" }
    );

    console.log(`[ADMIN-AUTH] Login SUCCESS for: ${email}`);
    res.json({
      success: true,
      token,
      user: {
        id: 1,
        name: ADMIN.name,
        email: ADMIN.email,
        is_admin: 1
      }
    });
  } catch (error) {
    console.error(`[ADMIN-AUTH] CRITICAL ERROR:`, error);
    res.status(500).json({ error: "Internal Server Error during authentication" });
  }
});

module.exports = router;