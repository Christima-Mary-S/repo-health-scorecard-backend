/**
 * Global error handler middleware.
 * Catches any error passed via next(err) and returns JSON.
 */
function errorHandler(err, req, res, next) {
  // Log full stack to console for debugging
  console.error(err.stack);

  // Determine status code (default 500) and message
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  // Send JSON response
  res.status(status).json({ message });
}

module.exports = {
  errorHandler,
};
