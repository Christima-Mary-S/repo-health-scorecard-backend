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
 * Fetch the full repository file tree for the default branch.
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<Array<{ path: string, type: string }>>}
 */
async function getRepoTree(owner, repo) {
  // 1. Get default branch SHA
  const { data: repoInfo } = await octokit.rest.repos.get({
    owner,
    repo,
  });
  const branchSha = repoInfo.default_branch
    ? (
        await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: repoInfo.default_branch,
        })
      ).data.commit.sha
    : repoInfo.pushed_at; // fallback

  // 2. Fetch the tree recursively
  const res = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branchSha,
    recursive: "1",
  });
  if (res.status !== 200) {
    const err = new Error(`GitHub tree API returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  // Return array of { path, type } entries
  return res.data.tree.map((entry) => ({
    path: entry.path,
    type: entry.type,
  }));
}

module.exports = {
  getCommitActivity,
  listIssues,
  listPRs,
  listContributors,
  getRepoTree,
};
