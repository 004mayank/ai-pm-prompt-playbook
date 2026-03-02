# Technique: Guardrails (NEVER / ALWAYS)

## What it is
Explicit constraints that prevent common failure modes.

## When to use
- Anything user-facing or high-stakes
- When hallucination risk is high (metrics, policies)

## Common guardrails for PM work
**NEVER**
- Invent numbers, customers, policies, or integrations
- Claim a dependency is easy without stating assumptions

**ALWAYS**
- Mark unknowns as `TBD`
- List key risks + mitigations
- Separate “facts” from “assumptions”

## Prompt pattern
```
NEVER:
- ...
ALWAYS:
- ...
If unsure:
- Ask clarifying questions first
```

## Upgrade
Add a “red team” section: list how this plan could fail.
