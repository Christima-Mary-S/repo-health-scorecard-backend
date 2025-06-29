// src/controllers/repoController.js

const { getCommitActivity } = require("../services/githubService");
const { runScorecard } = require("../services/scorecardService");
const { computeWeeklyAverage } = require("../utils/metricsCalculator");

/**
 * GET /api/score/:owner/:repo
 * Returns key metrics: commitFreq and ossfScore, plus any partial errors.
 */
async function getRepoScore(req, res, next) {
  const { owner, repo } = req.params;
  let commitFreq = null;
  let ossfScore = null;
  const errors = {};

  // 1. Fetch commit activity & compute weekly average
  try {
    const commitData = await getCommitActivity(owner, repo);
    commitFreq = computeWeeklyAverage(commitData);
  } catch (err) {
    console.warn(`Could not fetch commits for ${owner}/${repo}:`, err.message);
    errors.commitError = err.message;
  }

  // 2. Run OpenSSF Scorecard
  try {
    const scoreResult = await runScorecard(owner, repo, ["Maintained"]);
    ossfScore = scoreResult.Score;
  } catch (err) {
    console.warn(`Scorecard failed for ${owner}/${repo}:`, err.message);
    errors.scorecardError = err.message;
  }

  // 3. Build response payload
  const response = {
    owner,
    repo,
    metrics: { commitFreq, ossfScore },
  };
  if (Object.keys(errors).length) {
    response.errors = errors;
  }

  return res.json(response);
}

module.exports = {
  getRepoScore,
};
