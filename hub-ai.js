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
      _clientCache = null; // reset cached client when key changes
    } catch {}
  }

  function isConfigured() {
    return getKey().length > 10;
  }

  // Load SDK once, reuse the promise on subsequent calls
  async function _loadSDK() {
    if (!_sdkPromise) {
      _sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic || m);
    }
    return _sdkPromise;
  }

  // Get or create Anthropic client instance
  async function _getClient() {
    const key = getKey();
    if (!key) throw new Error('No API key configured. Add your Anthropic API key in Settings → Integrations.');
    if (_clientCache && _clientCache._key === key) return _clientCache._client;
    const Anthropic = await _loadSDK();
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    _clientCache = { _key: key, _client: client };
    return client;
  }

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

  /**
   * Parse natural language into structured Thinking Hub data.
   * Returns { type, title, description?, dueDate?, assignee?, projectId?,
   *           projectName?, priority?, confidence, clarificationNeeded? }
   */
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

  /**
   * General chat — returns plain text response.
   */
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

  /**
   * Test connectivity with the stored key.
   * Returns { ok: bool, message: string }
   */
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

  /**
   * Detect whether input is a "create" intent or a "query" intent.
   * Returns 'capture' or 'query'.
   */
  function detectIntent(text) {
    const t = text.toLowerCase().trim();
    const createPatterns = [
      /^(add|create|new|log|schedule|remind|record|track|note down|write down|set up|plan)\b/,
      /^(i (need to|have to|want to|should|must|will)|we need to|we should)\b/,
      /\b(task|todo|to-do|risk|decision|meeting|action item|milestone|goal)\b.*\b(add|create|log|record|schedule)\b/,
      /\b(add|create|log|record|schedule)\b.*\b(task|todo|risk|decision|meeting|action item)\b/,
      /\bby (monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|tomorrow|end of week)\b/,
      /\bdue (date|monday|tuesday|wednesday|thursday|friday|next week|tomorrow)\b/,
      /\bremind me\b/,
      /\basign\b|\bassign\b/,
    ];
    return createPatterns.some(p => p.test(t)) ? 'capture' : 'query';
  }

  /**
   * Chat with context — provides the user's current data as context
   * for answering questions about projects, tasks, risks, etc.
   */
  async function query(userMessage) {
    const client = await _getClient();
    const { today, projects, members } = _getContext();

    // Build a rich context snapshot
    let contextLines = [`Today: ${today}`, `Team: ${members.join(', ') || 'none'}`];

    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      (raw.projects || []).forEach(p => {
        const open = (p.tasks || []).filter(t => !t.archived && t.status !== 'done').length;
        const overdue = (p.tasks || []).filter(t => !t.archived && t.status !== 'done' && t.due && t.due < today).length;
        contextLines.push(`Project: "${p.name}" (${p.status}) — ${open} open tasks${overdue ? `, ${overdue} overdue` : ''}`);
      });
    } catch {}

    try {
      const decisions = JSON.parse(localStorage.getItem('decision-hub-v1') || '[]');
      const open = decisions.filter(d => !d.archived && d.status !== 'decided').length;
      if (open) contextLines.push(`Open decisions: ${open}`);
    } catch {}

    try {
      const risks = JSON.parse(localStorage.getItem('risk-hub-v1') || '[]');
      const open = risks.filter(r => !r.archived && r.status === 'open').length;
      if (open) contextLines.push(`Open risks: ${open}`);
    } catch {}

    try {
      const raw = JSON.parse(localStorage.getItem('goals-hub-v1') || '{}');
      const quarters = raw.quarters || [];
      if (quarters.length) contextLines.push(`Active quarter: ${quarters[quarters.length - 1].name || 'current'}`);
    } catch {}

    const system = `You are a helpful productivity assistant for Thinking Hub, a personal project management app. Answer questions about the user's work clearly and concisely.

Current data snapshot:
${contextLines.join('\n')}

Keep answers short and actionable. Use bullet points for lists. If you don't have enough data to answer precisely, say so.`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }]
    });
    return msg.content?.[0]?.text || '';
  }

  return { getKey, saveKey, isConfigured, capture, chat, query, detectIntent, testKey };
})();
