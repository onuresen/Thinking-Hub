// hub-i18n.js — Shell UI translations (EN / JA / TR)
const HubI18n = (() => {
  const T = {
    en: {
      'greeting.morning':   'Good morning',
      'greeting.afternoon': 'Good afternoon',
      'greeting.evening':   'Good evening',
      'session.label':      'Session',
      'session.placeholder':'Name this session…',
      'group.WEEKLY CYCLE': 'WEEKLY CYCLE',
      'group.ALIGN & DECIDE':'ALIGN & DECIDE',
      'group.EXECUTE':      'EXECUTE',
      'group.STRATEGY':     'STRATEGY',
      'tool.project-hub':   'Project Hub',
      'tool.schedule':      'Schedule',
      'tool.review-hub':    'Weekly Review',
      'tool.goals-hub':     'Goals Hub',
      'tool.meetings-hub':  'Meeting Notes',
      'tool.kmqt-board':    'KMQT Board',
      'tool.decision-hub':  'Decision Hub',
      'tool.risk-hub':      'Risk Register',
      'tool.stakeholder-hub':'Stakeholder Map',
      'tool.scrum-hub':     'Scrum Board',
      'tool.focus-hub':     'Focus Timer',
      'tool.log-hub':       'Daily Log',
      'tool.idea-swiper':   'Idea Swiper',
      'tool.learning-hub':  'Learning Log',
      'tool.graph-hub':     'Dependency Graph',
      'tool.retro-hub':     'Retro Board',
      'tool.achievements-hub':'Achievements',
      'tool.canvas-hub':    'Spatial Canvas',
      'tool.tool-portfolio':'Tool Portfolio',
      'tool.help-hub':      'Help & Guide',
      'settings.title':     'Data & Backup',
      'settings.lang.label':'Language',
      'settings.close':     'Close',
    },
    ja: {
      'greeting.morning':   'おはようございます',
      'greeting.afternoon': 'こんにちは',
      'greeting.evening':   'こんばんは',
      'session.label':      'セッション',
      'session.placeholder':'セッション名を入力…',
      'group.WEEKLY CYCLE': '週次サイクル',
      'group.ALIGN & DECIDE':'合意・決断',
      'group.EXECUTE':      '実行',
      'group.STRATEGY':     '戦略',
      'tool.project-hub':   'プロジェクト',
      'tool.schedule':      'スケジュール',
      'tool.review-hub':    '週次レビュー',
      'tool.goals-hub':     '目標',
      'tool.meetings-hub':  '会議メモ',
      'tool.kmqt-board':    'KMQTボード',
      'tool.decision-hub':  '意思決定',
      'tool.risk-hub':      'リスク管理',
      'tool.stakeholder-hub':'ステークホルダー',
      'tool.scrum-hub':     'スクラム',
      'tool.focus-hub':     'フォーカス',
      'tool.log-hub':       '日誌',
      'tool.idea-swiper':   'アイデア',
      'tool.learning-hub':  '学習ログ',
      'tool.graph-hub':     '依存グラフ',
      'tool.retro-hub':     'レトロ',
      'tool.achievements-hub':'実績',
      'tool.canvas-hub':    'キャンバス',
      'tool.tool-portfolio':'ツール一覧',
      'tool.help-hub':      'ヘルプ & ガイド',
      'settings.title':     'データ・バックアップ',
      'settings.lang.label':'言語',
      'settings.close':     '閉じる',
    },
    tr: {
      'greeting.morning':   'Günaydın',
      'greeting.afternoon': 'İyi öğleler',
      'greeting.evening':   'İyi akşamlar',
      'session.label':      'Oturum',
      'session.placeholder':'Oturum adı…',
      'group.WEEKLY CYCLE': 'HAFTALIK DÖNGÜ',
      'group.ALIGN & DECIDE':'HİZALA & KARAR VER',
      'group.EXECUTE':      'UYGULA',
      'group.STRATEGY':     'STRATEJİ',
      'tool.project-hub':   'Proje Merkezi',
      'tool.schedule':      'Takvim',
      'tool.review-hub':    'Haftalık Değlendirme',
      'tool.goals-hub':     'Hedefler',
      'tool.meetings-hub':  'Toplantı Notları',
      'tool.kmqt-board':    'KMQT Panosu',
      'tool.decision-hub':  'Karar Merkezi',
      'tool.risk-hub':      'Risk Kayıdı',
      'tool.stakeholder-hub':'Paydaş Haritası',
      'tool.scrum-hub':     'Scrum Panosu',
      'tool.focus-hub':     'Odak Zamanlayıcı',
      'tool.log-hub':       'Günlük',
      'tool.idea-swiper':   'Fikir Tarayıcı',
      'tool.learning-hub':  'Öğrenme Günlüğü',
      'tool.graph-hub':     'Bağımlılık Grafiği',
      'tool.retro-hub':     'Retrospektif',
      'tool.achievements-hub':'Başarılar',
      'tool.canvas-hub':    'Uzamsal Kanvas',
      'tool.tool-portfolio':'Araç Portföyü',
      'tool.help-hub':      'Yardım & Kılavuz',
      'settings.title':     'Veri & Yedekleme',
      'settings.lang.label':'Dil',
      'settings.close':     'Kapat',
    }
  };

  const SETTINGS_KEY = 'hub-settings-v1';
  let _lang = 'en';

  function _detect() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      if (s.language && T[s.language]) return s.language;
    } catch {}
    const nav = (navigator.language || 'en').slice(0, 2);
    return T[nav] ? nav : 'en';
  }

  function t(key) {
    return (T[_lang] && T[_lang][key]) || (T.en[key]) || key;
  }

  function setLang(code) {
    if (!T[code]) return;
    _lang = code;
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      s.language = code;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {}
  }

  function getLang() { return _lang; }

  _lang = _detect();

  return { t, setLang, getLang, SUPPORTED: Object.keys(T) };
})();
