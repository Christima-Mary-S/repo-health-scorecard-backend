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

/**
 * Fetch all issues (open & closed) created in the last 6 months.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ created_at: string, closed_at: string }>>}
 */
async function listIssues(owner, repo) {
  // ISO string for 6 months ago
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const issues = [];
  let page = 1;

  // GitHub paginates at 100 items/page
  while (true) {
    const res = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "all",
      since,
      per_page: 100,
      page,
    });
    if (res.status !== 200) {
      const err = new Error(`GitHub issues API returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    // Only keep created_at & closed_at
    const batch = res.data.map((issue) => ({
      created_at: issue.created_at,
      closed_at: issue.closed_at,
    }));
    issues.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return issues;
}

/**
 * Fetch all pull requests (open & closed) created in the last 6 months.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ created_at: string, merged_at: string|null, closed_at: string|null }>>}
 */
async function listPRs(owner, repo) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const prs = [];
  let page = 1;

  while (true) {
    const res = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "created",
      direction: "asc",
      per_page: 100,
      page,
    });
    if (res.status !== 200) {
      const err = new Error(`GitHub PRs API returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const batch = res.data.map((pr) => ({
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      closed_at: pr.closed_at,
    }));
    prs.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return prs;
}

/**
 * Fetch all contributors (non-anonymous) for a repository.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ login: string, contributions: number }>>}
 */
async function listContributors(owner, repo) {
  const contributors = [];
  let page = 1;

  // GitHub paginates at 100 items/page
  while (true) {
    const res = await octokit.rest.repos.listContributors({
      owner,
      repo,
      anon: false,
      per_page: 100,
      page,
    });
    if (res.status !== 200) {
      const err = new Error(`GitHub contributors API returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    contributors.push(
      ...res.data.map((c) => ({
        login: c.login,
        contributions: c.contributions,
      }))
    );
    if (res.data.length < 100) break;
    page++;
  }
  return contributors;
}

/**
 * Check for a `test` or `tests` directory at the repo root.
 * Much faster than fetching the entire recursive tree.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ name: string, type: string }>>}
 */
async function getRepoTree(owner, repo) {
  // Fetch root‐level contents only
  const res = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: "", // empty path == repo root
  });
  if (res.status !== 200) {
    const err = new Error(`GitHub content API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  // res.data is an array of { name, path, type, ... }
  return res.data.map((entry) => ({
    name: entry.name,
    type: entry.type, // "file" or "dir"
  }));
}

/**
 * Fetches the repository README as raw Markdown.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<string>} The README content in UTF-8.
 */
async function getReadme(owner, repo) {
  // GitHub API returns base64-encoded content by default
  const res = await octokit.rest.repos.getReadme({
    owner,
    repo,
  });
  // Decode from base64 to UTF-8 string
  const md = Buffer.from(res.data.content, "base64").toString("utf-8");
  return md;
}

const GITHUB_ALERTS_ENDPOINT = "GET /repos/{owner}/{repo}/dependabot/alerts";

/**
 * Fetch all Dependabot alerts for a repository.
 * Returns an empty array on 403/404 (not authorized or alerts not enabled).
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ number: number, state: string }>>}
 */
async function getDependabotAlerts(owner, repo) {
  const alerts = [];
  let page = 1;

  try {
    while (true) {
      const res = await octokit.request(GITHUB_ALERTS_ENDPOINT, {
        owner,
        repo,
        per_page: 100,
        page,
      });
      // GitHub returns 200 + data array
      alerts.push(
        ...res.data.map((a) => ({
          number: a.number,
          state: a.state,
        }))
      );
      if (res.data.length < 100) break;
      page++;
    }
  } catch (err) {
    // If not authorized or alerts not enabled, return empty list
    if (err.status === 403 || err.status === 404) {
      console.warn(
        `Dependabot alerts not accessible for ${owner}/${repo}: ${err.message}`
      );
      return [];
    }
    // Propagate other errors
    throw err;
  }

  return alerts;
}

module.exports = {
  getCommitActivity,
  listIssues,
  listPRs,
  listContributors,
  getRepoTree,
  getReadme,
  getDependabotAlerts,
};
