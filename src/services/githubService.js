const { Octokit } = require("@octokit/rest");
const config = require("../config");

// Initialize Octokit with authentication token from config
const octokit = new Octokit({
  auth: config.github.token,
});

/**
 * Fetches weekly commit activity for the past year.
 *
 * GitHub returns an array of 52 objects:
 *   { week: <unix_timestamp>, total: <number_of_commits>, days: [<commits_per_day>] }
 *
 * @param {string} owner  - GitHub owner or organization name
 * @param {string} repo   - Repository name
 * @returns {Promise<Array<{ week: number, total: number, days: number[] }>>}
 * @throws {Error}        - If GitHub responds with non-200 status
 */
async function getCommitActivity(owner, repo) {
  // Call GitHub’s stats/commit_activity endpoint
  const response = await octokit.rest.repos.getCommitActivityStats({
    owner,
    repo,
  });

  // If GitHub hasn't computed stats yet, it may return 202
  if (response.status !== 200) {
    const msg = `GitHub API returned status ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  // response.data is the array of weekly commit stats
  return response.data;
}

module.exports = {
  getCommitActivity,
};
