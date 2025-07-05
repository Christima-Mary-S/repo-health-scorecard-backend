# Repo-Health Scorecard (Backend)

_An MSc research tool for quantifying open-source project health._

---

## Research Aim

1. **Extract** empirically-supported maintainability & security signals from GitHub.
2. **Aggregate** them (literature-derived weights) into a 0-100 “Health Score”.
3. **Correlate** that score with adoption proxies (stars, forks) and conduct qualitative cross-checks.

---

## Metrics Implemented (0–10 each)

| Domain        | Metric                            | Key Source                 |
| ------------- | --------------------------------- | -------------------------- |
| Activity      | Commit frequency                  | Sharma 2023                |
|               | Issue resolution median           | Kalliamvakou 2016          |
|               | PR review median                  | Zhang 2022                 |
| Community     | Contributor count • Bus factor    | Cosentino 2016; Nucci 2021 |
| Stability     | Developer churn (12–24 mo window) | Foucault 2022              |
| Quality       | Test presence (code search)       | Kochhar 2022               |
| Trust         | Badge count (CI, coverage, etc.)  | Trockman 2018              |
| Security      | Open Dependabot alerts            | Winter 2019                |
| Best-practice | OpenSSF Scorecard (Maintained)    | OSSF 2024                  |

A weighted formula (see `utils/scoreAggregator.js`) yields **Overall Score 0–100**.

---

## Quick Start (research use)

```bash
git clone <repo>
cd repo-health-scorecard-backend
npm i
# .env needs a GitHub PAT with security_events or repo scope
npm run dev
curl http://localhost:3000/api/score/facebook/react
```
