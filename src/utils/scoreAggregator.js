/**
 * Normalise a raw metric to 0-10.
 * Each metric has its own linear rule.
 */
function normalise(metricKey, raw) {
  switch (metricKey) {
    case "commitFreq": // commits / week
      return Math.min(10, (raw / 30) * 10);
    case "issueResTime": // hours
      return Math.max(0, 10 - (raw - 24) * (10 / 144)); // 24h→10, 168h→0
    case "prReviewDuration": // hours
      return Math.max(0, 10 - (raw - 6) * (10 / 66)); // 6h→10, 72h→0
    case "contributorCount":
      return Math.min(10, (raw / 200) * 10);
    case "busFactor":
      return Math.min(10, (raw / 10) * 10);
    case "developerChurn": // percentage
      return Math.max(0, 10 - raw * 0.1); // 0%→10, 100%→0
    case "testFolderExists": // boolean
      return raw ? 10 : 0;
    case "badgeCount":
      return Math.min(10, (raw / 6) * 10);
    case "vulnerabilityCount":
      return Math.max(0, 10 - raw); // 0→10, 10+→0
    case "ossfScore":
      return raw; // already 0-10
    default:
      return 0;
  }
}

/** weight map (%); must sum to 100 */
const weights = {
  commitFreq: 10,
  issueResTime: 12,
  prReviewDuration: 12,
  contributorCount: 8,
  busFactor: 10,
  developerChurn: 10,
  testFolderExists: 10,
  badgeCount: 5,
  vulnerabilityCount: 13,
  ossfScore: 10,
};

/**
 * Compute weighted composite (0-100).
 * @param {object} metrics – keys must include all metric fields.
 */
function aggregateScore(metrics) {
  let total = 0;
  Object.keys(weights).forEach((key) => {
    const raw = metrics[key];
    if (raw === null || raw === undefined) return;
    const normalised = normalise(key, raw);
    total += (normalised * weights[key]) / 10; // weight% * (0-10)/10
  });
  return Math.round(total); // nearest integer 0-100
}

module.exports = { normalise, aggregateScore, weights };
