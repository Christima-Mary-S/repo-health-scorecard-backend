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

/**
 * Compute churn: % of contributors active 12-24 months ago who did NOT contribute in last 12 months.
 * Currently a stub returning null (requires commit history per contributor).
 *
 * @param {Array<{ login: string, contributions: number }>} contributors
 * @param {Array<{ week: number, total: number }>} commitData
 * @returns {null}
 */
function computeChurn(contributors, commitData) {
  // TODO: implement time-based contributor churn logic
  return null;
}

/**
 * Estimate bus factor: minimum number of top contributors whose combined contributions
 * account for ≥50% of total contributions.
 *
 * @param {Array<{ login: string, contributions: number }>} contributors
 * @returns {number}
 */
function estimateBusFactor(contributors) {
  // Sort contributors by contributions descending
  const sorted = [...contributors].sort(
    (a, b) => b.contributions - a.contributions
  );
  const total = sorted.reduce((sum, c) => sum + c.contributions, 0);
  let acc = 0;
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i].contributions;
    if (acc >= total / 2) {
      return i + 1; // count of contributors
    }
  }
  return sorted.length;
}

/**
 * Checks if a root‐level `test` or `tests` directory exists.
 *
 * @param {Array<{ name: string, type: string }>} rootContent
 * @returns {boolean}
 */
function existsTestFolder(rootContent) {
  return rootContent.some(
    (entry) => entry.type === "dir" && /^tests?$/i.test(entry.name)
  );
}

/**
 * Counts the number of Markdown image links (badges) in the README.
 * Filters to URLs that include the word "badge" to avoid counting all images.
 *
 * @param {string} readmeMd  The raw Markdown content of the README.
 * @returns {number} Number of badge images found.
 */
function countBadges(readmeMd) {
  if (typeof readmeMd !== "string") return 0;
  const regex = /!\[.*?\]\((.*?)\)/g;
  let match;
  let count = 0;
  while ((match = regex.exec(readmeMd)) !== null) {
    const url = match[1];
    if (/badge/i.test(url)) {
      count++;
    }
  }
  return count;
}

/**
 * Count the number of open Dependabot alerts.
 *
 * @param {Array<{ state: string }>} alerts
 * @returns {number} Number of alerts with state === 'open'
 */
function countVulnerabilities(alerts) {
  if (!Array.isArray(alerts)) return 0;
  return alerts.filter((a) => a.state === "open").length;
}

module.exports = {
  computeWeeklyAverage,
  medianResolutionTime,
  medianPRDuration,
  computeChurn,
  estimateBusFactor,
  existsTestFolder,
  countBadges,
  countVulnerabilities,
};
