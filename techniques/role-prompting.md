# Technique: Role Prompting

## What it is
Tell the model *who it is* for this task (PM, analyst, product counsel, growth PM) and what it optimizes for.

## When to use
- You need a specific lens (e.g., “AI PM with evals mindset”)
- You want consistent trade-offs (e.g., MVP bias, metrics-first)

## PM example
“Act as a Senior AI PM. Draft a PRD outline with crisp scope boundaries and measurable success metrics.”

## Prompt pattern
```
You are a [role].
You care about: [priorities].
You must avoid: [failure modes].
Task: [do the work].
Output format: [format].
```

## Pitfalls
- Role prompts without constraints create fluff.
- Don’t stack 5 roles; pick one.

## Upgrade
Add a *decision rubric*:
- If information is missing → ask questions first.
- If scope explodes → propose an MVP + v2.
