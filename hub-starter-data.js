/**
 * hub-starter-data.js
 * Seeds all Thinking Hub tools with interconnected sample entries on first run.
 * Call HubStarter.seed() to write all data; HubStarter.hasAnyData() to detect existing users.
 */

window.HubStarter = (() => {

  // Stable IDs used across tools to create cross-tool relationships
  const IDS = {
    // Members
    alex:    'm-alex',
    sam:     'm-sam',
    jordan:  'm-jordan',
    // Projects
    website: 'p-website',
    reno:    'p-reno',
    // Goals
    qtr:     'q-2026-q2',
    obj1:    'obj-website',
    obj2:    'obj-reno',
    kr1:     'kr-w1',
    kr2:     'kr-w2',
    kr3:     'kr-r1',
    kr4:     'kr-r2',
    // Decisions
    dec1:    'dh-starter1',
    dec2:    'dh-starter2',
    // Risks
    risk1:   'risk-starter1',
    risk2:   'risk-starter2',
    // Meetings
    mtg1:    'mtg-starter1',
    mtg2:    'mtg-starter2',
    // Learning
    learn1:  'learn-starter1',
    learn2:  'learn-starter2',
    learn3:  'learn-starter3',
    // Tools
    tool1:   'tool-starter1',
    tool2:   'tool-starter2',
    tool3:   'tool-starter3',
    // Scrum
    sprint1: 'sp-starter1',
    story1:  'st-starter1',
    story2:  'st-starter2',
    story3:  'st-starter3',
    story4:  'st-starter4',
    // Retro
    retro1:  'retro-starter1',
  };

  const NOW = new Date().toISOString();
  // Dates relative to today for realism
  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  function seedProjectHub() {
    const data = {
      members: [
        { id: IDS.alex,   name: 'Alex',   role: 'Project Lead',    color: '#b8f033,#111' },
        { id: IDS.sam,    name: 'Sam',    role: 'Designer',        color: '#3ecdf0,#111' },
        { id: IDS.jordan, name: 'Jordan', role: 'Site Engineer',   color: '#9b3ef0,#fff' },
      ],
      projects: [
        {
          id: IDS.website, name: 'Website Redesign',
          desc: 'Redesign the company website with a modern look, improved navigation, and mobile-first layout.',
          group: '', status: 'active', color: '#3ecdf0',
          members: [
            { memberId: IDS.alex,   role: 'Lead' },
            { memberId: IDS.sam,    role: 'Designer' },
            { memberId: IDS.jordan, role: 'Developer' },
          ],
          goals: [
            { id: 'g-w1', name: 'Mobile-first redesign shipped', desc: 'New responsive design live on production.', progress: 30 },
            { id: 'g-w2', name: 'Page load under 2 seconds',     desc: 'Core Web Vitals passing on all key pages.', progress: 10 },
          ],
          milestones: [
            { id: 'ms-w1', name: 'Design sign-off',    date: daysFromNow(12),  color: '#3ecdf0' },
            { id: 'ms-w2', name: 'Launch',             date: daysFromNow(45),  color: '#b8f033' },
          ],
          tasks: [
            { id: 't-w1', title: 'Create wireframes for homepage',  milestoneId: 'ms-w1', assigneeId: IDS.sam,    priority: 'high',   done: true,  due: daysFromNow(-5),  status: 'done' },
            { id: 't-w2', title: 'Choose CMS platform',             milestoneId: 'ms-w1', assigneeId: IDS.alex,   priority: 'high',   done: false, due: daysFromNow(3),   status: 'inprogress', taskCode: '', taskType: 'decision', blockedReason: '', completedAt: '', workstreamId: '' },
            { id: 't-w3', title: 'Write content for About page',    milestoneId: 'ms-w2', assigneeId: IDS.alex,   priority: 'medium', done: false, due: daysFromNow(20),  status: 'todo',      taskCode: '', taskType: '',         blockedReason: '', completedAt: '', workstreamId: '' },
            { id: 't-w4', title: 'Frontend development — homepage', milestoneId: 'ms-w2', assigneeId: IDS.jordan, priority: 'high',   done: false, due: daysFromNow(35),  status: 'todo',      taskCode: '', taskType: '',         blockedReason: '', completedAt: '', workstreamId: '' },
          ],
          workstreams: [],
        },
        {
          id: IDS.reno, name: 'Community Center Renovation',
          desc: 'Phased renovation of the local community center — structural upgrades, new MEP systems, and accessible entrance.',
          group: '', status: 'active', color: '#f0a03e',
          members: [
            { memberId: IDS.alex,   role: 'Project Manager' },
            { memberId: IDS.jordan, role: 'Site Engineer' },
          ],
          goals: [
            { id: 'g-r1', name: 'Phase 1 permit approved',     desc: 'Building permit submitted and approved by municipality.', progress: 60 },
            { id: 'g-r2', name: 'Main contractor selected',    desc: 'Procurement complete, contract signed.', progress: 25 },
          ],
          milestones: [
            { id: 'ms-r1', name: 'Permit submission',   date: daysFromNow(8),  color: '#f0a03e' },
            { id: 'ms-r2', name: 'Contractor sign-off', date: daysFromNow(30), color: '#9b3ef0' },
          ],
          tasks: [
            { id: 't-r1', title: 'Finalise structural drawings',       milestoneId: 'ms-r1', assigneeId: IDS.jordan, priority: 'high',   done: true,  due: daysFromNow(-3),  status: 'done' },
            { id: 't-r2', title: 'Submit building permit application', milestoneId: 'ms-r1', assigneeId: IDS.alex,   priority: 'high',   done: false, due: daysFromNow(7),   status: 'inprogress', taskCode: '', taskType: '', blockedReason: '', completedAt: '', workstreamId: '' },
            { id: 't-r3', title: 'Issue contractor RFP',               milestoneId: 'ms-r2', assigneeId: IDS.alex,   priority: 'medium', done: false, due: daysFromNow(14),  status: 'todo',      taskCode: '', taskType: '', blockedReason: '', completedAt: '', workstreamId: '' },
            { id: 't-r4', title: 'Conduct site safety walkthrough',    milestoneId: '',       assigneeId: IDS.jordan, priority: 'medium', done: false, due: daysFromNow(10),  status: 'todo',      taskCode: '', taskType: '', blockedReason: '', completedAt: '', workstreamId: '' },
          ],
          workstreams: [],
        },
      ],
      kanbanWip: {},
    };
    HubStorage.set('project-hub-v1', data);
  }

  function seedGoalsHub() {
    const data = {
      quarters: [
        {
          id: IDS.qtr, label: 'Q2 2026',
          startDate: '2026-04-01', endDate: '2026-06-30',
          archived: false,
          objectives: [
            {
              id: IDS.obj1,
              title: 'Launch the redesigned website on time',
              why: 'Our current site is outdated — a modern, fast site directly improves lead generation.',
              color: '#3ecdf0', type: 'committed',
              projectId: IDS.website, projectName: 'Website Redesign',
              createdAt: NOW,
              keyResults: [
                { id: IDS.kr1, title: 'Design approved by stakeholders', type: 'checkbox', done: false, score: 0.3 },
                { id: IDS.kr2, title: 'Site launched with Lighthouse score ≥ 90', type: 'checkbox', done: false, score: 0.1 },
              ],
            },
            {
              id: IDS.obj2,
              title: 'Complete renovation on time and on budget',
              why: 'The community center is a high-visibility project — delays affect public trust and funding.',
              color: '#f0a03e', type: 'committed',
              projectId: IDS.reno, projectName: 'Community Center Renovation',
              createdAt: NOW,
              keyResults: [
                { id: IDS.kr3, title: 'Building permit approved', type: 'checkbox', done: false, score: 0.6 },
                { id: IDS.kr4, title: 'Main contractor selected within budget', type: 'checkbox', done: false, score: 0.25 },
              ],
            },
          ],
        },
      ],
    };
    HubStorage.set('goals-hub-v1', data);
  }

  function seedDecisionHub() {
    const decisions = [
      {
        id: IDS.dec1,
        projectId: IDS.website,
        title: 'Choose CMS platform',
        type: 'decision',
        status: 'decided',
        confidence: 'high',
        cynefin: 'complicated',
        summary: 'We evaluated WordPress, Webflow, and a custom Next.js build. Selected Webflow for its balance of design flexibility and low maintenance overhead.',
        reason: 'Team lacks the bandwidth to maintain a custom build. Webflow gives the design team autonomy without developer bottlenecks.',
        tags: 'website, technology, platform',
        links: '', obsidianNote: '',
        problemLens: {
          situation: 'Our website is 5 years old and built on a legacy PHP stack. Redesigning means choosing a new platform.',
          complication: 'Developer time is limited; the design team wants to be self-sufficient for content updates.',
          question: 'Which CMS gives the best balance of design freedom and long-term maintainability for a small team?',
        },
        decisionCanvas: {},
        optionMap: [
          { id: 'opt-1', name: 'WordPress', notes: 'Familiar, large ecosystem, but requires dev maintenance.' },
          { id: 'opt-2', name: 'Webflow',   notes: 'Visual editor, fast for design team, low hosting cost.' },
          { id: 'opt-3', name: 'Next.js',   notes: 'Full control, best performance, but high maintenance burden.' },
        ],
        alignment: [],
        createdAt: NOW,
      },
      {
        id: IDS.dec2,
        projectId: IDS.reno,
        title: 'Select main contractor for renovation',
        type: 'decision',
        status: 'in-progress',
        confidence: 'medium',
        cynefin: 'complicated',
        summary: 'Evaluating three contractors from the RFP. Criteria: price, track record with public buildings, and availability.',
        reason: 'Contractor quality directly determines schedule risk. The permit submission is already under way.',
        tags: 'renovation, procurement, construction',
        links: '', obsidianNote: '',
        problemLens: {
          situation: 'Building permit is submitted. We need a contractor ready to mobilise within 4 weeks of approval.',
          complication: 'Two of the three bidders are competitive on price but have limited public-building experience.',
          question: 'Which contractor gives us the best risk-adjusted outcome for a community center renovation?',
        },
        decisionCanvas: {},
        optionMap: [
          { id: 'opt-a', name: 'BuildRight Ltd',   notes: 'Lowest bid, limited public-building track record.' },
          { id: 'opt-b', name: 'Apex Construction', notes: 'Mid-range price, strong municipal references.' },
          { id: 'opt-c', name: 'CoreBuild Co.',    notes: 'Highest bid, ISO-certified, proven schedule adherence.' },
        ],
        alignment: [],
        createdAt: NOW,
      },
    ];
    HubStorage.set('decision-hub-v1', decisions);
  }

  function seedRiskHub() {
    const data = {
      risks: [
        {
          id: IDS.risk1,
          title: 'Content delivery delays from stakeholders',
          category: 'schedule',
          status: 'open',
          probability: 4, impact: 3,
          mitigation: 'Set a hard content freeze deadline 3 weeks before launch. Assign a content owner per page.',
          treatment: 'Accept with mitigation — build a 1-week buffer into the launch schedule.',
          owner: 'Alex',
          reviewDate: daysFromNow(14),
          projectId: IDS.website, projectName: 'Website Redesign',
          createdAt: NOW,
        },
        {
          id: IDS.risk2,
          title: 'Building permit approval delayed by municipality',
          category: 'regulatory',
          status: 'open',
          probability: 3, impact: 5,
          mitigation: 'Pre-consult with the planning office before formal submission. Prepare all supporting documents in advance.',
          treatment: 'Avoid — engage a planning consultant to review submission before filing.',
          owner: 'Jordan',
          reviewDate: daysFromNow(10),
          projectId: IDS.reno, projectName: 'Community Center Renovation',
          createdAt: NOW,
        },
      ],
    };
    HubStorage.set('risk-hub-v1', data);
  }

  function seedMeetingsHub() {
    const data = {
      meetings: [
        {
          id: IDS.mtg2,
          title: 'Renovation Design Review',
          date: daysFromNow(-2),
          attendees: 'Alex, Jordan, Planning Consultant',
          projectId: IDS.reno, projectName: 'Community Center Renovation',
          agenda: '1. Review structural drawings\n2. Confirm permit checklist\n3. Contractor RFP timeline',
          notes: 'Structural drawings signed off by Jordan. Planning consultant confirmed the permit checklist is complete. RFP to go out by end of week. Key concern: permit turnaround could take 4–6 weeks.',
          actionItems: [
            { id: 'ai-r1', text: 'Submit building permit application', done: false, taskCreated: false, createdAt: NOW },
            { id: 'ai-r2', text: 'Issue RFP to three shortlisted contractors', done: false, taskCreated: false, createdAt: NOW },
          ],
          createdAt: NOW,
        },
        {
          id: IDS.mtg1,
          title: 'Website Redesign Kickoff',
          date: daysFromNow(-7),
          attendees: 'Alex, Sam, Jordan',
          projectId: IDS.website, projectName: 'Website Redesign',
          agenda: '1. Project scope & goals\n2. CMS platform decision\n3. Design timeline\n4. Roles & responsibilities',
          notes: 'Team aligned on Webflow as the CMS. Sam to lead all design work. Jordan will handle DNS, hosting, and any custom code. Alex owns content and stakeholder sign-offs. Target launch in 6 weeks.',
          actionItems: [
            { id: 'ai-w1', text: 'Sam: Create wireframes for homepage and about page', done: true, taskCreated: false, createdAt: NOW },
            { id: 'ai-w2', text: 'Alex: Draft content outline for key pages', done: false, taskCreated: false, createdAt: NOW },
            { id: 'ai-w3', text: 'Jordan: Set up Webflow project and staging environment', done: false, taskCreated: false, createdAt: NOW },
          ],
          createdAt: NOW,
        },
      ],
    };
    HubStorage.set('meetings-hub-v1', data);
  }

  function seedLearningHub() {
    const data = {
      items: [
        {
          id: IDS.learn1,
          title: "Don't Make Me Think",
          author: 'Steve Krug',
          type: 'book',
          status: 'reading',
          url: '',
          tags: ['ux', 'design', 'web'],
          highlights: [
            { id: 'hl-1', text: 'Users don\'t read pages — they scan them. Design for scanning, not reading.', createdAt: NOW },
            { id: 'hl-2', text: 'Every page should answer: where am I, what can I do here, where can I go?', createdAt: NOW },
          ],
          notes: 'Directly applicable to the website redesign. Nav clarity and page hierarchy are the biggest wins.',
          keyInsight: 'Good UX is invisible — the best design is the one the user never has to think about.',
          createdAt: NOW,
        },
        {
          id: IDS.learn2,
          title: 'Construction Project Management — A Practical Guide',
          author: 'Frederick Gould',
          type: 'book',
          status: 'done',
          url: '',
          tags: ['construction', 'project-management', 'aec'],
          highlights: [
            { id: 'hl-3', text: 'Procurement strategy should be decided before design is complete — not after.', createdAt: NOW },
          ],
          notes: 'Gave me a solid framework for the contractor selection process on the renovation.',
          keyInsight: 'The critical path in construction is almost always about procurement and permits, not the build itself.',
          createdAt: NOW,
        },
        {
          id: IDS.learn3,
          title: 'Facilitating Stakeholder Workshops',
          author: 'Ingrid Bens',
          type: 'article',
          status: 'to-read',
          url: '',
          tags: ['facilitation', 'workshops', 'stakeholders'],
          highlights: [],
          notes: '',
          keyInsight: '',
          createdAt: NOW,
        },
      ],
    };
    HubStorage.set('learning-hub-v1', data);
  }

  function seedToolPortfolio() {
    const tools = [
      {
        id: IDS.tool1,
        name: 'Figma',
        icon: '🎨',
        url: 'https://figma.com',
        status: 'adopted',
        ring: 'adopt',
        archLayer: 'Application',
        category: 'Design',
        note: 'Primary design tool for all UI work. Used daily by Sam for wireframes and mockups.',
        projectIds: [IDS.website],
        order: 1,
      },
      {
        id: IDS.tool2,
        name: 'Autodesk Forma',
        icon: '🏗',
        url: 'https://forma.autodesk.com',
        status: 'evaluating',
        ring: 'trial',
        archLayer: 'Application',
        category: 'AEC',
        note: 'Cloud-based conceptual design and sustainability analysis for early-stage AEC projects. Trialling for the renovation project.',
        projectIds: [IDS.reno],
        order: 1,
      },
      {
        id: IDS.tool3,
        name: 'Miro',
        icon: '📋',
        url: 'https://miro.com',
        status: 'adopted',
        ring: 'adopt',
        archLayer: 'Application',
        category: 'Collaboration',
        note: 'Used for remote workshops, stakeholder mapping, and async retrospectives.',
        projectIds: [IDS.website, IDS.reno],
        order: 1,
      },
    ];
    HubStorage.set('tool-portfolio-v1', tools);
  }

  function seedKmqt() {
    function item(text) {
      return { id: 'kmqt-' + Math.random().toString(36).slice(2, 9), text, tags: [], createdAt: NOW };
    }
    const payload = {
      v: 1,
      labels: { K: 'Keep', M: 'MoyaMoya', Q: 'Question', T: 'Try' },
      columns: {
        K: [item('Users want mobile-first navigation — confirmed in 3 interviews')],
        M: [item('Contractor pricing varies widely — unclear what\'s driving the gap')],
        Q: [item('Should we phase the renovation or shut down the whole center at once?')],
        T: [item('Try a content-first design approach for the website — sketch with real copy, not lorem ipsum')],
      },
      links: [],
    };
    HubStorage.set('kmqt_current_v2', payload);
  }

  function seedRetroHub() {
    const data = {
      retros: [
        {
          id: IDS.retro1,
          name: 'Website Sprint 1 Retro',
          createdAt: NOW,
          items: {
            well: [
              { id: 'r-w1', text: 'Kickoff meeting was well-structured — everyone left with clear owners', reactions: {}, createdAt: NOW },
              { id: 'r-w2', text: 'Sam\'s wireframes sparked great discussion and saved rework later', reactions: {}, createdAt: NOW },
            ],
            improve: [
              { id: 'r-i1', text: 'Content scope wasn\'t defined early enough — Alex got pulled in late', reactions: {}, createdAt: NOW },
              { id: 'r-i2', text: 'CMS decision took longer than expected — next time set a decision deadline upfront', reactions: {}, createdAt: NOW },
            ],
            actions: [
              { id: 'r-a1', text: 'Define content freeze date at the start of each sprint', reactions: {}, createdAt: NOW },
            ],
          },
        },
      ],
      activeId: IDS.retro1,
    };
    HubStorage.set('retro-hub-v1', data);
  }

  function seedLogHub() {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = daysFromNow(-1);
    const data = {
      entries: {
        [yesterday]: {
          mood: 4,
          bulletFocus: 'notes',
          text: 'Renovation design review went well — drawings are signed off and the permit checklist is ready. Feeling confident about the submission timeline. Need to chase Alex on the content outline for the website.',
          learning: 'Early engagement with the planning office really reduces permit risk. Worth doing every time.',
          updatedAt: new Date(yesterday).toISOString(),
        },
        [today]: {
          mood: 3,
          bulletFocus: 'tasks',
          text: '• Reviewed contractor bids — two strong options\n• Website wireframes look great, Sam nailed the mobile layout\n○ Write content brief for homepage\n○ Follow up with planning office on permit timeline',
          learning: '',
          updatedAt: NOW,
        },
      },
    };
    HubStorage.set('log-hub-v1', data);
  }

  function seedScrumHub() {
    const sprint = {
      id: IDS.sprint1,
      name: 'Sprint 1 — Website Core',
      goal: 'Ship the homepage and about page in Webflow, ready for stakeholder review.',
      startDate: daysFromNow(-7),
      endDate: daysFromNow(7),
      status: 'active',
      velocity: 0,
      reviewNotes: '', retroWell: '', retroImprove: '', retroActions: '',
    };
    const backlogs = [
      {
        id: IDS.story1, title: 'Homepage hero section',
        description: 'Build the hero with headline, subheading, CTA button, and background image.',
        acceptanceCriteria: 'Renders correctly on mobile (375px) and desktop (1440px). CTA links to contact page.',
        type: 'feature', priority: 'must',
        points: 3, projectId: IDS.website,
        status: 'backlog', sprintId: IDS.sprint1, sprintStatus: 'inprogress',
        createdAt: NOW,
      },
      {
        id: IDS.story2, title: 'Navigation menu — mobile responsive',
        description: 'Hamburger menu on mobile, horizontal nav on desktop. Links to all main pages.',
        acceptanceCriteria: 'Passes WCAG 2.1 AA contrast. Works on iOS Safari and Chrome Android.',
        type: 'feature', priority: 'must',
        points: 2, projectId: IDS.website,
        status: 'backlog', sprintId: IDS.sprint1, sprintStatus: 'todo',
        createdAt: NOW,
      },
      {
        id: IDS.story3, title: 'About page — team section',
        description: 'Display team members with photo, name, and role.',
        acceptanceCriteria: 'Content managed via Webflow CMS. Images are WebP format.',
        type: 'feature', priority: 'should',
        points: 2, projectId: IDS.website,
        status: 'backlog', sprintId: null, sprintStatus: 'todo',
        createdAt: NOW,
      },
      {
        id: IDS.story4, title: 'Site-wide accessibility audit',
        description: 'Run axe-core against all pages and fix critical issues.',
        acceptanceCriteria: 'Zero critical violations in axe-core report.',
        type: 'chore', priority: 'could',
        points: 3, projectId: IDS.website,
        status: 'backlog', sprintId: null, sprintStatus: 'todo',
        createdAt: NOW,
      },
    ];
    const state = {
      backlogs,
      sprints: [sprint],
      settings: { linkedProjectId: IDS.website },
      wipLimits: { todo: 0, inprogress: 3, done: 0 },
      dod: [],
    };
    HubStorage.set('scrum-hub-v1', JSON.stringify(state));
  }

  function seedSchedule() {
    const items = [
      {
        id: 'sch-s1', title: 'Website Kickoff Meeting',
        type: 'event', start: daysFromNow(-7), end: daysFromNow(-7),
        color: '#3ecdf0', projectId: IDS.website, projectRef: 'Website Redesign',
        notes: 'Kickoff with full team. Agreed on Webflow and 6-week timeline.',
        done: true, sourceTool: null, sourceId: null, createdAt: NOW,
      },
      {
        id: 'sch-s2', title: 'Design Sign-off Review',
        type: 'event', start: daysFromNow(12), end: daysFromNow(12),
        color: '#3ecdf0', projectId: IDS.website, projectRef: 'Website Redesign',
        notes: 'Stakeholder review of final designs before build begins.',
        done: false, sourceTool: null, sourceId: null, createdAt: NOW,
      },
      {
        id: 'sch-s3', title: 'Permit Submission Deadline',
        type: 'deadline', start: daysFromNow(8), end: daysFromNow(8),
        color: '#f0a03e', projectId: IDS.reno, projectRef: 'Community Center Renovation',
        notes: 'Hard deadline — planning office closes applications at end of month.',
        done: false, sourceTool: null, sourceId: null, createdAt: NOW,
      },
    ];
    HubStorage.set('schedule-v1', { items, settings: { defaultZoom: 'month', defaultView: 'timeline' } });
  }

  function hasAnyData() {
    const keys = ['project-hub-v1', 'goals-hub-v1', 'decision-hub-v1', 'risk-hub-v1'];
    return keys.some(k => !!HubStorage.get(k));
  }

  function seed() {
    seedProjectHub();
    seedGoalsHub();
    seedDecisionHub();
    seedRiskHub();
    seedMeetingsHub();
    seedLearningHub();
    seedToolPortfolio();
    seedKmqt();
    seedRetroHub();
    seedLogHub();
    seedScrumHub();
    seedSchedule();
  }

  return { seed, hasAnyData };

})();
