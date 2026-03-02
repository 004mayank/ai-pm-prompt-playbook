# AI PM Workbench + Prompt Playbook

A local-first **prompt engineering playbook** + a fully functional in-browser app (**AI PM Workbench**) for running PM playbooks against your data.

- **No backend**
- **Runs locally** (open `index.html`)
- Stores key + last runs in **localStorage**
- Calls **OpenAI API directly** from the browser

> Security note: your OpenAI API key is stored in `localStorage` on this device. Don’t use this on shared/public computers.

---

## Quick start (app)

1) Clone this repo

```bash
git clone https://github.com/004mayank/ai-pm-prompt-playbook.git
cd ai-pm-prompt-playbook
```

2) Open the app locally

- Double click `index.html`, or
- Drag `index.html` into your browser

3) Add your OpenAI API key

- In the left sidebar → **API Key**
- Paste key → **Save**
- Click **Test connection**

4) Add input data (optional)

- **CSV tab:** upload a `.csv` (you’ll see a preview of first 5 rows)
- **Raw text tab:** paste notes/transcripts → click **Use this as input**

5) Pick a playbook and run

- Select a playbook (PRD, KPI diagnosis, Funnel drop, Exec update, Research synthesis)
- Review/edit the auto-built prompt
- Click **Run playbook**

You’ll get:
- The generated output
- A raw JSON toggle
- Copy-to-clipboard
- Approx token estimate + latency
- An automatic evaluation (5 quality scores)
- Local history (last 5 runs)

---

## Features

### 1) API Key Manager
- Save / clear key (localStorage)
- Test connection
- Shows connection status
- Never hardcodes the key

### 2) Data Connector
- CSV upload → client-side parsing → preview table
- Raw text paste mode
- Data is used as prompt inputs

### 3) Playbook Selector
Includes:
- PRD Generator
- Funnel Drop Analysis
- KPI Diagnosis
- Exec Update
- Research Synthesis

### 4) Prompt Builder
Automatically composes:
- Goal
- Context
- Constraints (NEVER/ALWAYS)
- Inputs (from CSV/text)
- Output format
- Self-check

You can edit the final prompt before running.

### 5) Output + Evaluation
- Formatted output + raw output toggle
- Copy output
- Token estimate + response latency
- Auto-eval (secondary call) scoring 1–5:
  - Clarity
  - Structure
  - Actionability
  - Hallucination risk
  - Executive readiness

### 6) Local History
- Stores last 5 runs in localStorage
- Reopen past outputs with timestamps

---

## Repo structure

- `index.html` / `styles.css` / `script.js` → **AI PM Workbench app**

- `framework/` → the prompt framework
  - `framework/6-layer-prompt-stack.md`

- `techniques/` → prompting techniques (PM-oriented)

- `templates/` → copy/paste templates

- `playbooks/` → end-to-end workflows

- `evals/` → rubric + test cases

---

## Troubleshooting

- **“Invalid key (401)”**: your OpenAI key is wrong / revoked / missing permissions.
- **Network errors**: check connectivity; some networks block `api.openai.com`.
- **No output / weird formatting**: use the **Structured preview**, then tighten the Output Format section.

---

## Notes / limitations (intentional)

- This is a personal tool (not SaaS): no accounts, no backend.
- localStorage is convenient, not “secure storage.” Use accordingly.
- Token count is an estimate unless OpenAI returns usage.

---

## Contributing

If you add a new template/playbook:
- Keep prompts structured (Goal/Context/Constraints/Inputs/Output format/Self-check)
- Add or update a test case in `evals/test-cases.md`
