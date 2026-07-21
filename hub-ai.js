/**
 * hub-ai.js — AI Assistant module for Thinking Hub
 * Calls Anthropic's Messages API directly from the browser. No runtime SDK or
 * CDN dependency; enterprise-config.js owns the deployment-level AI policy.
 */

const HubAI = (() => {
  const SETTINGS_KEY = 'hub-settings-v1';
  const MODEL = 'claude-haiku-4-5';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const API_VERSION = '2023-06-01';

  function isEnabled() {
    return !window.ThinkingHubPolicy || window.ThinkingHubPolicy.aiEnabled !== false;
  }

  function _assertEnabled() {
    if (!isEnabled()) {
      throw new Error('AI features are disabled by your organization.');
    }
  }

  // ── Key management ────────────────────────────────────────────────────────────

  function getKey() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return (s.anthropicKey || '').trim();
    } catch { return ''; }
  }

  function saveKey(key) {
    if (!isEnabled()) return false;
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      s.anthropicKey = key.trim();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
      return true;
    } catch { return false; }
  }

  function isConfigured() { return isEnabled() && getKey().length > 10; }

  // ── Direct Anthropic API client ───────────────────────────────────────────────

  async function _createMessage(key, body) {
    _assertEnabled();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || response.statusText;
      throw new Error(`Anthropic API ${response.status}: ${detail || 'request failed'}`);
    }
    return payload;
  }

  async function _getClient(keyOverride) {
    _assertEnabled();
    const key = (keyOverride || getKey()).trim();
    if (!key) throw new Error('No API key configured. Add your Anthropic API key in Settings → Integrations.');
    return { messages: { create: (body) => _createMessage(key, body) } };
  }

  // ── Context ───────────────────────────────────────────────────────────────────

  function _getContext() {
    const today = new Date().toISOString().split('T')[0];
    let projects = [], members = [];
    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      projects = (raw.projects || []).filter(p => !p.archived).map(p => ({ id: p.id, name: p.name }));
      members = (raw.members || []).map(m => m.name);
    } catch {}
    return { today, projects, members };
  }

  function _getRichContext() {
    const today = new Date().toISOString().split('T')[0];
    const lines = [`Today: ${today}`];
    const items = [];

    // Projects + tasks
    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      const members = (raw.members || []).map(m => m.name);
      if (members.length) lines.push(`Team members: ${members.join(', ')}`);

      (raw.projects || []).filter(p => !p.archived).forEach(p => {
        items.push({ id: p.id, tool: 'project-hub', label: p.name, type: 'project', status: p.status });
        const openTasks = (p.tasks || []).filter(t => !t.archived && t.status !== 'done');
        lines.push(`\nProject "${p.name}" [id:${p.id}] status:${p.status} — ${openTasks.length} open tasks`);
        (p.tasks || []).filter(t => !t.archived).slice(0, 15).forEach(t => {
          items.push({ id: t.id, tool: 'project-hub', label: t.title, type: 'task', projectId: p.id, projectName: p.name, status: t.status, due: t.due, priority: t.priority, assigned: t.assigned });
          lines.push(`  Task "${t.title}" [id:${t.id}] status:${t.status} priority:${t.priority || 'medium'}${t.due ? ' due:' + t.due : ''}${t.assigned ? ' @' + t.assigned : ''}`);
        });
        (p.milestones || []).slice(0, 5).forEach(m => {
          items.push({ id: m.id, tool: 'project-hub', label: m.name, type: 'milestone', projectId: p.id });
          lines.push(`  Milestone "${m.name}" [id:${m.id}]${m.date ? ' due:' + m.date : ''}`);
        });
      });
    } catch {}

    // Decisions
    try {
      const decisions = JSON.parse(localStorage.getItem('decision-hub-v1') || '[]');
      decisions.filter(d => !d.archived).slice(0, 12).forEach(d => {
        items.push({ id: d.id, tool: 'decision-hub', label: d.title, type: 'decision', status: d.status });
        lines.push(`Decision "${d.title}" [id:${d.id}] (${d.status || 'open'})`);
      });
    } catch {}

    // Risks
    try {
      const risks = JSON.parse(localStorage.getItem('risk-hub-v1') || '[]');
      risks.filter(r => !r.archived && r.status === 'open').slice(0, 10).forEach(r => {
        items.push({ id: r.id, tool: 'risk-hub', label: r.title, type: 'risk' });
        lines.push(`Risk "${r.title}" [id:${r.id}]`);
      });
    } catch {}

    // Goals
    try {
      const raw = JSON.parse(localStorage.getItem('goals-hub-v1') || '{}');
      (raw.quarters || []).slice(-2).forEach(q => {
        lines.push(`\nGoals quarter: "${q.name}" [id:${q.id}]`);
        (q.objectives || []).forEach(o => {
          items.push({ id: o.id, tool: 'goals-hub', label: o.title, type: 'goal', quarterId: q.id, quarterName: q.name });
          lines.push(`  Goal "${o.title}" [id:${o.id}]`);
        });
      });
    } catch {}

    // Meetings (series-aware: one line per meeting record, next occurrence for series)
    try {
      const raw = JSON.parse(localStorage.getItem('meetings-hub-v1') || '{}');
      const meetings = (raw.meetings || []).slice(-10);
      if (meetings.length) lines.push('\nMeetings:');
      meetings.forEach(m => {
        items.push({ id: m.id, tool: 'meetings-hub', label: m.title, type: 'meeting' });
        let when = m.date || '';
        if (m.recurring && Array.isArray(m.occurrenceDates) && m.occurrenceDates.length) {
          const next = m.occurrenceDates.map(o => o.date).filter(d => d >= today).sort()[0];
          when = `weekly series, next: ${next || 'ended'}`;
        }
        const acts = m.recurring
          ? (m.log || []).flatMap(l => l.actionItems || [])
          : (m.actionItems || []);
        const open = acts.filter(a => !a.done);
        lines.push(`Meeting "${m.title}" [id:${m.id}] ${when}${open.length ? ` — ${open.length} open actions` : ''}`);
        open.slice(0, 4).forEach(a => lines.push(`  Action: ${a.text}${a.dueDate ? ' due:' + a.dueDate : ''}`));
      });
    } catch {}

    // Schedule (next 14 days)
    try {
      const raw = JSON.parse(localStorage.getItem('schedule-v1') || '{}');
      const horizon = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const upcoming = (raw.items || [])
        .filter(it => it.start && it.start >= today && it.start <= horizon)
        .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);
      if (upcoming.length) lines.push('\nSchedule (next 14 days):');
      upcoming.forEach(it => lines.push(`  ${it.start} ${it.type || 'item'}: "${it.title}"`));
    } catch {}

    // Learning log
    try {
      const raw = JSON.parse(localStorage.getItem('learning-hub-v1') || '{}');
      const learning = (raw.items || []).slice(-6);
      if (learning.length) lines.push('\nLearning log:');
      learning.forEach(it => {
        items.push({ id: it.id, tool: 'learning-hub', label: it.title, type: 'learning' });
        lines.push(`  "${it.title}" [id:${it.id}] (${it.status || 'active'})${it.keyInsight ? ' — insight: ' + String(it.keyInsight).slice(0, 100) : ''}`);
      });
    } catch {}

    // Reflection Board (latest board, per-column)
    try {
      const raw = JSON.parse(localStorage.getItem('reflection-hub-v1') || '{}');
      const board = (raw.boards || [])[raw.boards ? raw.boards.length - 1 : 0];
      if (board && board.columns) {
        const colLines = [];
        ['signal', 'friction', 'question', 'action'].forEach(col => {
          (board.columns[col] || []).slice(0, 4).forEach(it => colLines.push(`  ${col}: ${String(it.text || '').slice(0, 90)}`));
        });
        if (colLines.length) { lines.push('\nReflection Board:'); lines.push(...colLines); }
      }
    } catch {}

    // Assumptions (unresolved)
    try {
      const raw = JSON.parse(localStorage.getItem('assumptions-hub-v1') || '{}');
      const open = (raw.assumptions || []).filter(a => a.status === 'assumed' || a.status === 'testing').slice(0, 6);
      if (open.length) lines.push('\nOpen assumptions:');
      open.forEach(a => lines.push(`  [${a.status}] ${String(a.statement || '').slice(0, 100)}`));
    } catch {}

    // Stakeholders (grouped by org)
    try {
      const raw = JSON.parse(localStorage.getItem('stakeholder-hub-v1') || '{}');
      const byOrg = {};
      (raw.stakeholders || []).forEach(s => {
        const org = s.org || '(no org)';
        (byOrg[org] = byOrg[org] || []).push(s.name);
      });
      const orgs = Object.entries(byOrg).slice(0, 8);
      if (orgs.length) lines.push('\nStakeholders: ' + orgs.map(([org, names]) => `${org} (${names.slice(0, 5).join(', ')})`).join('; '));
    } catch {}

    // People roster
    try {
      const raw = JSON.parse(localStorage.getItem('people-hub-v1') || '{}');
      const ppl = (raw.members || []).slice(0, 10);
      if (ppl.length) lines.push('\nPeople: ' + ppl.map(m => m.role ? `${m.name} (${m.role})` : m.name).join(', '));
    } catch {}

    // Journal (last 3 daily entries) + this week's review rocks
    try {
      const raw = JSON.parse(localStorage.getItem('log-hub-v1') || '{}');
      const dates = Object.keys(raw.entries || {}).sort().slice(-3);
      if (dates.length) lines.push('\nRecent journal entries:');
      dates.forEach(d => {
        const e = raw.entries[d];
        lines.push(`  ${d}${e.mood ? ' mood:' + e.mood + '/5' : ''}: ${String(e.text || '').slice(0, 120)}`);
      });
    } catch {}

    // Focus sessions (last 7 days, summary only)
    try {
      const raw = JSON.parse(localStorage.getItem('focus-hub-v1') || '{}');
      const cutoff = Date.now() - 7 * 86400000;
      const recent = (raw.sessions || []).filter(s => s.startedAt && new Date(s.startedAt).getTime() >= cutoff);
      if (recent.length) {
        const mins = recent.reduce((sum, s) => sum + (s.durationMin || 0), 0);
        lines.push(`\nFocus (last 7d): ${recent.length} sessions, ${mins} min total`);
      }
    } catch {}

    // Capture inbox (unprocessed brain-dump items)
    try {
      const raw = JSON.parse(localStorage.getItem('capture-hub-v1') || '{}');
      const inbox = (raw.inbox || []).slice(0, 5);
      if (inbox.length) lines.push('\nCapture inbox (' + (raw.inbox || []).length + ' items): ' + inbox.map(it => `"${String(it.text || '').slice(0, 60)}"`).join('; '));
    } catch {}

    // Existing links (with IDs for remove_link)
    try {
      const links = JSON.parse(localStorage.getItem('hub-links-v1') || '[]');
      if (links.length) {
        lines.push(`\nExisting dependency links (${links.length} total):`);
        links.slice(0, 10).forEach(l => {
          items.push({ id: l.id, tool: 'hub-links', label: `${l.a?.label||l.a?.itemId} ↔ ${l.b?.label||l.b?.itemId}`, type: 'link' });
          lines.push(`  Link [id:${l.id}] "${l.a?.label||l.a?.itemId}" ↔ "${l.b?.label||l.b?.itemId}"`);
        });
      }
    } catch {}

    return { today, lines: lines.join('\n'), items };
  }

  // ── Intent detection ──────────────────────────────────────────────────────────

  function detectIntent(text) {
    const t = text.toLowerCase().trim();

    const actionPatterns = [
      /\b(link|connect|create link|add link|link together|set up.*dependenc|create.*dependenc)\b/,
      /\b(mark.*done|mark.*complete|close.*task|finish.*task|complete.*task)\b/,
      /\b(set.*status|update.*status|change.*status|change.*priority|set.*priority|update.*priority)\b/,
      /\b(move.*due|change.*due|set.*due|reschedule|postpone|push.*back)\b/,
      /\b(assign.*to|unassign)\b/,
      /\b(remove.*link|delete.*link|unlink|disconnect)\b/,
      /\b(can you (do|apply|make|set|link|connect|update|change|create|add|move|assign|mark))\b/,
      /\b(go ahead|do it|apply|execute|make it happen|please (do|apply|create|add|set|link))\b/,
    ];
    if (actionPatterns.some(p => p.test(t))) return 'action';

    const createPatterns = [
      /^(add|create|new|log|schedule|remind|record|track|note down|set up|plan)\b/,
      /^(i (need to|have to|want to|should|must|will)|we need to|we should)\b/,
      /\b(by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|tomorrow|end of week))\b/,
      /\bremind me\b/,
    ];
    if (createPatterns.some(p => p.test(t))) return 'capture';

    return 'query';
  }

  // ── Capture ───────────────────────────────────────────────────────────────────

  async function capture(text) {
    const client = await _getClient();
    const { today, projects, members } = _getContext();

    const systemPrompt = `You are a project management assistant for Thinking Hub. Extract structured data from the user's natural language input.

Today's date: ${today}
Active projects: ${projects.length ? projects.map(p => `"${p.name}" (id: ${p.id})`).join(', ') : 'none'}
Known people: ${members.length ? members.join(', ') : 'none'}

Return ONLY valid JSON:
{
  "type": "task" | "risk" | "decision" | "meeting" | "idea" | "note",
  "title": "concise title",
  "description": "optional",
  "dueDate": "YYYY-MM-DD (optional, resolve relative dates)",
  "assignee": "name (optional, must match known people)",
  "projectId": "id (optional, must match active project)",
  "projectName": "name (optional)",
  "priority": "high" | "medium" | "low",
  "confidence": 0-100,
  "clarificationNeeded": "one short question if ambiguous (optional)"
}`;

    const msg = await client.messages.create({
      model: MODEL, max_tokens: 512, system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    });
    const content = msg.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    return JSON.parse(jsonMatch[0]);
  }

  // ── Act ───────────────────────────────────────────────────────────────────────

  async function act(text) {
    const client = await _getClient();
    const { today, lines, items } = _getRichContext();

    const systemPrompt = `You are an AI assistant for Thinking Hub that PROPOSES ACTIONS for the user to review and confirm before applying.

Current workspace:
${lines}

Return ONLY valid JSON:
{
  "message": "brief 1-2 sentence explanation of what you're proposing",
  "actions": [ ...action objects... ]
}

Available action types and their fields:

create_link — link two items in the dependency graph:
  { "type":"create_link", "aId":"id", "aTool":"tool", "aLabel":"name", "bId":"id", "bTool":"tool", "bLabel":"name", "reason":"why linked" }

remove_link — remove an existing link:
  { "type":"remove_link", "linkId":"id", "aLabel":"name", "bLabel":"name", "reason":"why remove" }

update_task_status — change task status:
  { "type":"update_task_status", "taskId":"id", "projectId":"id", "taskTitle":"name", "projectName":"name", "newStatus":"open|done|blocked", "reason":"why" }

update_task_priority — change task priority:
  { "type":"update_task_priority", "taskId":"id", "projectId":"id", "taskTitle":"name", "projectName":"name", "newPriority":"high|medium|low", "reason":"why" }

update_task_due — set or change a task's due date:
  { "type":"update_task_due", "taskId":"id", "projectId":"id", "taskTitle":"name", "projectName":"name", "newDue":"YYYY-MM-DD", "reason":"why" }

assign_task — assign a task to a team member:
  { "type":"assign_task", "taskId":"id", "projectId":"id", "taskTitle":"name", "projectName":"name", "assignee":"member name", "reason":"why" }

create_project — create a new project:
  { "type":"create_project", "name":"project name", "description":"optional", "status":"planning|active" }

create_milestone — add a milestone to a project:
  { "type":"create_milestone", "projectId":"id", "projectName":"name", "name":"milestone title", "date":"YYYY-MM-DD", "description":"optional" }

create_task — add a task to a project. ONLY use this if the work clearly clears the task threshold: it produces a visible artifact/decision, takes roughly 0.5-2 days, and someone would notice meaningful progress when it's done. If the work is a smaller step (an execution detail, a sub-step of something bigger, a reminder), it is NOT a task — use add_checklist_item instead, or just mention it in "message" as a suggestion without any action at all:
  { "type":"create_task", "title":"title", "projectId":"id", "projectName":"name", "priority":"high|medium|low", "dueDate":"YYYY-MM-DD (optional)", "assignee":"name (optional)" }

add_checklist_item — attach a micro-step to an EXISTING task's checklist, for work that does not clear the task threshold above. Prefer this over create_task whenever the item is a sub-step of something already on the board:
  { "type":"add_checklist_item", "taskId":"id", "projectId":"id", "taskTitle":"name", "projectName":"name", "text":"the step" }

create_risk — log a new risk:
  { "type":"create_risk", "title":"title", "description":"details", "projectId":"id (optional)" }

create_decision — log a new decision:
  { "type":"create_decision", "title":"title", "summary":"details", "projectId":"id (optional)" }

create_goal — add an objective to Goals Hub:
  { "type":"create_goal", "title":"objective title", "description":"optional", "quarterId":"id (optional)", "quarterName":"name (optional)", "projectId":"id (optional)" }

create_schedule_event — add an event to Schedule:
  { "type":"create_schedule_event", "title":"event title", "eventType":"task|event|milestone", "start":"YYYY-MM-DD", "end":"YYYY-MM-DD (optional)", "projectId":"id (optional)", "notes":"optional" }

create_meeting — schedule a meeting in Meeting Hub:
  { "type":"create_meeting", "title":"meeting title", "date":"YYYY-MM-DD", "time":"HH:MM (optional)", "meetingType":"custom|standup|1on1|retro|planning|kickoff|review|decision|sync", "projectId":"id (optional)", "agenda":"optional" }

create_assumption — log an assumption to track in Decision Hub's Assumptions:
  { "type":"create_assumption", "statement":"the assumption", "why":"optional rationale", "decisionId":"id (optional)" }

create_learning — add an item to the Reading & Learning log:
  { "type":"create_learning", "title":"title", "itemType":"book|article|video|course", "url":"optional" }

Tool values: "project-hub" | "decision-hub" | "risk-hub" | "goals-hub" | "meetings-hub"

Rules:
- ONLY use IDs that appear in the workspace data above — never invent IDs
- Resolve relative dates using today: ${today}
- Propose up to 10 actions per response
- If you cannot find a required ID, explain in "message" and return empty actions
- Keep "message" to 1-2 sentences`;

    const msg = await client.messages.create({
      model: MODEL, max_tokens: 1500, system: systemPrompt,
      messages: [{ role: 'user', content: text }]
    });
    const content = msg.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    const result = JSON.parse(jsonMatch[0]);
    result._items = items;
    return result;
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  async function query(userMessage, history) {
    const client = await _getClient();
    const { today, lines } = _getRichContext();

    const system = `You are a helpful productivity assistant for Thinking Hub. Answer questions about the user's work concisely.

Current workspace:
${lines}

Keep answers short and actionable. Use bullet points for lists. Where relevant, suggest what actions the user could take (they can ask you to do it).`;

    // Prior conversation turns ({q, a} pairs) let follow-up questions work
    const messages = [];
    (history || []).slice(-4).forEach(t => {
      if (t.q && t.a) {
        messages.push({ role: 'user', content: t.q });
        messages.push({ role: 'assistant', content: t.a });
      }
    });
    messages.push({ role: 'user', content: userMessage });

    const msg = await client.messages.create({
      model: MODEL, max_tokens: 800, system, messages
    });
    return msg.content?.[0]?.text || '';
  }

  // ── Chat ──────────────────────────────────────────────────────────────────────

  async function chat(userMessage, systemContext = '') {
    const client = await _getClient();
    const msg = await client.messages.create({
      model: MODEL, max_tokens: 1024,
      system: systemContext || 'You are a helpful productivity assistant for Thinking Hub. Be concise and practical.',
      messages: [{ role: 'user', content: userMessage }]
    });
    return msg.content?.[0]?.text || '';
  }

  // ── Test key ──────────────────────────────────────────────────────────────────

  async function testKey(keyOverride) {
    if (!isEnabled()) return { ok: false, message: 'AI features are disabled by your organization.' };
    const key = keyOverride || getKey();
    if (!key) return { ok: false, message: 'No key provided' };
    try {
      const client = await _getClient(key);
      await client.messages.create({ model: MODEL, max_tokens: 16, messages: [{ role: 'user', content: 'Hi' }] });
      return { ok: true, message: `Connected · ${MODEL}` };
    } catch (err) {
      return { ok: false, message: err.message || String(err) };
    }
  }

  return { isEnabled, getKey, saveKey, isConfigured, capture, act, chat, query, detectIntent, testKey, getRichContext: _getRichContext };
})();
