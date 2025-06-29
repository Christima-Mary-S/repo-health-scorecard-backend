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

// app.get("/test-commits/:owner/:repo", async (req, res, next) => {
//   const { owner, repo } = req.params;
//   try {
//     const data = await require("./services/githubService").getCommitActivity(
//       owner,
//       repo
//     );
//     // Return count of weeks and first-week sample
//     res.json({ weeks: data.length, sample: data[0] });
//   } catch (err) {
//     next(err);
//   }
// });
