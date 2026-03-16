/*
  AI PM Workbench — Vanilla JS, local-first

  SECURITY WARNING:
  - This app stores your OpenAI API key in localStorage on this device.
  - Do not use on shared/public machines.
  - Never paste your key into untrusted pages.

  Design goals:
  - No backend
  - Runs by opening index.html locally
  - No external frameworks
  - Direct calls to OpenAI Chat Completions
*/

(() => {
  'use strict';

  // -----------------------------
  // Storage keys
  // -----------------------------
  const LS = {
    apiKey: 'ai_pm_workbench_openai_api_key',
    history: 'ai_pm_workbench_history_v1',
    lastPlaybook: 'ai_pm_workbench_last_playbook',
    lastTemp: 'ai_pm_workbench_last_temp',
    inputs: 'ai_pm_workbench_playbook_inputs_v1'
  };

  // -----------------------------
  // In-memory (not persisted)
  // -----------------------------
  const mem = {
    lastOutput: null,
    lastRawJson: null,
    rawMode: false,
    playbookInputs: {},
    lastBuiltPrompt: ''
  };

  // -----------------------------
  // DOM
  // -----------------------------
  const $ = (id) => document.getElementById(id);

  const apiKeyEl = $('apiKey');
  const saveKeyBtn = $('saveKeyBtn');
  const clearKeyBtn = $('clearKeyBtn');
  const testKeyBtn = $('testKeyBtn');
  const keyStatusEl = $('keyStatus');

  const playbookEl = $('playbook');
  const temperatureEl = $('temperature');
  const tempLabelEl = $('tempLabel');

  const centerTitleEl = $('centerTitle');
  const centerSubtitleEl = $('centerSubtitle');
  const playbookInputsEl = $('playbookInputs');

  const promptPreviewEl = $('promptPreview');
  const promptEditorEl = $('promptEditor');
  const resetPromptBtn = $('resetPromptBtn');
  const copyPromptBtn = $('copyPromptBtn');
  const promptStatsEl = $('promptStats');

  const runBtn = $('runBtn');
  const runMetaEl = $('runMeta');

  const outputBoxEl = $('outputBox');
  const outputMetaEl = $('outputMeta');
  const copyOutputBtn = $('copyOutputBtn');
  const toggleRawBtn = $('toggleRawBtn');

  const evalBoxEl = $('evalBox');

  const historyListEl = $('historyList');
  const clearHistoryBtn = $('clearHistoryBtn');

  const toastEl = $('toast');

  // -----------------------------
  // Utils
  // -----------------------------
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function safeTrim(s) {
    return (s || '').toString().trim();
  }

  function estimateTokens(text) {
    // Rough heuristic: ~4 characters per token in English.
    // This is intentionally approximate.
    return Math.max(1, Math.round((text || '').length / 4));
  }

  function formatMs(ms) {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  // -----------------------------
  // CSV parsing (good-enough for common CSVs)
  // -----------------------------
  function parseCSV(text) {
    // Handles quoted fields, commas, and newlines in quotes.
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cur);
        cur = '';
        if (row.some(cell => cell !== '') || row.length > 1) rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }

    // last cell
    row.push(cur);
    if (row.some(cell => cell !== '') || row.length > 1) rows.push(row);

    // Normalize widths
    const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    for (const r of rows) {
      while (r.length < maxCols) r.push('');
    }

    const headers = rows[0] || [];
    const body = rows.slice(1);
    return { headers, rows: body };
  }

  function csvToText(headers, rows, maxRows = 30) {
    const take = rows.slice(0, maxRows);
    const lines = [];
    lines.push(headers.join(' | '));
    lines.push(headers.map(() => '---').join(' | '));
    for (const r of take) lines.push(r.join(' | '));
    if (rows.length > take.length) lines.push(`... (${rows.length - take.length} more rows)`);
    return lines.join('\n');
  }

  function renderCSVPreview(headers, rows, containerEl) {
    if (!containerEl) return;

    if (!headers.length) {
      containerEl.innerHTML = `<div class="muted" style="padding:12px;">CSV appears empty.</div>`;
      return;
    }

    const take = rows.slice(0, 5);
    const th = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
    const tb = take.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');

    containerEl.innerHTML = `
      <table class="table">
        <thead><tr>${th}</tr></thead>
        <tbody>${tb || `<tr><td colspan="${headers.length}"><span class="muted">No data rows.</span></td></tr>`}</tbody>
      </table>
      <div class="muted small" style="padding:10px; border-top:1px solid rgba(255,255,255,0.06);">
        Loaded ${rows.length} rows • Showing first ${Math.min(5, rows.length)}
      </div>
    `;
  }

  // -----------------------------
  // Playbooks / templates
  // -----------------------------
  const playbooks = {
    prd: {
      name: 'PRD Generator',
      inputs: [
        { key: 'productName', label: 'Product Name', type: 'text', placeholder: 'e.g., Acme Wallet', help: 'Name of the product or feature area.' },
        { key: 'productDescription', label: 'Product Description', type: 'textarea', rows: 3, placeholder: '1–2 sentences...', help: 'What is it and where does it sit in the ecosystem?' },
        { key: 'targetAudience', label: 'Target Audience', type: 'textarea', rows: 3, placeholder: 'Who is this for?', help: 'Primary segments + any constraints (geo, platform, tier).' },
        { key: 'userProblem', label: 'User Problem', type: 'textarea', rows: 4, placeholder: 'What problem are we solving?', help: 'Be specific: pain, frequency, and current workaround.' },
        { key: 'keyFeatures', label: 'Key Features', type: 'textarea', rows: 5, placeholder: 'Bullets are fine...', help: 'What will we build in MVP?' },
        { key: 'successMetrics', label: 'Success Metrics', type: 'text', placeholder: 'e.g., Activation rate, D7 retention', help: 'Primary metric + guardrails if you have them.' },
        { key: 'constraints', label: 'Constraints / Assumptions', type: 'textarea', rows: 4, placeholder: 'Timeline, team size, dependencies...', help: 'Call out limitations and what must be true.' }
      ],
      goal: 'Draft an execution-ready PRD v1.',
      outputFormat: [
        'Use these headings:',
        '1) Context',
        '2) Problem',
        '3) Goals / Non-goals',
        '4) Users & JTBD',
        '5) Solution (MVP)',
        '6) Metrics (primary + guardrails)',
        '7) Rollout / experiment plan',
        '8) Risks & mitigations',
        '9) Open questions'
      ].join('\n'),
      selfCheck: [
        '- Are goals measurable?',
        '- Is MVP scope shippable in 4–8 weeks?',
        '- Are unknowns marked as TBD?',
        '- Are dependencies and risks called out?' 
      ].join('\n'),
      contextPrompts: [
        'Product: <fill>',
        'Feature idea: <fill>',
        'Target users: <fill>',
        'Current behavior / baseline: <fill>',
        'Constraints (team/time): <fill>'
      ].join('\n')
    },
    funnel: {
      name: 'Funnel Drop Analysis',
      inputs: [
        { key: 'csvUpload', label: 'Upload CSV', type: 'csv', help: 'Upload a funnel export (events or aggregated funnel table). Preview shows first 5 rows.' },
        { key: 'stageNames', label: 'Funnel Stage Names', type: 'textarea', rows: 4, placeholder: 'Stage1\nStage2\nStage3', help: 'List stages in order (one per line).' },
        { key: 'dropoffStage', label: 'Drop-off stage to analyze', type: 'text', placeholder: 'e.g., Checkout → Payment', help: 'The step where drop-off increased.' },
        { key: 'hypothesis', label: 'Hypothesis', type: 'textarea', rows: 3, placeholder: 'My guess is...', help: 'Optional: your current hypothesis to test.' },
        { key: 'notes', label: 'Notes', type: 'textarea', rows: 4, placeholder: 'Recent launches, incidents, seasonality...', help: 'Anything that might explain the change.' }
      ],
      goal: 'Diagnose why a funnel step dropped and propose next actions.',
      outputFormat: [
        'Output using these sections:',
        '1) KPI + definition',
        '2) What changed (timing, magnitude)',
        '3) Likely drivers (ranked) + evidence needed',
        '4) Drill-down plan (exact cuts/queries)',
        '5) Mitigations + next actions (owners)'
      ].join('\n'),
      selfCheck: [
        '- Separate facts vs hypotheses.',
        '- Call out missing data explicitly.',
        '- Provide the next 3 analyses to run.'
      ].join('\n'),
      contextPrompts: [
        'Product/surface: <fill>',
        'Funnel definition: <fill>',
        'What changed (observed): <fill>',
        'Recent launches/incidents: <fill>'
      ].join('\n')
    },
    kpi: {
      name: 'KPI Diagnosis',
      inputs: [
        { key: 'kpiName', label: 'KPI Name', type: 'text', placeholder: 'e.g., D7 retention', help: 'Name + definition if ambiguous.' },
        { key: 'currentValue', label: 'Current Value', type: 'text', placeholder: 'e.g., 12.4%', help: 'What you see now.' },
        { key: 'targetValue', label: 'Target Value', type: 'text', placeholder: 'e.g., 14.0%', help: 'Goal or baseline to return to.' },
        { key: 'timeframe', label: 'Timeframe', type: 'text', placeholder: 'e.g., last 2 weeks vs prior 2 weeks', help: 'Comparison window.' },
        { key: 'suspectedCauses', label: 'Suspected Causes', type: 'textarea', rows: 4, placeholder: 'Possible drivers...', help: 'Bullets are fine (launches, traffic mix, bugs, pricing).' }
      ],
      goal: 'Analyze a KPI change and identify drivers + next steps.',
      outputFormat: [
        'Output using these sections:',
        '1) Quick read',
        '2) Hypotheses (ranked) + evidence needed',
        '3) Drill-down plan',
        '4) Immediate actions',
        '5) Longer-term fixes / experiments'
      ].join('\n'),
      selfCheck: [
        '- Facts vs hypotheses split is explicit.',
        '- Each hypothesis includes the data cut needed.',
        '- No invented numbers.'
      ].join('\n'),
      contextPrompts: [
        'KPI name + definition: <fill>',
        'Time window + comparison (WoW/MoM): <fill>',
        'Any known changes: <fill>'
      ].join('\n')
    },
    exec: {
      name: 'Exec Update',
      inputs: [
        { key: 'projectName', label: 'Project Name', type: 'text', placeholder: 'e.g., Payments Reliability', help: 'What initiative is this update for?' },
        { key: 'achievements', label: 'Key Achievements', type: 'textarea', rows: 4, placeholder: 'Shipped X, launched Y...', help: 'Bullets preferred.' },
        { key: 'risks', label: 'Risks / Blockers', type: 'textarea', rows: 4, placeholder: 'Top risks and what you need...', help: 'Include clear asks.' },
        { key: 'metrics', label: 'Metrics Snapshot', type: 'textarea', rows: 3, placeholder: 'Metric: value (WoW)...', help: 'Keep it tight; 3–5 lines.' },
        { key: 'nextWeek', label: 'Next Week Plan', type: 'textarea', rows: 4, placeholder: 'What’s next...', help: 'Bullets preferred.' }
      ],
      goal: 'Write a crisp exec update (bullets only).',
      outputFormat: [
        'Bullets only. Use this structure:',
        '- Status: Green/Yellow/Red (1 line why)',
        '- Shipped',
        '- Impact (metrics)',
        '- Risks / asks',
        '- Next'
      ].join('\n'),
      selfCheck: [
        '- ≤200 words',
        '- No hype; concrete language',
        '- Clear asks' 
      ].join('\n'),
      contextPrompts: [
        'Team/product: <fill>',
        'Week range: <fill>'
      ].join('\n')
    },
    research: {
      name: 'Research Synthesis',
      inputs: [
        { key: 'csvUpload', label: 'Upload CSV', type: 'csv', help: 'Optional: upload a research export (responses, tags, or notes). Preview shows first 5 rows.' },
        { key: 'rawNotes', label: 'Raw Research Notes', type: 'textarea', rows: 6, placeholder: 'Paste notes, transcripts, or summaries...', help: 'If you do not have CSV, paste notes here.' },
        { key: 'themes', label: 'Key Themes', type: 'textarea', rows: 3, placeholder: 'Theme 1\nTheme 2', help: 'Optional: themes you already see.' },
        { key: 'insights', label: 'Key Insights', type: 'textarea', rows: 3, placeholder: 'Insight 1\nInsight 2', help: 'Optional: hypotheses or early takeaways.' },
        { key: 'quotes', label: 'User Quotes', type: 'textarea', rows: 4, placeholder: '"Quote" — user type', help: 'Optional: paste notable quotes.' },
        { key: 'opportunities', label: 'Opportunities', type: 'textarea', rows: 4, placeholder: 'Opportunity areas...', help: 'Optional: solution directions to evaluate.' }
      ],
      goal: 'Synthesize notes into insights and recommended actions.',
      outputFormat: [
        'Output using these sections:',
        '1) Executive summary (5 bullets)',
        '2) Segments observed',
        '3) Top pains (ranked)',
        '4) Jobs-to-be-done',
        '5) Key quotes (5–10)',
        '6) Opportunities / solution directions',
        '7) Open questions',
        '8) Suggested follow-ups'
      ].join('\n'),
      selfCheck: [
        '- Don’t overgeneralize; call out confidence.',
        '- Tie each opportunity to evidence.'
      ].join('\n'),
      contextPrompts: [
        'Study context: <fill>',
        'User type: <fill>',
        'What decision this should inform: <fill>'
      ].join('\n')
    }
  };

  function inputsToText(playbookKey, inputs) {
    const pb = playbooks[playbookKey];
    const schema = pb.inputs || [];

    const lines = [];
    for (const f of schema) {
      const v = inputs?.[f.key];
      if (!v) continue;

      if (f.type === 'csv') {
        const txt = typeof v === 'object' ? (v.text || '') : '';
        if (safeTrim(txt)) {
          lines.push(`${f.label}:`);
          lines.push(txt);
          lines.push('');
        }
        continue;
      }

      const s = typeof v === 'string' ? safeTrim(v) : '';
      if (!s) continue;
      lines.push(`${f.label}:`);
      lines.push(s);
      lines.push('');
    }

    const out = lines.join('\n').trim();
    return out || '(No inputs yet)';
  }

  function buildPrompt({ playbookKey, inputs }) {
    const pb = playbooks[playbookKey];
    const goal = pb.goal;

    const constraints = [
      'NEVER:',
      '- Reveal or log the API key',
      '- Invent metrics or facts; use TBD and list required data',
      '- Confuse assumptions with facts',
      '',
      'ALWAYS:',
      '- Ask clarifying questions first if critical info is missing (max 8)',
      '- Keep output structured and skimmable',
      '- Include risks + mitigations'
    ].join('\n');

    const inputsText = inputsToText(playbookKey, inputs);

    const prompt = [
      'You are a senior AI Product Manager. You write crisp, execution-ready artifacts.',
      '',
      'GOAL',
      goal,
      '',
      'CONTEXT (fill what you can; if missing, ask questions)',
      pb.contextPrompts,
      '',
      'CONSTRAINTS',
      constraints,
      '',
      'PLAYBOOK INPUTS (user-provided)',
      inputsText,
      '',
      'OUTPUT FORMAT',
      pb.outputFormat,
      '',
      'SELF-CHECK (before finalizing)',
      pb.selfCheck
    ].join('\n');

    return { prompt, preview: prompt };
  }

  function buildEvalPrompt({ playbookKey, userPrompt, modelOutput }) {
    const pb = playbooks[playbookKey];

    return [
      'You are a strict evaluator for AI PM outputs.',
      'Score the output 1–5 on each dimension and explain briefly.',
      '',
      'Dimensions:',
      '- Clarity',
      '- Structure',
      '- Actionability',
      '- Hallucination risk',
      '- Executive readiness',
      '',
      'Return ONLY valid JSON with this schema:',
      '{',
      '  "playbook": "string",',
      '  "scores": {',
      '    "clarity": 1,',
      '    "structure": 1,',
      '    "actionability": 1,',
      '    "hallucination_risk": 1,',
      '    "executive_readiness": 1',
      '  },',
      '  "notes": {',
      '    "clarity": "string",',
      '    "structure": "string",',
      '    "actionability": "string",',
      '    "hallucination_risk": "string",',
      '    "executive_readiness": "string"',
      '  }',
      '}',
      '',
      `Playbook: ${pb.name}`,
      '',
      'User prompt:',
      userPrompt,
      '',
      'Model output:',
      modelOutput
    ].join('\n');
  }

  // -----------------------------
  // OpenAI API
  // -----------------------------
  const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

  async function openaiChat({ apiKey, messages, temperature = 0.3, maxTokens = 900 }) {
    const t0 = performance.now();

    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature,
        max_tokens: maxTokens,
        messages
      })
    });

    const latencyMs = performance.now() - t0;

    if (!resp.ok) {
      let errText = '';
      try {
        const j = await resp.json();
        errText = j?.error?.message || JSON.stringify(j);
      } catch {
        errText = await resp.text();
      }

      const e = new Error(errText || `OpenAI error (${resp.status})`);
      e.status = resp.status;
      throw e;
    }

    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? '';
    const usage = json?.usage || null;

    return { text, usage, latencyMs, raw: json };
  }

  // -----------------------------
  // History
  // -----------------------------
  function loadHistory() {
    try {
      const raw = localStorage.getItem(LS.history);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(LS.history, JSON.stringify(items.slice(0, 5)));
  }

  function renderHistory() {
    const items = loadHistory();
    if (!items.length) {
      historyListEl.innerHTML = `<div class="muted">No runs yet.</div>`;
      return;
    }

    historyListEl.innerHTML = items.map((it, idx) => {
      const ts = new Date(it.timestamp).toLocaleString();
      const name = playbooks[it.playbookKey]?.name || it.playbookKey;
      const meta = `${ts} • ${name}`;
      return `
        <button class="btn btn--ghost" style="width:100%; justify-content:flex-start;" data-history-idx="${idx}">
          <span style="display:flex; flex-direction:column; gap:2px; text-align:left; width:100%;">
            <span style="font-weight:700; color: rgba(230,237,247,0.92);">${escapeHtml(name)}</span>
            <span class="muted small">${escapeHtml(meta)}</span>
          </span>
        </button>
      `;
    }).join('');

    historyListEl.querySelectorAll('[data-history-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-history-idx'));
        const items = loadHistory();
        const it = items[idx];
        if (!it) return;
        loadFromHistory(it);
      });
    });
  }

  function loadFromHistory(it) {
    playbookEl.value = it.playbookKey;
    temperatureEl.value = String(it.temperature ?? 0.3);
    tempLabelEl.textContent = String(it.temperature ?? 0.3);

    promptEditorEl.value = it.prompt;
    promptPreviewEl.textContent = it.prompt;
    updatePromptStats();

    mem.lastOutput = it.output;
    mem.lastRawJson = it.rawJson || null;
    mem.rawMode = false;

    outputBoxEl.textContent = it.output;
    outputMetaEl.textContent = `History • approx tokens: ${estimateTokens(it.output)} • latency: ${formatMs(it.latencyMs || 0)}`;

    copyOutputBtn.disabled = false;
    toggleRawBtn.disabled = !it.rawJson;
    toggleRawBtn.textContent = 'Show raw';

    renderEval(it.evaluation || null);
    toast('Loaded from history');
  }

  // -----------------------------
  // UI: prompt stats
  // -----------------------------
  function updatePromptStats() {
    const p = promptEditorEl.value || '';
    const tokens = estimateTokens(p);
    promptStatsEl.textContent = `~${tokens} tokens • ${p.length} chars`;
  }

  // -----------------------------
  // UI: eval rendering
  // -----------------------------
  function clampScore(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 1;
    return Math.min(5, Math.max(1, Math.round(x)));
  }

  function renderEval(evalJson) {
    if (!evalJson) {
      evalBoxEl.innerHTML = `<div class="muted">Evaluation will appear after a run.</div>`;
      return;
    }

    const scores = evalJson.scores || {};
    const notes = evalJson.notes || {};

    const dims = [
      { key: 'clarity', label: 'Clarity' },
      { key: 'structure', label: 'Structure' },
      { key: 'actionability', label: 'Actionability' },
      { key: 'hallucination_risk', label: 'Hallucination risk' },
      { key: 'executive_readiness', label: 'Exec readiness' }
    ];

    const total = dims.reduce((acc, d) => acc + clampScore(scores[d.key]), 0);
    const avg = (total / dims.length).toFixed(1);

    evalBoxEl.innerHTML = `
      <div class="row" style="margin-bottom: 10px;">
        <div><strong>Average:</strong> ${avg}/5</div>
        <div class="muted small">(auto-eval, treat as directional)</div>
      </div>
      <div class="evalgrid">
        ${dims.map(d => {
          const v = clampScore(scores[d.key]);
          const pct = (v / 5) * 100;
          return `
            <div class="score">
              <div class="score__label">${escapeHtml(d.label)}</div>
              <div class="score__value">${v}<span class="muted" style="font-size:14px;">/5</span></div>
              <div class="bar"><span style="width:${pct}%;"></span></div>
              <div class="muted small" style="margin-top:8px;">${escapeHtml(notes[d.key] || '')}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // -----------------------------
  // State: prompt rebuild
  // -----------------------------
  function rebuildPrompt({ keepEditor = false } = {}) {
    const playbookKey = playbookEl.value;
    const state = getPlaybookState(playbookKey);
    const built = buildPrompt({ playbookKey, inputs: state });

    promptPreviewEl.textContent = built.preview;

    // If user hasn't diverged from the last built prompt, keep editor in sync.
    const editorNow = promptEditorEl.value || '';
    const safeToOverwrite = !keepEditor || editorNow === mem.lastBuiltPrompt;
    if (safeToOverwrite) {
      promptEditorEl.value = built.prompt;
      mem.lastBuiltPrompt = built.prompt;
    }

    updatePromptStats();
    localStorage.setItem(LS.lastPlaybook, playbookKey);
  }

  // -----------------------------
  // Playbook dynamic inputs
  // -----------------------------
  function loadInputs() {
    try {
      const raw = localStorage.getItem(LS.inputs);
      mem.playbookInputs = raw ? JSON.parse(raw) : {};
    } catch {
      mem.playbookInputs = {};
    }
  }

  function saveInputs() {
    try {
      localStorage.setItem(LS.inputs, JSON.stringify(mem.playbookInputs || {}));
    } catch {
      // ignore
    }
  }

  function getPlaybookState(playbookKey) {
    if (!mem.playbookInputs) mem.playbookInputs = {};
    if (!mem.playbookInputs[playbookKey]) mem.playbookInputs[playbookKey] = {};
    return mem.playbookInputs[playbookKey];
  }

  function setPlaybookField(playbookKey, fieldKey, value) {
    const st = getPlaybookState(playbookKey);
    st[fieldKey] = value;
    saveInputs();
  }

  function fieldHelpHtml(help) {
    return help ? `<div class="hint">${escapeHtml(help)}</div>` : '';
  }

  function renderPlaybookInputs(playbookKey) {
    const pb = playbooks[playbookKey];
    if (!pb) return;

    centerTitleEl.textContent = pb.name;
    centerSubtitleEl.textContent = 'Inputs for the selected playbook. Switching playbooks updates this panel.';

    const st = getPlaybookState(playbookKey);

    playbookInputsEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'subcard';

    const frag = document.createDocumentFragment();

    (pb.inputs || []).forEach((f) => {
      const field = document.createElement('div');
      field.className = 'field';

      const id = `pb-${playbookKey}-${f.key}`;

      if (f.type === 'csv') {
        field.innerHTML = `
          <label for="${id}">${escapeHtml(f.label)}</label>
          <div class="row">
            <input id="${id}" type="file" accept=".csv,text/csv" />
            <button class="btn btn--ghost" type="button" data-clear="${f.key}">Clear</button>
          </div>
          ${fieldHelpHtml(f.help)}
          <div class="preview" data-preview="${f.key}">
            <div class="muted">Upload a CSV to see a preview (first 5 rows).</div>
          </div>
        `;
        frag.appendChild(field);
        return;
      }

      if (f.type === 'textarea') {
        const rows = f.rows || 4;
        field.innerHTML = `
          <label for="${id}">${escapeHtml(f.label)}</label>
          <textarea id="${id}" rows="${rows}" placeholder="${escapeHtml(f.placeholder || '')}"></textarea>
          ${fieldHelpHtml(f.help)}
        `;
        frag.appendChild(field);
        return;
      }

      // default: text
      field.innerHTML = `
        <label for="${id}">${escapeHtml(f.label)}</label>
        <input id="${id}" type="text" placeholder="${escapeHtml(f.placeholder || '')}" />
        ${fieldHelpHtml(f.help)}
      `;
      frag.appendChild(field);
    });

    wrap.appendChild(frag);
    playbookInputsEl.appendChild(wrap);

    // Hydrate values + attach listeners
    (pb.inputs || []).forEach((f) => {
      const id = `pb-${playbookKey}-${f.key}`;
      const el = document.getElementById(id);
      if (!el) return;

      const existing = st[f.key];

      if (f.type === 'csv') {
        const preview = playbookInputsEl.querySelector(`[data-preview="${f.key}"]`);
        if (existing && typeof existing === 'object' && existing.headers && existing.rows) {
          renderCSVPreview(existing.headers, existing.rows, preview);
        }

        el.addEventListener('change', async () => {
          const file = el.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = parseCSV(text);
          const csvText = `CSV Preview (up to 30 rows)\n\n${csvToText(parsed.headers, parsed.rows, 30)}`;
          setPlaybookField(playbookKey, f.key, {
            fileName: file.name,
            headers: parsed.headers,
            rows: parsed.rows,
            text: csvText
          });
          renderCSVPreview(parsed.headers, parsed.rows, preview);
          toast('CSV loaded');
          rebuildPrompt({ keepEditor: true });
        });

        const clearBtn = playbookInputsEl.querySelector(`button[data-clear="${f.key}"]`);
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            el.value = '';
            setPlaybookField(playbookKey, f.key, null);
            if (preview) preview.innerHTML = `<div class="muted" style="padding:12px;">Upload a CSV to see a preview (first 5 rows).</div>`;
            toast('Data cleared');
            rebuildPrompt({ keepEditor: true });
          });
        }

        return;
      }

      // textarea + text
      if (typeof existing === 'string') el.value = existing;

      el.addEventListener('input', () => {
        setPlaybookField(playbookKey, f.key, el.value);
        rebuildPrompt({ keepEditor: true });
      });
    });
  }

  // -----------------------------
  // Tabs
  // -----------------------------
  function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
        tab.classList.add('tab--active');
        const key = tab.getAttribute('data-tab');
        $('tab-csv').classList.toggle('hidden', key !== 'csv');
        $('tab-text').classList.toggle('hidden', key !== 'text');
      });
    });
  }

  // -----------------------------
  // API key manager
  // -----------------------------
  function loadApiKey() {
    const k = localStorage.getItem(LS.apiKey) || '';
    apiKeyEl.value = k;
  }

  function setKeyStatus(type, msg) {
    keyStatusEl.textContent = msg;
    keyStatusEl.style.borderColor = type === 'ok'
      ? 'rgba(0, 209, 178, 0.55)'
      : type === 'bad'
        ? 'rgba(255, 77, 109, 0.55)'
        : 'rgba(255,255,255,0.14)';
  }

  async function testConnection() {
    const apiKey = safeTrim(localStorage.getItem(LS.apiKey) || apiKeyEl.value);
    if (!apiKey) {
      setKeyStatus('bad', 'No key');
      toast('Paste and save an API key first');
      return;
    }

    setKeyStatus('neutral', 'Testing...');

    try {
      const res = await openaiChat({
        apiKey,
        temperature: 0,
        maxTokens: 5,
        messages: [
          { role: 'system', content: 'You are a connection test.' },
          { role: 'user', content: 'Reply with only: OK' }
        ]
      });
      const ok = (res.text || '').toUpperCase().includes('OK');
      setKeyStatus(ok ? 'ok' : 'ok', ok ? 'Connected' : 'Connected');
      toast('Connection OK');
    } catch (e) {
      if (e.status === 401) {
        setKeyStatus('bad', 'Invalid key');
        toast('Invalid API key');
      } else {
        setKeyStatus('bad', 'Network/API error');
        toast('Network/API error');
      }
    }
  }

  // -----------------------------
  // Run playbook
  // -----------------------------
  function setRunning(isRunning, msg = '') {
    runBtn.disabled = isRunning;
    testKeyBtn.disabled = isRunning;
    saveKeyBtn.disabled = isRunning;
    clearKeyBtn.disabled = isRunning;
    runMetaEl.textContent = msg;
  }

  function setOutputLoading() {
    outputBoxEl.innerHTML = `<div class="muted">Running... please wait.</div>`;
    evalBoxEl.innerHTML = `<div class="muted">Evaluation pending...</div>`;
    outputMetaEl.textContent = '';
    copyOutputBtn.disabled = true;
    toggleRawBtn.disabled = true;
  }

  function setOutput(text, { latencyMs, usage, rawJson }) {
    mem.lastOutput = text;
    mem.lastRawJson = rawJson || null;
    mem.rawMode = false;

    outputBoxEl.textContent = text;

    const tokenEst = estimateTokens(text);
    const usageTxt = usage ? `tokens: in ${usage.prompt_tokens}, out ${usage.completion_tokens}` : `approx tokens: ${tokenEst}`;
    outputMetaEl.textContent = `${usageTxt} • latency: ${formatMs(latencyMs)}`;

    copyOutputBtn.disabled = false;
    toggleRawBtn.disabled = !rawJson;
    toggleRawBtn.textContent = 'Show raw';
  }

  async function runOnce() {
    const apiKey = safeTrim(localStorage.getItem(LS.apiKey) || '');
    if (!apiKey) {
      toast('Save an OpenAI API key first');
      return;
    }

    const playbookKey = playbookEl.value;
    const temperature = Number(temperatureEl.value);

    const prompt = promptEditorEl.value;
    if (!safeTrim(prompt)) {
      toast('Prompt is empty');
      return;
    }

    setRunning(true, 'Calling OpenAI...');
    setOutputLoading();

    try {
      const main = await openaiChat({
        apiKey,
        temperature,
        maxTokens: 1200,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ]
      });

      setOutput(main.text, { latencyMs: main.latencyMs, usage: main.usage, rawJson: main.raw });

      setRunning(true, 'Evaluating output...');

      // Secondary evaluation call
      const evalPrompt = buildEvalPrompt({ playbookKey, userPrompt: prompt, modelOutput: main.text });
      const ev = await openaiChat({
        apiKey,
        temperature: 0,
        maxTokens: 500,
        messages: [
          { role: 'system', content: 'You are a JSON-only evaluator.' },
          { role: 'user', content: evalPrompt }
        ]
      });

      let evalJson = null;
      try {
        evalJson = JSON.parse(ev.text);
      } catch {
        // If model returns non-JSON, show a fallback.
        evalJson = {
          playbook: playbooks[playbookKey].name,
          scores: {
            clarity: 3,
            structure: 3,
            actionability: 3,
            hallucination_risk: 3,
            executive_readiness: 3
          },
          notes: {
            clarity: 'Eval returned non-JSON. Consider re-running.',
            structure: ev.text.slice(0, 200),
            actionability: '',
            hallucination_risk: '',
            executive_readiness: ''
          }
        };
      }

      renderEval(evalJson);

      // Persist history (keep last 5)
      const items = loadHistory();
      const entry = {
        timestamp: nowISO(),
        playbookKey,
        temperature,
        prompt,
        output: main.text,
        evaluation: evalJson,
        latencyMs: main.latencyMs,
        // Store raw response JSON for debugging, but do not include API key.
        rawJson: main.raw
      };
      items.unshift(entry);
      saveHistory(items);
      renderHistory();

      setKeyStatus('ok', 'Connected');
      toast('Done');

    } catch (e) {
      if (e.status === 401) {
        setKeyStatus('bad', 'Invalid key');
        outputBoxEl.innerHTML = `<div class="muted">Error: invalid API key (401). Please update your key.</div>`;
      } else {
        outputBoxEl.innerHTML = `<div class="muted">Error: ${escapeHtml(e.message || 'Request failed')}</div>`;
      }
      renderEval(null);
      toast('Run failed');
    } finally {
      setRunning(false, '');
    }
  }

  // -----------------------------
  // Clipboard
  // -----------------------------
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied');
    } catch {
      toast('Copy failed');
    }
  }

  // -----------------------------
  // Output raw toggle
  // -----------------------------
  function toggleRaw() {
    if (!mem.lastRawJson) return;
    mem.rawMode = !mem.rawMode;

    if (mem.rawMode) {
      outputBoxEl.textContent = JSON.stringify(mem.lastRawJson, null, 2);
      toggleRawBtn.textContent = 'Show formatted';
    } else {
      outputBoxEl.textContent = mem.lastOutput || '';
      toggleRawBtn.textContent = 'Show raw';
    }
  }

  // -----------------------------
  // Events
  // -----------------------------
  function bindEvents() {
    saveKeyBtn.addEventListener('click', () => {
      const key = safeTrim(apiKeyEl.value);
      if (!key) {
        toast('API key is empty');
        return;
      }
      localStorage.setItem(LS.apiKey, key);
      setKeyStatus('neutral', 'Saved');
      toast('Key saved');
    });

    clearKeyBtn.addEventListener('click', () => {
      localStorage.removeItem(LS.apiKey);
      apiKeyEl.value = '';
      setKeyStatus('neutral', 'Cleared');
      toast('Key cleared');
    });

    testKeyBtn.addEventListener('click', testConnection);

    playbookEl.addEventListener('change', () => {
      const playbookKey = playbookEl.value;
      renderPlaybookInputs(playbookKey);
      rebuildPrompt({ keepEditor: false });
    });

    temperatureEl.addEventListener('input', () => {
      tempLabelEl.textContent = temperatureEl.value;
      localStorage.setItem(LS.lastTemp, temperatureEl.value);
    });

    promptEditorEl.addEventListener('input', updatePromptStats);

    resetPromptBtn.addEventListener('click', () => {
      rebuildPrompt({ keepEditor: false });
      toast('Prompt reset');
    });

    copyPromptBtn.addEventListener('click', () => copyToClipboard(promptEditorEl.value || ''));

    runBtn.addEventListener('click', runOnce);

    copyOutputBtn.addEventListener('click', () => {
      const text = mem.rawMode ? JSON.stringify(mem.lastRawJson, null, 2) : (mem.lastOutput || '');
      copyToClipboard(text);
    });

    toggleRawBtn.addEventListener('click', toggleRaw);

    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem(LS.history);
      renderHistory();
      toast('History cleared');
    });
  }

  // -----------------------------
  // Init
  // -----------------------------
  function init() {
    loadApiKey();
    loadInputs();

    const lastPlaybook = localStorage.getItem(LS.lastPlaybook);
    if (lastPlaybook && playbooks[lastPlaybook]) playbookEl.value = lastPlaybook;

    const lastTemp = localStorage.getItem(LS.lastTemp);
    if (lastTemp) {
      temperatureEl.value = lastTemp;
      tempLabelEl.textContent = lastTemp;
    }

    renderPlaybookInputs(playbookEl.value);
    rebuildPrompt({ keepEditor: false });
    renderHistory();
    bindEvents();

    // Keep status neutral on load
    setKeyStatus('neutral', 'Not tested');

    // Meta
    runMetaEl.textContent = '';
  }

  init();
})();
