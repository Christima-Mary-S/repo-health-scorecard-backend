// Load environment variables from .env into process.env
require("dotenv").config();

module.exports = {
  github: {
    // Personal access token or OAuth token
    token: process.env.GITHUB_TOKEN,
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  scorecard: {
    // CLI name or path for OpenSSF Scorecards (must be on PATH)
    cliPath: "scorecard",
  },
};
