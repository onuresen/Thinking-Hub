/**
 * hub-ai.js — AI Assistant module for Thinking Hub
 * Calls Claude Haiku to parse natural language into structured data.
 * Load after hub-storage.js.
 */

const HubAI = (() => {
  const SETTINGS_KEY = 'hub-settings-v1';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-haiku-4-5';

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
    } catch {}
  }

  function isConfigured() {
    return getKey().length > 10;
  }

  function _getContext() {
    const today = new Date().toISOString().split('T')[0];
    let projects = [], members = [];
    try {
      const raw = JSON.parse(localStorage.getItem('project-hub-v1') || '{}');
      projects = (raw.projects || [])
        .filter(p => p.status !== 'done' && !p.archived)
        .map(p => ({ id: p.id, name: p.name, status: p.status }));
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
    const key = getKey();
    if (!key) throw new Error('No API key configured. Add your Anthropic API key in Settings → Integrations.');

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

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }]
      })
    });

    if (!response.ok) {
      let msg = `API error ${response.status}`;
      try { const e = await response.json(); msg = e.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse AI response');
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * General chat — returns plain text response.
   * Used for open-ended questions about the user's data.
   */
  async function chat(userMessage, systemContext = '') {
    const key = getKey();
    if (!key) throw new Error('No API key configured.');

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-calls': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemContext || 'You are a helpful productivity assistant for Thinking Hub. Be concise and practical.',
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      let msg = `API error ${response.status}`;
      try { const e = await response.json(); msg = e.error?.message || msg; } catch {}
      throw new Error(msg);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  /**
   * Test connectivity with the stored key.
   * Returns { ok: bool, message: string }
   */
  async function testKey(keyOverride) {
    const key = keyOverride || getKey();
    if (!key) return { ok: false, message: 'No key provided' };
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-calls': 'true'
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      });
      if (response.ok) return { ok: true, message: `Connected · ${MODEL}` };
      const e = await response.json().catch(() => ({}));
      return { ok: false, message: e.error?.message || `Error ${response.status}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  return { getKey, saveKey, isConfigured, capture, chat, testKey };
})();
