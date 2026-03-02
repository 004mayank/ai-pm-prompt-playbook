# The 6-Layer Prompt Stack (for AI PM work)

This is a practical framework for writing prompts that are stable, repeatable, and easy to improve.

## Layer 1 - Objective
**What outcome do we want?**
- Define the job-to-be-done in one sentence.
- Name the decision being made.

**Example:** “Draft a PRD v1 for feature X so engineering can estimate and we can align on metrics and scope.”

## Layer 2 - Context
**What does the model need to know to do good work?**
- Product context (user, market, constraints)
- Current state (what exists today)
- What’s already decided vs undecided

## Layer 3 - Inputs (ground truth)
**What material is the model allowed to use?**
- Bullet inputs, links, notes, metrics tables
- If data is missing, explicitly say so and ask for assumptions

Rule: *If an output must be accurate, include the source text/table.*

## Layer 4 - Constraints & guardrails
**What must be true / never happen?**
- Never/Always lists
- Safety / compliance requirements
- Tone constraints
- Time/effort constraints

**Example constraints:**
- Never invent metrics; use placeholders like `TBD`.
- If requirements are ambiguous, list questions first.
- Keep scope to an MVP that ships in ≤6 weeks.

## Layer 5 - Output format
**What should the response look like?**
- Headings, sections, tables (or “no tables”)
- JSON schema, bullets, checklists
- Length limit

This layer often creates the biggest quality jump.

## Layer 6 - Quality checks (self-eval)
**How do we verify it’s good?**
Ask the model to run a checklist before finalizing:
- Missing inputs?
- Contradictions?
- Unclear owners/dependencies?
- Metrics defined + guardrails included?
- Risks + mitigations included?

## Default template
Copy-paste this skeleton:

```
Objective:
Context:
Inputs:
Constraints:
Output format:
Quality checks:
```

## When to use this
- PRDs, strategy memos, weekly exec updates
- KPI diagnosis and narrative building
- Experiment design and prioritization

## Common failure modes
- Too much “Context” and no “Output format”
- Inputs missing → hallucinated details
- No quality checks → confident but wrong answers
