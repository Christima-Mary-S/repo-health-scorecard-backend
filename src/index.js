// src/index.js
require("dotenv").config();
const express = require("express");
const repoRoutes = require("./routes/repoRoutes");
const { errorHandler } = require("./middlewares/authMiddleware");

const app = express();

// Middleware: parse JSON
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get("/ping", (req, res) => {
  res.json({ pong: true });
});
// ===== Temporary Test Endpoints (for debugging) =====

// 1. Rate‐limit status
app.get("/rate-limit", async (req, res, next) => {
  try {
    const { Octokit } = require("@octokit/rest");
    const config = require("./config");
    const octokit = new Octokit({ auth: config.github.token });
    const { data } = await octokit.rest.rateLimit.get();
    res.json({
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: data.rate.reset, // UNIX timestamp when limit resets
    });
  } catch (err) {
    next(err);
  }
});

// 2. Issues (first 100, last 6 months) → median resolution
app.get("/api/score/issues-test/:owner/:repo", async (req, res, next) => {
  try {
    const { listIssues } = require("./services/githubService");
    const { medianResolutionTime } = require("./utils/metricsCalculator");
    const issues = await listIssues(req.params.owner, req.params.repo);
    const median = medianResolutionTime(issues);
    res.json({ issuesFetched: issues.length, medianResolutionHrs: median });
  } catch (e) {
    next(e);
  }
});

// 3. PRs (first 100, last 6 months) → median review duration
app.get("/api/score/prs-test/:owner/:repo", async (req, res, next) => {
  try {
    const { listPRs } = require("./services/githubService");
    const { medianPRDuration } = require("./utils/metricsCalculator");
    const prs = await listPRs(req.params.owner, req.params.repo);
    const median = medianPRDuration(prs);
    res.json({ prsFetched: prs.length, medianReviewHrs: median });
  } catch (e) {
    next(e);
  }
});

// 4. Contributors → count, bus factor, churn (churn is stubbed)
app.get("/api/score/contrib-test/:owner/:repo", async (req, res, next) => {
  try {
    const { listContributors } = require("./services/githubService");
    const {
      estimateBusFactor,
      computeChurn,
    } = require("./utils/metricsCalculator");
    const contribs = await listContributors(req.params.owner, req.params.repo);
    res.json({
      contributorsFetched: contribs.length,
      busFactor: estimateBusFactor(contribs),
      churn: computeChurn(contribs, []), // stub
    });
  } catch (e) {
    next(e);
  }
});

// 5. Root‐level tree → test folder presence
app.get("/api/score/tree-test/:owner/:repo", async (req, res, next) => {
  try {
    const { getRepoTree } = require("./services/githubService");
    const { existsTestFolder } = require("./utils/metricsCalculator");
    const rootContent = await getRepoTree(req.params.owner, req.params.repo);
    res.json({
      entries: rootContent.length,
      testFolderExists: existsTestFolder(rootContent),
    });
  } catch (e) {
    next(e);
  }
});

// 6. README → badge count
app.get("/api/score/readme-test/:owner/:repo", async (req, res, next) => {
  try {
    const { getReadme } = require("./services/githubService");
    const { countBadges } = require("./utils/metricsCalculator");
    const md = await getReadme(req.params.owner, req.params.repo);
    res.json({
      badgeCount: countBadges(md),
      snippet: md.slice(0, 100),
    });
  } catch (e) {
    next(e);
  }
});

// 7. Dependabot alerts → vulnerability count
app.get("/api/score/vuln-test/:owner/:repo", async (req, res, next) => {
  try {
    const { getDependabotAlerts } = require("./services/githubService");
    const { countVulnerabilities } = require("./utils/metricsCalculator");
    const alerts = await getDependabotAlerts(req.params.owner, req.params.repo);
    res.json({
      alertsFetched: alerts.length,
      openVulnerabilities: countVulnerabilities(alerts),
    });
  } catch (e) {
    next(e);
  }
});

// Mount our repository score routes
app.use("/api/score", repoRoutes);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

app.get("/error-test", (req, res, next) => {
  const err = new Error("This is a test error");
  err.status = 418; // I'm a teapot
  next(err);
});

app.get("/api/score/tree-test/:owner/:repo", async (req, res, next) => {
  try {
    const rootContent = await require("./services/githubService").getRepoTree(
      req.params.owner,
      req.params.repo
    );
    const hasTests = require("./utils/metricsCalculator").existsTestFolder(
      rootContent
    );
    res.json({ entries: rootContent.length, testFolderExists: hasTests });
  } catch (e) {
    next(e);
  }
});
