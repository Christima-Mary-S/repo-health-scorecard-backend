const githubService = require("../services/githubService");
const scorecardService = require("../services/scorecardService");
const metricsCalculator = require("../utils/metricsCalculator");

exports.getRepoScore = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    // 1. Fetch raw data in parallel
    const [
      commits,
      issues,
      prs,
      contributors,
      tree,
      readme,
      alerts,
      scorecard,
    ] = await Promise.all([
      githubService.getCommitActivity(owner, repo),
      githubService.listIssues(owner, repo),
      githubService.listPRs(owner, repo),
      githubService.listContributors(owner, repo),
      githubService.getRepoTree(owner, repo),
      githubService.getReadme(owner, repo),
      githubService.getDependabotAlerts(owner, repo),
      scorecardService.runScorecard(owner, repo),
    ]);

    // 2. Compute metrics
    const metrics = {
      commitFreq: metricsCalculator.computeWeeklyAverage(commits),
      issueResTime: metricsCalculator.medianResolutionTime(issues),
      prReviewDuration: metricsCalculator.medianPRDuration(prs),
      contributorCount: contributors.length,
      testFolderExists: metricsCalculator.existsTestFolder(tree),
      badgeCount: metricsCalculator.countBadges(readme),
      developerChurn: metricsCalculator.computeChurn(contributors, commits),
      busFactor: metricsCalculator.estimateBusFactor(contributors, commits),
      vulnerabilityCount: alerts.filter((a) => a.state === "open").length,
      ossfScore: scorecard.Score,
    };

    res.json(metrics);
  } catch (err) {
    next(err);
  }
};
