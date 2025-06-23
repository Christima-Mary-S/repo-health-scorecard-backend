const express = require("express");
const router = express.Router();
const repoController = require("../controllers/repoController");

// GET /api/score/:owner/:repo
router.get("/:owner/:repo", repoController.getRepoScore);

module.exports = router;
