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

module.exports = {
  computeWeeklyAverage,
};
