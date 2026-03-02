# Technique: Few-Shot Prompting

## What it is
Provide 1–3 examples of **inputs → outputs** in the style you want.

## When to use
- You need stable formatting (PRD sections, status updates)
- You want to teach “what good looks like”

## Prompt pattern
```
Here are examples.
Example 1 input:
...
Example 1 output:
...

Now do the same for:
[input]

Rules:
- Preserve section names
- Keep length similar
```

## PM example
Give one example of an exec update (tight bullets), then ask for this week’s update.

## Pitfalls
- Examples that are too long increase cost and reduce flexibility.
- Bad examples lock in bad style.

## Upgrade
Pair with evals: if output fails rubric, rewrite.
