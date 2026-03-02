# Playbook: Idea → PRD (AI PM)

Goal: move from a fuzzy idea to an execution-ready PRD with minimal hallucination.

## Step 0 - Inputs
Collect (or explicitly mark TBD):
- Problem statement
- Target users
- Baseline metric(s)
- Constraints (time/team)

## Step 1 - Clarify (questions first)
Prompt:
- “Ask me up to 8 questions you need to write a PRD v1. Then stop.”

## Step 2 - Options
Prompt:
- “Propose 3 solution options with trade-offs. Recommend one MVP.”

## Step 3 - Draft PRD
Use: `templates/prd-generator.md`

## Step 4 - Self-critique
Use technique: `techniques/self-critique.md` with the rubric in `evals/scoring-rubric.md`.

## Step 5 - Ship
- Convert TBDs into an instrumentation plan.
- Add open questions as explicit follow-ups.
