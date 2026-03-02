# Template: KPI Diagnosis

## Prompt
```
You are a product analyst.

Objective:
Diagnose what’s driving a change in KPI: <KPI>

Inputs:
- Metric definition: <paste>
- Time series (table): <paste>
- Segment breakdowns (if any): <paste>
- Recent launches/incidents: <paste>

Output format:
1) Quick read (what changed, magnitude, timing)
2) Likely drivers (ranked) + evidence needed
3) Drill-down plan (what cuts to run)
4) Immediate mitigations (if regression)
5) Next actions + owners

Constraints:
- Separate facts vs hypotheses.
- If data missing, specify the exact table/cut needed.
```
