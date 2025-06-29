// src/routes/repoRoutes.js

const express = require("express");
const { getRepoScore } = require("../controllers/repoController");
const router = express.Router();

// Existing test route
router.get("/test", (req, res) => {
  res.json({ ok: true });
});

// New dynamic route for owner/repo
router.get("/:owner/:repo", getRepoScore);

module.exports = router;
