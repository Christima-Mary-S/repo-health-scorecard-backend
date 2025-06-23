require("dotenv").config();
const express = require("express");
const repoRoutes = require("./routes/repoRoutes");
const { errorHandler } = require("./middlewares/authMiddleware");

const app = express();
app.use(express.json());

// Mount our MVC routes
app.use("/api/score", repoRoutes);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
