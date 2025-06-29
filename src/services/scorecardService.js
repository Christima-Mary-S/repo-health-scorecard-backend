// src/services/scorecardService.js

const { exec } = require("child_process");
const config = require("../config");

/**
 * Runs the OpenSSF Scorecards CLI for a given repository.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string[]} checks
 * @returns {Promise<{ Score: number, Checks: Array }>}
 */
function runScorecard(owner, repo, checks = []) {
  return new Promise((resolve, reject) => {
    const repoPath = `${owner}/${repo}`;
    const checksArg = checks.length ? ` --checks=${checks.join(",")}` : "";
    const cmd = `${config.scorecard.cliPath} --repo=${repoPath} --format=json${checksArg}`;

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(stderr || err.message));
      }

      // // —— DEBUG: raw scorecard stdout ——
      // console.log("--- DEBUG: raw scorecard stdout ---");
      // console.log(stdout);
      // console.log("--- DEBUG: end raw stdout ---");
      // // —— END DEBUG ——

      try {
        const out = stdout.trim();
        const jsonStart = out.indexOf("{");
        const jsonEnd = out.lastIndexOf("}");
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error("No JSON object found in output");
        }
        const jsonString = out.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonString);

        resolve({
          Score: parsed.score,
          Checks: parsed.checks,
        });
      } catch (parseErr) {
        return reject(
          new Error(`Failed to parse Scorecard JSON: ${parseErr.message}`)
        );
      }
    });
  });
}

module.exports = { runScorecard };
