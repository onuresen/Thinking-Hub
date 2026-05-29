/**
 * hub-ai.js — AI Assistant module for Thinking Hub
 * Uses the official Anthropic JS SDK (loaded via esm.sh CDN) which handles
 * browser CORS correctly via dangerouslyAllowBrowser: true.
 */

const HubAI = (() => {
  const SETTINGS_KEY = 'hub-settings-v1';
  const MODEL = 'claude-haiku-4-5';
  const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk';

  let _sdkPromise = null;
  let _clientCache = null;

  // ── Key management ────────────────────────────────────────────────────────────

  function getKey() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return (s.anthropicKey || '').trim();
    } catch { return ''; }
  }

  function saveKey(key) {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      s.anthropicKey = key.trim();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      _clientCache = null;
    } catch {}
  }

  function isConfigured() { return getKey().length > 10; }

  // ── SDK loading ───────────────────────────────────────────────────────────────

  async function _loadSDK() {
    if (!_sdkPromise) {
      _sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic || m);
    }
    return _sdkPromise;
  }

  async function _getClient() {
    const key = getKey();
    if (!key) throw new Error('No API key configured. Add your Anthropic API key in Settings → Integrations.');
    if (_clientCache && _clientCache._key === key) return _clientCache._client;
    const Anthropic = await _loadSDK();
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    _clientCache = { _key: key, _client: client };
    return client;
  }

  // ── Context builders ──────────────────────────────────────────────────────────

  function _getContext() {
    const today = new Date().toISOString().split('T')[0];
    let projects = [], members = [];
    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      projects = (raw.projects || [])
        .filter(p => p.status !== 'done' && !p.archived)
        .map(p => ({ id: p.id, name: p.name }));
      members = (raw.members || []).map(m => m.name);
    } catch {}
    return { today, projects, members };
  }

  /** Richer context for actions — includes item IDs for linking/updating */
  function _getRichContext() {
    const today = new Date().toISOString().split('T')[0];
    const lines = [`Today: ${today}`];
    const items = []; // flat list of all referenceable items

    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      const members = (raw.members || []).map(m => m.name);
      if (members.length) lines.push(`Team: ${members.join(', ')}`);

      (raw.projects || []).filter(p => !p.archived).forEach(p => {
        items.push({ id: p.id, tool: 'project-hub', label: p.name, type: 'project', status: p.status });
        lines.push(`\nProject "${p.name}" [id:${p.id}] (${p.status})`);
        (p.tasks || []).filter(t => !t.archived).slice(0, 20).forEach(t => {
          items.push({ id: t.id, tool: 'project-hub', label: t.title, type: 'task', projectId: p.id, projectName: p.name, status: t.status, due: t.due });
          lines.push(`  Task "${t.title}" [id:${t.id}] status:${t.status}${t.due ? ' due:' + t.due : ''}${t.assigned ? ' @' + t.assigned : ''}`);
        });
      });
    } catch {}

    try {
      const decisions = JSON.parse(localStorage.getItem('decision-hub-v1') || '[]');
      decisions.filter(d => !d.archived).slice(0, 15).forEach(d => {
        items.push({ id: d.id, tool: 'decision-hub', label: d.title, type: 'decision', status: d.status });
        lines.push(`Decision "${d.title}" [id:${d.id}] (${d.status || 'open'})`);
      });
    } catch {}

    try {
      const risks = JSON.parse(localStorage.getItem('risk-hub-v1') || '[]');
      risks.filter(r => !r.archived && r.status === 'open').slice(0, 10).forEach(r => {
        items.push({ id: r.id, tool: 'risk-hub', label: r.title, type: 'risk' });
        lines.push(`Risk "${r.title}" [id:${r.id}]`);
      });
    } catch {}

    try {
      const raw = JSON.parse(localStorage.getItem('goals-hub-v1') || '{}');
      (raw.quarters || []).slice(-1).forEach(q => {
        (q.objectives || []).forEach(o => {
          items.push({ id: o.id, tool: 'goals-hub', label: o.title, type: 'goal' });
          lines.push(`Goal "${o.title}" [id:${o.id}]`);
        });
      });
    } catch {}

    try {
      const existing = JSON.parse(localStorage.getItem('hub-links-v1') || '[]');
      if (existing.length) lines.push(`\nExisting links (${existing.length} total): ${
        existing.slice(0, 8).map(l => `"${l.a?.label || l.a?.itemId}" ↔ "${l.b?.label || l.b?.itemId}"`).join(', ')
      }${existing.length > 8 ? '…' : ''}`);
    } catch {}

    return { today, lines: lines.join('\n'), items };
  }

  // ── Intent detection ──────────────────────────────────────────────────────────

  function detectIntent(text) {
    const t = text.toLowerCase().trim();

    // Explicit action requests
    const actionPatterns = [
      /\b(link|connect|create link|add link|link together|make.*connection|set up.*dependenc|create.*dependenc)\b/,
      /\b(mark.*done|mark.*complete|close.*task|finish.*task|complete.*task|set.*status)\b/,
      /\b(can you (do|apply|make|set|link|connect|update|change|create))\b/,
      /\b(go ahead|do it|apply|execute|make it happen)\b/,
      /\b(update.*status|change.*status)\b/,
    ];
    if (actionPatterns.some(p => p.test(t))) return 'action';

    // Create/capture intents
    const createPatterns = [
      /^(add|create|new|log|schedule|remind|record|track|note down|write down|set up|plan)\b/,
      /^(i (need to|have to|want to|should|must|will)|we need to|we should)\b/,
      /\b(by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|tomorrow|end of week))\b/,
      /\bremind me\b/,
    ];
    if (createPatterns.some(p => p.test(t))) return 'capture';

    return 'query';
  }

  // ── Capture (single item creation) ───────────────────────────────────────────

  async function capture(text) {
    const client = await _getClient();
    const { today, projects, members } = _getContext();

    const systemPrompt = `You are a project management assistant for Thinking Hub. Extract structured data from the user's natural language input.

Today's date: ${today}
Active projects: ${projects.length ? projects.map(p => `"${p.name}" (id: ${p.id})`).join(', ') : 'none'}
Known people: ${members.length ? members.join(', ') : 'none'}

Return ONLY valid JSON. Use this exact structure (omit optional fields you cannot determine):
{
  "type": "task" | "risk" | "decision" | "meeting" | "idea" | "note",
  "title": "concise title string",
  "description": "optional longer description",
  "dueDate": "YYYY-MM-DD (optional — resolve relative dates like 'Friday' or 'next week')",
  "assignee": "person name (optional — only if it matches a known person)",
  "projectId": "project id (optional — only if clearly indicated and matches an active project)",
  "projectName": "project name (optional)",
  "priority": "high" | "medium" | "low",
  "confidence": 0-100,
  "clarificationNeeded": "one short question if something is genuinely ambiguous (optional)"
}

Rules:
- type defaults to "task" if unclear
- priority defaults to "medium" if unclear
- If the user mentions a risk, threat, or danger → type = "risk"
- If the user mentions a decision, choice, or "decided" → type = "decision"
- If the user mentions a meeting, call, sync → type = "meeting"
- If the user mentions an idea, thought → type = "idea"
- Never invent project IDs or person names not in the lists above`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    });

    const content = msg.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    return JSON.parse(jsonMatch[0]);
  }

  // ── Act (multi-action with confirmation) ─────────────────────────────────────

  async function act(text) {
    const client = await _getClient();
    const { today, lines, items } = _getRichContext();

    const systemPrompt = `You are an AI assistant for Thinking Hub that can PROPOSE ACTIONS in the app.
The user will review and confirm before anything is applied.

Current workspace data:
${lines}

Available action types:
- create_link: link two items in the dependency graph
- update_task_status: change a task's status (open/done/blocked)
- create_task: add a new task to a project
- create_risk: log a new risk
- create_decision: log a new decision

Return ONLY valid JSON in this format:
{
  "message": "brief explanation of what you're proposing and why",
  "actions": [
    {
      "type": "create_link",
      "aId": "item id from context",
      "aTool": "project-hub | decision-hub | risk-hub | goals-hub | meetings-hub",
      "aLabel": "human readable name",
      "bId": "item id from context",
      "bTool": "project-hub | decision-hub | risk-hub | goals-hub | meetings-hub",
      "bLabel": "human readable name",
      "reason": "why these should be linked"
    },
    {
      "type": "update_task_status",
      "taskId": "task id",
      "projectId": "project id",
      "taskTitle": "task name",
      "projectName": "project name",
      "newStatus": "done | open | blocked",
      "reason": "why"
    },
    {
      "type": "create_task",
      "title": "task title",
      "projectId": "project id",
      "projectName": "project name",
      "priority": "high | medium | low",
      "dueDate": "YYYY-MM-DD (optional)",
      "assignee": "name (optional)"
    },
    {
      "type": "create_risk",
      "title": "risk title",
      "description": "details",
      "projectId": "project id (optional)"
    },
    {
      "type": "create_decision",
      "title": "decision title",
      "summary": "details",
      "projectId": "project id (optional)"
    }
  ]
}

Rules:
- Only use IDs that appear in the workspace data above — never invent IDs
- For create_link: only link items that genuinely have a logical dependency or relationship
- Keep "message" to 1-2 sentences max
- If you cannot find matching IDs for a requested link, explain in "message" and return empty actions array
- Propose up to 8 actions at once`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    });

    const content = msg.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const result = JSON.parse(jsonMatch[0]);
    // Attach full item data for execution
    result._items = items;
    return result;
  }

  // ── Query (read-only chat with data context) ──────────────────────────────────

  async function query(userMessage) {
    const client = await _getClient();
    const { today, lines } = _getRichContext();

    const system = `You are a helpful productivity assistant for Thinking Hub. Answer questions about the user's work clearly and concisely.

Current workspace:
${lines}

Keep answers short and actionable. Use bullet points for lists. Suggest relevant actions the user could take.`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }]
    });
    return msg.content?.[0]?.text || '';
  }

  // ── General chat ──────────────────────────────────────────────────────────────

  async function chat(userMessage, systemContext = '') {
    const client = await _getClient();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemContext || 'You are a helpful productivity assistant for Thinking Hub. Be concise and practical.',
      messages: [{ role: 'user', content: userMessage }]
    });
    return msg.content?.[0]?.text || '';
  }

  // ── Test key ──────────────────────────────────────────────────────────────────

  async function testKey(keyOverride) {
    const key = keyOverride || getKey();
    if (!key) return { ok: false, message: 'No key provided' };
    try {
      const Anthropic = await _loadSDK();
      const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
      await client.messages.create({
        model: MODEL,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      return { ok: true, message: `Connected · ${MODEL}` };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  }

  return { getKey, saveKey, isConfigured, capture, act, chat, query, detectIntent, testKey };
})();
