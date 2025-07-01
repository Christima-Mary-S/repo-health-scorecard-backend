const {
  getCommitActivity,
  listIssues,
  listPRs,
  listContributors,
  getRepoTree,
  getReadme,
  getDependabotAlerts,
} = require("../services/githubService");
const { runScorecard } = require("../services/scorecardService");
const {
  computeWeeklyAverage,
  medianResolutionTime,
  medianPRDuration,
  existsTestFolder,
  countBadges,
  computeChurn,
  estimateBusFactor,
  countVulnerabilities,
} = require("../utils/metricsCalculator");

/**
 * GET /api/score/:owner/:repo
 * Returns all ten metrics plus ossfScore; errors per metric are collected.
 */
async function getRepoScore(req, res, next) {
  const { owner, repo } = req.params;
  const metrics = {
    commitFreq: null,
    issueResTime: null,
    prReviewDuration: null,
    contributorCount: null,
    testFolderExists: null,
    badgeCount: null,
    developerChurn: null,
    busFactor: null,
    vulnerabilityCount: null,
    ossfScore: null,
  };
  const errors = {};

  // Kick off all calls in parallel
  const calls = {
    commitData: getCommitActivity(owner, repo).catch((err) => {
      errors.commitFreq = err.message;
      return null;
    }),
    issues: listIssues(owner, repo).catch((err) => {
      errors.issueResTime = err.message;
      return null;
    }),
    prs: listPRs(owner, repo).catch((err) => {
      errors.prReviewDuration = err.message;
      return null;
    }),
    contributors: listContributors(owner, repo).catch((err) => {
      errors.contributorCount = err.message;
      return null;
    }),
    tree: getRepoTree(owner, repo).catch((err) => {
      errors.testFolderExists = err.message;
      return null;
    }),
    readme: getReadme(owner, repo).catch((err) => {
      errors.badgeCount = err.message;
      return null;
    }),
    alerts: getDependabotAlerts(owner, repo).catch((err) => {
      errors.vulnerabilityCount = err.message;
      return null;
    }),
    scoreRes: runScorecard(owner, repo).catch((err) => {
      errors.ossfScore = err.message;
      return null;
    }),
  };

  // Await them all
  const [
    commitData,
    issues,
    prs,
    contributors,
    tree,
    readme,
    alerts,
    scoreRes,
  ] = await Promise.all([
    calls.commitData,
    calls.issues,
    calls.prs,
    calls.contributors,
    calls.tree,
    calls.readme,
    calls.alerts,
    calls.scoreRes,
  ]);

  // Compute metrics (only if data arrived)
  if (commitData) metrics.commitFreq = computeWeeklyAverage(commitData);
  if (issues) metrics.issueResTime = medianResolutionTime(issues);
  if (prs) metrics.prReviewDuration = medianPRDuration(prs);
  if (contributors) {
    metrics.contributorCount = contributors.length;
    metrics.busFactor = estimateBusFactor(contributors);
    metrics.developerChurn = computeChurn(contributors, commitData || []);
  }
  if (tree) metrics.testFolderExists = existsTestFolder(tree);
  if (readme) metrics.badgeCount = countBadges(readme);
  if (alerts) metrics.vulnerabilityCount = countVulnerabilities(alerts);
  if (scoreRes) metrics.ossfScore = scoreRes.Score;

  const response = { owner, repo, metrics };
  if (Object.keys(errors).length) response.errors = errors;

  return res.json(response);
}

module.exports = { getRepoScore };
