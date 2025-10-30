const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/auth");

router.get("/", requireAuth, (req, res) => {
  const user = req.session.user;
  res.json({ message: "Bonjour " + user.displayName });
});

module.exports = router;
