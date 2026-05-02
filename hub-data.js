/**
 * hub-data.js — Shared read API for Thinking Hub
 *
 * Provides all tools with canonical access to project/task/member data
 * from project-hub-v1 (the single source of truth).
 *
 * Requires hub-storage.js to be loaded first. Falls back gracefully if missing.
 *
 * Usage:
 *   <script src="hub-storage.js"></script>
 *   <script src="hub-data.js"></script>
 *   const projects = HubData.getProjects();
 *   HubData.onChange(() => repopulateDropdowns());
 */

// Fallback shim: if hub-storage.js failed to load, keep things working via
// direct localStorage so no tool crashes.
if (typeof window.HubStorage === 'undefined') {
  console.warn('[HubData] hub-storage.js not loaded — falling back to direct localStorage');
  window.HubStorage = {
    get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    subscribe: () => (() => { }),
  };
}

window.HubData = (() => {
  const PH_KEY = 'project-hub-v1';
  let _listeners = [];
  let _initialized = false;

  // ── Core read ────────────────────────────────────────────────────────────────
  // Always a fresh read via HubStorage (synchronous localStorage cache).
  // Returns { members: [], projects: [] } on missing or malformed data.
  function getData() {
    try {
      const data = HubStorage.get(PH_KEY);
      if (!data) return { members: [], projects: [] };
      return {
        members: Array.isArray(data.members) ? data.members : [],
        projects: Array.isArray(data.projects) ? data.projects : [],
      };
    } catch {
      return { members: [], projects: [] };
    }
  }

  // ── Presence check ───────────────────────────────────────────────────────────
  function hasData() {
    return getData().projects.length > 0;
  }

  // ── Project selectors ────────────────────────────────────────────────────────
  function getProjects() {
    return getData().projects;
  }

  function getProject(projectId) {
    return getData().projects.find(p => p.id === projectId) || null;
  }

  // ── Member selectors ─────────────────────────────────────────────────────────
  function getMembers() {
    return getData().members;
  }

  function getMember(memberId) {
    return getData().members.find(m => m.id === memberId) || null;
  }

  // ── Task selectors ───────────────────────────────────────────────────────────
  // Returns all tasks across all projects, each augmented with
  // _projectId, _projectName, _projectColor.
  function getAllTasks() {
    return getData().projects.flatMap(p =>
      (p.tasks || []).map(t => ({
        ...t,
        _projectId: p.id,
        _projectName: p.name,
        _projectColor: p.color,
      }))
    );
  }

  // Returns tasks for a specific project (also augmented).
  function getTasksForProject(projectId) {
    const project = getProject(projectId);
    if (!project) return [];
    return (project.tasks || []).map(t => ({
      ...t,
      _projectId: project.id,
      _projectName: project.name,
      _projectColor: project.color,
    }));
  }

  // Returns { task, project } or null.
  function findTask(taskId) {
    for (const p of getData().projects) {
      const task = (p.tasks || []).find(t => t.id === taskId);
      if (task) {
        return {
          task: { ...task, _projectId: p.id, _projectName: p.name, _projectColor: p.color },
          project: p,
        };
      }
    }
    return null;
  }

  // ── Change notification ──────────────────────────────────────────────────────
  // Register a callback invoked whenever project-hub-v1 changes.
  // Returns an unsubscribe function.
  function onChange(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
  }

  function _notifyListeners() {
    _listeners.forEach(fn => { try { fn(); } catch (e) { console.warn('[HubData] listener error', e); } });
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  // Subscribe to storage changes (idempotent).
  // Immediately notifies registered onChange callbacks so tools can
  // populate their dropdowns on load without needing a separate call.
  function init(toolId) {
    if (!_initialized) {
      _initialized = true;
      // HubStorage.subscribe handles BOTH same-tab and cross-tab changes,
      // as well as real-time Supabase updates when cloud mode is active.
      HubStorage.subscribe(PH_KEY, () => _notifyListeners());
      // Keep the native storage event as a belt-and-suspenders fallback for
      // any direct localStorage writes that bypass HubStorage.
      window.addEventListener('storage', e => {
        if (e.key === PH_KEY) _notifyListeners();
      });
    }
    // Notify immediately — primary mechanism for populating UI on load.
    _notifyListeners();
  }

  return {
    init,
    getData,
    hasData,
    getProjects,
    getProject,
    getMembers,
    getMember,
    getAllTasks,
    getTasksForProject,
    findTask,
    onChange,
  };
})();
