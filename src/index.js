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

app.get("/api/score/contrib-test/:owner/:repo", async (req, res, next) => {
  try {
    const contributors =
      await require("./services/githubService").listContributors(
        req.params.owner,
        req.params.repo
      );
    const busFactor = require("./utils/metricsCalculator").estimateBusFactor(
      contributors
    );
    // computeChurn is stubbed, will return null
    const churn = require("./utils/metricsCalculator").computeChurn(
      contributors
    );
    res.json({ contributorsFetched: contributors.length, busFactor, churn });
  } catch (e) {
    next(e);
  }
});
