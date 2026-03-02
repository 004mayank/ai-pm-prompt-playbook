# Technique: Structured Outputs

## What it is
Force the model into a predictable structure (headings, bullets, JSON schema).

## When to use
- You want repeatable PRDs and memos
- You’re feeding output into another system

## Prompt pattern (markdown)
```
Output using exactly these headings:
1) Problem
2) Goals / Non-goals
3) Metrics (primary + guardrails)
4) MVP Scope
5) Risks

Constraints:
- Use bullets only
- No tables
```

## Prompt pattern (JSON)
```
Return ONLY valid JSON matching this schema:
{ "problem": "string", "goals": ["string"], ... }
```

## Pitfalls
- Over-constraining can reduce insight.
- If the schema is wrong, the output will be wrong-but-consistent.

## Upgrade
Add a “schema validator” step: if output doesn’t match, fix it.
