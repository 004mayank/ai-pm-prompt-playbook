# Technique: Self-Critique

## What it is
Ask the model to review its own output against a checklist/rubric, then improve it.

## When to use
- PRDs, strategy memos, stakeholder updates
- Any work where completeness matters

## Prompt pattern
```
Draft the PRD.
Then critique it using this rubric:
- Are goals measurable?
- Are guardrails present?
- Is MVP scope explicit?
- Are open questions listed?
Finally: output the improved version.
```

## Pitfalls
- Self-critique without a rubric becomes generic.
- It can “over-edit” and remove sharp decisions.

## Upgrade
Have it produce: (1) critique notes, (2) revised output.
