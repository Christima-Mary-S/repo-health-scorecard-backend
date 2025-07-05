const { Octokit } = require("@octokit/rest");
const config = require("../config");
const { computeDeveloperChurn } = require("../utils/metricsCalculator");

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
 * Fetch up to 100 most recent closed issues created in the last 6 months
 * via GitHub’s Search API (fast, one call).
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ created_at: string, closed_at: string }>>}
 */
async function listRecentClosedIssues(owner, repo) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  // Build the search query
  const q = [
    `repo:${owner}/${repo}`,
    "type:issue",
    "is:closed",
    `created:>=${since}`,
  ].join(" ");

  const res = await octokit.rest.search.issuesAndPullRequests({
    q,
    sort: "created",
    order: "desc",
    per_page: 100,
    page: 1,
  });

  if (res.status !== 200) {
    const err = new Error(`GitHub Search API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  // Map to the same shape as before
  return res.data.items.map((issue) => ({
    created_at: issue.created_at,
    closed_at: issue.closed_at,
  }));
}

/**
 * Fetch up to 100 most recent closed pull requests created in the last 6 months
 * via GitHub’s Search API (fast, one call).
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ created_at: string, closed_at: string }>>}
 */
async function listRecentClosedPRs(owner, repo) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  // Build the search query
  const q = [
    `repo:${owner}/${repo}`,
    "type:pr",
    "is:closed",
    `created:>=${since}`,
  ].join(" ");

  const res = await octokit.rest.search.issuesAndPullRequests({
    q,
    sort: "created",
    order: "desc",
    per_page: 100,
    page: 1,
  });

  if (res.status !== 200) {
    const err = new Error(`GitHub Search API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  // The Search API returns PRs as items with created_at & closed_at
  return res.data.items.map((pr) => ({
    created_at: pr.created_at,
    closed_at: pr.closed_at,
  }));
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
 * Returns true if the repo contains any test files or __tests__ folders anywhere.
 *
 * Uses GitHub’s Code Search API to look for:
 *  - any filename matching *.test.*
 *  - any path segment named __tests__
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<boolean>}
 */
async function getTestPresence(owner, repo) {
  // Patterns to try
  const queries = [
    // catches files named *.test.js, *.test.tsx, etc.
    `repo:${owner}/${repo} filename:*.test.*`,
    // catches any directory named __tests__ at any depth
    `repo:${owner}/${repo} in:path __tests__`,
  ];

  for (const q of queries) {
    const res = await octokit.rest.search.code({
      q,
      per_page: 1,
      page: 1,
    });
    if (res.status !== 200) {
      throw new Error(`Code search API returned ${res.status}`);
    }
    if (res.data.total_count > 0) {
      return true;
    }
  }
  return false;
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

/**
 * Compute developer churn % by sampling top contributors.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} sampleSize     how many top contributors to sample (default 50)
 * @returns {Promise<number|null>} churn percentage (0–100) or null if no old contributors
 */
async function getDeveloperChurn(owner, repo, sampleSize = 50) {
  // 1. Fetch the top `sampleSize` contributors
  const contribRes = await octokit.rest.repos.listContributors({
    owner,
    repo,
    anon: false,
    per_page: sampleSize,
    page: 1,
  });
  if (contribRes.status !== 200) {
    const err = new Error(`Contributors API returned ${contribRes.status}`);
    err.status = contribRes.status;
    throw err;
  }
  const logins = contribRes.data.map((c) => c.login);

  // 2. Define time windows
  const twelveMoAgo = new Date(
    Date.now() - 365 * 24 * 60 * 60 * 1000
  ).toISOString();
  const twoYearsAgo = new Date(
    Date.now() - 2 * 365 * 24 * 60 * 60 * 1000
  ).toISOString();

  // 3. Build two Sets in parallel
  const oldSetPromise = Promise.all(
    logins.map(async (login) => {
      const r = await octokit.rest.repos.listCommits({
        owner,
        repo,
        author: login,
        since: twoYearsAgo,
        until: twelveMoAgo,
        per_page: 1,
      });
      return r.data.length > 0 ? login : null;
    })
  ).then((arr) => new Set(arr.filter(Boolean)));

  const recentSetPromise = Promise.all(
    logins.map(async (login) => {
      const r = await octokit.rest.repos.listCommits({
        owner,
        repo,
        author: login,
        since: twelveMoAgo,
        per_page: 1,
      });
      return r.data.length > 0 ? login : null;
    })
  ).then((arr) => new Set(arr.filter(Boolean)));

  const [oldSet, recentSet] = await Promise.all([
    oldSetPromise,
    recentSetPromise,
  ]);

  // 4. Delegate to your util
  return computeDeveloperChurn(oldSet, recentSet);
}

module.exports = {
  getCommitActivity,
  listRecentClosedIssues,
  listRecentClosedPRs,
  listContributors,
  getTestPresence,
  getReadme,
  getDependabotAlerts,
  getDeveloperChurn,
};
