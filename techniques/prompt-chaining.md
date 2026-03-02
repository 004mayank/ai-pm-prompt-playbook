# Technique: Prompt Chaining

## What it is
Break one big task into sequential steps where each step produces an intermediate artifact.

## When to use
- Complex work (strategy, PRD, root-cause analysis)
- You want higher reliability than one-shot prompting

## PM chain example: idea → PRD
1) Clarify problem + success metrics
2) Propose 2–3 solution options
3) Pick MVP + define scope
4) Draft PRD

## Prompt pattern
```
Step 1: Ask me 5–10 questions needed to proceed.
Wait for answers.
Step 2: Propose 3 options with trade-offs.
Step 3: Draft MVP PRD.
```

## Pitfalls
- If you skip Step 1, you get confident guessing.
- Chains can get long; be explicit about stop conditions.

## Upgrade
Add an eval checkpoint after each step.
