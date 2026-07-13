/* STAMPED COPY — canonical source: Vibe_Coding/MachiHub/machi-achievements.js (Machi Hub project).
   Edit there, then re-copy here. Do not edit this copy directly. */
// machi-achievements.js — rule engine that derives achievements[] on MachiEntity objects.
// Decoupled from the renderer: machi-engine.js just draws whatever achievements it finds on an
// entity; this module decides what an entity has earned. Hosts extend DEFAULT_RULES with their
// own rules (typically reading entity.meta, which the core schema deliberately doesn't interpret).

const MachiAchievements = (() => {
  /**
   * A rule: { id, label, icon, test(entity) => bool }.
   * `icon` is a single emoji/char used by hosts in detail panels; the town renderer only
   * shows a generic badge pixel per achievement, so icons stay a host-side concern.
   *
   * Default rules only use core schema fields (activity, staleness, shipped, tier) so they
   * hold for any host. Anything that needs host data (open-task counts, tags, usage stats)
   * belongs in that host's own rule list.
   */
  const DEFAULT_RULES = [
    {
      id: 'shipped',
      label: 'Shipped',
      icon: '🚩',
      test: (e) => e.shipped,
    },
    {
      id: 'on-fire',
      label: 'On fire — worked on within days',
      icon: '🔥',
      test: (e) => e.activity >= 0.5,
    },
    {
      id: 'landmark',
      label: 'Landmark — big footprint in the town',
      icon: '🏛️',
      test: (e) => e.tier >= 4,
    },
    {
      id: 'haunted',
      label: 'Haunted — untouched for a long time',
      icon: '👻',
      test: (e) => e.staleness >= 0.8,
    },
  ];

  /**
   * Evaluates rules against each entity and returns NEW entity objects with achievements[]
   * filled (existing achievements from the adapter are kept and deduped by id).
   * Pure function — never mutates the input.
   */
  function evaluate(entities, rules = DEFAULT_RULES) {
    return entities.map((e) => {
      const earned = rules
        .filter((r) => {
          try { return !!r.test(e); } catch { return false; }
        })
        .map((r) => ({ id: r.id, label: r.label, icon: r.icon }));
      const existing = e.achievements || [];
      const seen = new Set(existing.map((a) => a.id));
      const merged = existing.concat(earned.filter((a) => !seen.has(a.id)));
      return { ...e, achievements: merged };
    });
  }

  return { DEFAULT_RULES, evaluate };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MachiAchievements;
