const {
  getCommitActivity,
  listRecentClosedIssues,
  listRecentClosedPRs,
  listContributors,
  getReadme,
  getDependabotAlerts,
  getDeveloperChurn,
  getTestPresence,
} = require("../services/githubService");

// const { runScorecard } = require('../services/scorecardService'); // Uncomment if using OSSF Scorecards

const {
  computeWeeklyAverage,
  medianResolutionTime,
  medianPRDuration,
  countBadges,
  estimateBusFactor,
  countVulnerabilities,
} = require("../utils/metricsCalculator");

const { aggregateScore } = require("../utils/scoreAggregator");

/**
 * GET /api/score/:owner/:repo
 * Returns repository health metrics.
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
    overallScore: null,
  };
  const errors = {};

  // Execute all data-fetching calls in parallel
  const calls = {
    commitData: getCommitActivity(owner, repo).catch((err) => {
      errors.commitFreq = err.message;
      return null;
    }),
    issues: listRecentClosedIssues(owner, repo).catch((err) => {
      errors.issueResTime = err.message;
      return null;
    }),
    prs: listRecentClosedPRs(owner, repo).catch((err) => {
      errors.prReviewDuration = err.message;
      return null;
    }),
    contributors: listContributors(owner, repo).catch((err) => {
      errors.contributorCount = err.message;
      return null;
    }),
    testExists: getTestPresence(owner, repo).catch((err) => {
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
    churn: getDeveloperChurn(owner, repo).catch((err) => {
      errors.developerChurn = err.message;
      return null;
    }),
  };

  const [
    commitData,
    issues,
    prs,
    contributors,
    testExists,
    readme,
    alerts,
    churn,
  ] = await Promise.all([
    calls.commitData,
    calls.issues,
    calls.prs,
    calls.contributors,
    calls.testExists,
    calls.readme,
    calls.alerts,
    calls.churn,
  ]);

  // Compute metrics from fetched data
  if (commitData) {
    metrics.commitFreq = computeWeeklyAverage(commitData);
  }
  if (issues) {
    metrics.issueResTime = medianResolutionTime(issues);
  }
  if (prs) {
    metrics.prReviewDuration = medianPRDuration(prs);
  }
  if (contributors) {
    metrics.contributorCount = contributors.length;
    metrics.busFactor = estimateBusFactor(contributors);
  }
  // Developer churn from service
  if (churn !== null) {
    metrics.developerChurn = churn;
  }
  if (testExists !== null) metrics.testFolderExists = testExists;
  if (readme) {
    metrics.badgeCount = countBadges(readme);
  }
  if (alerts) {
    metrics.vulnerabilityCount = countVulnerabilities(alerts);
  }

  metrics.overallScore = aggregateScore(metrics);

  const response = { owner, repo, metrics };
  if (Object.keys(errors).length) {
    response.errors = errors;
  }
  return res.json(response);
}

module.exports = { getRepoScore };
