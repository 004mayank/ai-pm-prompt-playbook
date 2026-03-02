# Playbook: Funnel Drop Analysis

Goal: diagnose why a funnel metric dropped and propose next actions.

## Step 1 — Restate metric + definition
Make sure KPI definition is unambiguous (numerator/denominator/time window).

## Step 2 — Localize the drop
- When did it start?
- Is it platform-specific?
- Is it cohort-specific?

## Step 3 — Generate hypotheses (ranked)
Rank by likelihood × impact, and specify evidence needed.

## Step 4 — Drill-down plan
List the exact cuts/queries you’d run next.

## Step 5 — Actions
- Immediate mitigations (if regression)
- Longer-term fixes / experiments

Template to use: `templates/kpi-diagnosis.md`
