/**
 * Compute the average number of commits per week.
 *
 * @param {Array<{ week: number, total: number, days: number[] }>} commitData
 * @returns {number} Average commits per week (floating point)
 */
function computeWeeklyAverage(commitData) {
  // If no data or not an array, guard to zero
  if (!Array.isArray(commitData) || commitData.length === 0) {
    return 0;
  }

  // Sum up the `total` commits for each week
  const totalCommits = commitData.reduce((sum, weekObj) => {
    // weekObj.total might be undefined if malformed; default to 0
    return sum + (weekObj.total || 0);
  }, 0);

  // Divide by number of weeks to get the mean
  return totalCommits / commitData.length;
}

/**
 * Compute median resolution time (in hours) for issues.
 * Excludes issues that are still open (closed_at null).
 *
 * @param {Array<{ created_at: string, closed_at: string }>} issues
 * @returns {number} Median hours to close, or 0 if none closed.
 */
function medianResolutionTime(issues) {
  // Filter only closed issues
  const durations = issues
    .filter((i) => i.closed_at)
    .map((i) => {
      const created = new Date(i.created_at);
      const closed = new Date(i.closed_at);
      // hours difference
      return (closed - created) / (1000 * 60 * 60);
    })
    .sort((a, b) => a - b);

  if (durations.length === 0) return 0;
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[mid - 1] + durations[mid]) / 2
    : durations[mid];
}

/**
 * Compute median PR review duration (in hours).
 * Uses merged_at if available, otherwise closed_at.
 *
 * @param {Array<{ created_at: string, merged_at: string|null, closed_at: string|null }>} prs
 * @returns {number} Median hours, or 0 if none closed/merged.
 */
function medianPRDuration(prs) {
  const durations = prs
    .map((pr) => {
      const start = new Date(pr.created_at);
      const endDate = pr.merged_at || pr.closed_at;
      if (!endDate) return null;
      const end = new Date(endDate);
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((d) => d !== null)
    .sort((a, b) => a - b);

  if (durations.length === 0) return 0;
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0
    ? (durations[mid - 1] + durations[mid]) / 2
    : durations[mid];
}

module.exports = {
  computeWeeklyAverage,
  medianResolutionTime,
  medianPRDuration,
};
