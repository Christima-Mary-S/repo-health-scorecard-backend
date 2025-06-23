module.exports = {
  github: {
    token: process.env.GITHUB_TOKEN,
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  scorecard: {
    cliPath: "scorecard", // ensure CLI is on your PATH
  },
};
