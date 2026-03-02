const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../database/models/User");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), is_admin: 1 });

    if (!user) {
      return res.status(401).json({ error: "Invalid admin email" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: "Wrong password" });
    }

    const token = jwt.sign(
      { role: "admin", id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, is_admin: 1 }
    });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
