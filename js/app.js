/* ============================================================
   みちしき — app.js
   サーバーもデータベースも使わない。状態は localStorage にだけ置く。
   ============================================================ */
(() => {
  'use strict';

  const STORAGE_KEY = 'michishiki.v1';
  const VERSION = 1;

  const THEMES = [
    { id: 'ai',      name: 'あい',     light: ['#f4f6fb', '#5c6fb1'], dark: ['#121826', '#8b9ce0'] },
    { id: 'asayake', name: 'あさやけ', light: ['#fbf5f1', '#df8a72'], dark: ['#211a1a', '#ec9f89'] },
    { id: 'wakaba',  name: 'わかば',   light: ['#f3f7f2', '#7aa583'], dark: ['#171e19', '#93bf9b'] },
    { id: 'yunagi',  name: 'ゆうなぎ', light: ['#f6f4fa', '#9788c7'], dark: ['#1c1a25', '#b0a3dd'] },
    { id: 'kohaku',  name: 'こはく',   light: ['#faf7f0', '#c9a052'], dark: ['#1f1b14', '#dcb46a'] },
  ];

  const QUADS = {
    1: { name: 'いま、やる',     sub: 'いそぐ・だいじ' },
    2: { name: 'きめて、やる',   sub: 'いそがない・だいじ' },
    3: { name: 'さっと片づける', sub: 'いそぐ・だいじではない' },
    4: { name: '手ばなす',       sub: 'いそがない・だいじではない' },
  };


  /* よく使うことば。ひとつの言葉に複数のタグを持たせ、「いつ」と「なに」の掛け合わせで絞れる */
  const DICT_TIME = [
    { id: 'asa',      name: 'あさ' },
    { id: 'hiru',     name: 'ひる' },
    { id: 'yoru',     name: 'よる' },
    { id: 'tokidoki', name: 'ときどき' },
  ];
  const DICT_SCENE = [
    { id: 'kodomo',    name: 'こどもと' },
    { id: 'kazoku',    name: 'かぞく・ペット' },
    { id: 'gohan',     name: 'ごはん' },
    { id: 'ouchi',     name: 'おうちのこと' },
    { id: 'jibun',     name: 'じぶんのこと' },
    { id: 'odekake',   name: 'おでかけ' },
    { id: 'tetsuzuki', name: '手続き・れんらく' },
  ];
  const DICT_GROUPS = DICT_TIME.concat(DICT_SCENE);

  /* くらしのかたち：辞書の言葉に差し込む役割。
     {こども} のように書いた言葉は、名前があれば人数分に展開し、無ければ fb（または一般の呼び名）に置きかえる */
  const ROLES = {
    'こども':     { key: 'kids',    on: h => h.kidsOn,     names: h => h.kids,   generic: () => 'こども' },
    'パートナー': { key: 'partner', on: h => h.partnerOn,  names: h => (h.partnerName ? [h.partnerName] : []), generic: () => 'パートナー' },
    'かぞく':     { key: 'family',  on: h => h.family.length > 0, names: h => h.family, generic: () => '家族' },
    'ペット':     { key: 'pets',    on: h => h.pets.length > 0,   names: h => h.pets,   generic: () => 'ペット' },
  };
  const PARTNER_QUICK = ['夫', '妻', '彼氏', '彼女', 'パートナー', '相方', 'だんな', 'つま'];
  const FAMILY_QUICK = ['母', '父', '義母', '義父', '祖母', '祖父', '姉', '兄', '妹', '弟'];
  const PH_RE = /\{(こども|パートナー|かぞく|ペット)\}/;

  const W = (w, ...tags) => {
    const opt = typeof tags[tags.length - 1] === 'object' ? tags.pop() : {};
    return Object.assign({ w, tags }, opt);
  };
  const DICTIONARY = [
    // ごはん
    W('朝ごはんの準備', 'asa', 'gohan'),
    W('お弁当づくり', 'asa', 'gohan'),
    W('お昼ごはんの準備', 'hiru', 'gohan'),
    W('献立を考える', 'hiru', 'gohan'),
    W('買い物', 'hiru', 'gohan', 'odekake'),
    W('晩ごはんの準備', 'yoru', 'gohan'),
    W('食器を洗う', 'asa', 'yoru', 'gohan', 'ouchi'),
    W('ミルク', 'asa', 'hiru', 'yoru', 'kodomo', 'gohan'),
    W('離乳食', 'asa', 'hiru', 'yoru', 'kodomo', 'gohan'),
    W('おやつ', 'hiru', 'kodomo', 'gohan'),
    // こどもと（名前を入れると人数分に増える）
    W('{こども}の検温', 'asa', 'kodomo', { fb: '検温' }),
    W('{こども}のおむつ替え', 'asa', 'hiru', 'yoru', 'kodomo', { fb: 'おむつ替え' }),
    W('{こども}のお着がえ', 'asa', 'yoru', 'kodomo', { fb: 'お着がえ' }),
    W('{こども}の連絡帳を書く', 'asa', 'kodomo', 'tetsuzuki', { fb: '連絡帳を書く' }),
    W('保育園の送り', 'asa', 'kodomo', 'odekake'),
    W('保育園のお迎え', 'yoru', 'kodomo', 'odekake'),
    W('公園に行く', 'hiru', 'kodomo', 'odekake'),
    W('{こども}と遊ぶ', 'hiru', 'kodomo', { fb: 'こどもと遊ぶ' }),
    W('習いごとの送迎', 'hiru', 'kodomo', 'odekake'),
    W('図書館に行く', 'hiru', 'kodomo', 'odekake'),
    W('{こども}をお風呂に入れる', 'yoru', 'kodomo', { fb: 'お風呂に入れる' }),
    W('{こども}に絵本を読む', 'yoru', 'kodomo', { fb: '絵本を読む' }),
    W('{こども}の話を聞く', 'yoru', 'kodomo', { fb: 'こどもの話を聞く' }),
    W('{こども}の寝かしつけ', 'yoru', 'kodomo', { fb: '寝かしつけ' }),
    W('{こども}の明日の持ち物', 'yoru', 'kodomo', { fb: '明日の持ち物の確認' }),
    W('学校のプリント確認', 'yoru', 'kodomo', 'tetsuzuki'),
    W('{こども}の予防接種の予約', 'tokidoki', 'kodomo', 'tetsuzuki', { fb: '予防接種の予約' }),
    W('{こども}の爪を切る', 'tokidoki', 'kodomo', { fb: '爪を切る' }),
    // かぞく・ペット（設定で「いる」にしたときだけ出る）
    W('{パートナー}のお弁当', 'asa', 'gohan', 'kazoku'),
    W('{パートナー}に予定を伝える', 'yoru', 'kazoku', 'tetsuzuki'),
    W('{パートナー}に買い物を頼む', 'hiru', 'kazoku', 'tetsuzuki'),
    W('{パートナー}と話す時間', 'yoru', 'kazoku'),
    W('{かぞく}の様子を見る', 'asa', 'yoru', 'kazoku'),
    W('{かぞく}の薬の確認', 'asa', 'yoru', 'kazoku'),
    W('{かぞく}のごはん', 'hiru', 'gohan', 'kazoku'),
    W('{かぞく}と話す', 'hiru', 'kazoku'),
    W('{かぞく}の通院の付き添い', 'tokidoki', 'kazoku', 'odekake'),
    W('{ペット}のごはん', 'asa', 'yoru', 'kazoku', 'gohan'),
    W('{ペット}の水をかえる', 'asa', 'kazoku'),
    W('{ペット}の散歩', 'asa', 'yoru', 'kazoku', 'odekake'),
    W('{ペット}のトイレそうじ', 'asa', 'ouchi', 'kazoku'),
    W('{ペット}と遊ぶ', 'hiru', 'kazoku'),
    W('{ペット}の通院', 'tokidoki', 'kazoku', 'odekake'),
    // おうちのこと
    W('洗濯をまわす', 'asa', 'ouchi'),
    W('洗濯物を干す', 'asa', 'ouchi'),
    W('ゴミを出す', 'asa', 'ouchi'),
    W('植物に水をやる', 'asa', 'ouchi'),
    W('洗濯物をたたむ', 'hiru', 'yoru', 'ouchi'),
    W('掃除機をかける', 'hiru', 'ouchi'),
    W('郵便を確認する', 'hiru', 'ouchi', 'tetsuzuki'),
    W('宅配を受け取る', 'hiru', 'ouchi'),
    W('お風呂そうじ', 'yoru', 'ouchi'),
    W('布団を敷く', 'yoru', 'ouchi'),
    W('翌日の準備', 'yoru', 'ouchi'),
    W('トイレそうじ', 'tokidoki', 'ouchi'),
    W('布団を干す', 'tokidoki', 'ouchi'),
    W('冷蔵庫の中を見る', 'tokidoki', 'ouchi', 'gohan'),
    // じぶんのこと
    W('薬をのむ', 'asa', 'yoru', 'jibun'),
    W('水を飲む', 'asa', 'hiru', 'yoru', 'jibun'),
    W('ストレッチ', 'asa', 'yoru', 'jibun'),
    W('散歩', 'asa', 'hiru', 'jibun', 'odekake'),
    W('ひと休み', 'hiru', 'jibun'),
    W('好きな音楽を聴く', 'hiru', 'yoru', 'jibun'),
    W('友だちに連絡', 'hiru', 'jibun', 'tetsuzuki'),
    W('日記を書く', 'yoru', 'jibun'),
    W('早く寝る', 'yoru', 'jibun'),
    W('病院の予約', 'tokidoki', 'jibun', 'tetsuzuki'),
    W('美容院の予約', 'tokidoki', 'jibun', 'tetsuzuki'),
    // おでかけ・手続き
    W('ドラッグストアに行く', 'hiru', 'odekake'),
    W('銀行・振込', 'hiru', 'tetsuzuki', 'odekake'),
    W('返信するメール', 'hiru', 'tetsuzuki'),
    W('電話をかける', 'hiru', 'tetsuzuki'),
    W('役所の手続き', 'tokidoki', 'tetsuzuki', 'odekake'),
    W('支払い', 'tokidoki', 'tetsuzuki'),
    W('車にガソリンを入れる', 'tokidoki', 'odekake'),
  ];

  /* 役割を展開して、いま表示すべき言葉の一覧にする（自分で足した言葉も含む） */
  function expandWord(d, h) {
    const m = d.w.match(PH_RE);
    if (!m) return [d.w];
    const role = ROLES[m[1]];
    if (!role.on(h)) return [];
    const names = role.names(h);
    if (names.length) return names.map(n => d.w.replace(m[0], n));
    return [d.fb || d.w.replace(m[0], role.generic())];
  }
  function activeDictionary() {
    const h = state.household;
    const out = [];
    DICTIONARY.concat(state.custom).forEach(d => {
      if (!h.kidsOn && d.tags.includes('kodomo')) return;
      expandWord(d, h).forEach(w => out.push({ w, tags: d.tags, custom: !!d.custom }));
    });
    return out;
  }
  const kazokuOn = () => { const h = state.household; return h.partnerOn || h.family.length > 0 || h.pets.length > 0; };
  const RECENT_MAX = 40;

  const DONE_WORDS = [
    'ひとつ、進みました。',
    'いい調子。',
    '道が少し見えてきました。',
    'その一歩が、だいじ。',
    'ちゃんと歩いています。',
    'よし、次へ。',
  ];
  /* 全部できたときの見出し。夜は「おやすみ」系も混ざる */
  const FINALE_TITLES = [
    'きょうも、がんばってくれてありがとう。',
    'おつかれさま。ここまで、ちゃんと来ました。',
    'がんばったね。きょうの分は、おしまい。',
    'ぜんぶ歩けました。もう休んでいい時間です。',
    'きょうのあなたは、ちゃんと歩きました。',
    'よくやりました。あとは、ゆっくり。',
    'ひとつずつ、ぜんぶ。すごいことです。',
    'きょうの道、ぜんぶ歩ききりました。',
    'ここまで来たら、あとは自分の時間です。',
    'だいじょうぶ、きょうはもう十分。',
  ];
  const FINALE_TITLES_NIGHT = [
    'おやすみなさい。きょうも、いい一日でした。',
    'おやすみ。がんばってくれて、ありがとう。',
    'きょうはここまで。ゆっくり眠ってください。',
  ];
  const FINALE_TITLES_DAY = [
    'ひと息つきましょう。きょうはもう、上がりです。',
    'あとの時間は、好きに使っていい時間です。',
  ];
  const FINALE_SUB = [
    'きょうのあなたは、ちゃんと歩きました。',
    'ここまで来た自分に、ひと息。',
    'あとは、ゆっくり休んでください。',
    'きょうの分は、もう十分です。',
  ];

  // ---------- 状態 ----------
  const defaultState = () => ({
    version: VERSION,
    date: todayKey(),
    tasks: [],
    recent: [],
    custom: [],
    household: { kidsOn: true, kids: [], partnerOn: false, partnerName: '', family: [], pets: [] },
    settings: { theme: 'ai', appearance: 'system', celebrate: true, view: 'list' },
  });

  let state = load();
  let carried = 0;          // 持ち越し件数（表示用、保存しない）
  let editingId = null;     // シートで編集中のタスク
  let pendingQ = 0;         // シートで選択中の象限

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return normalize(parsed);
    } catch (e) {
      console.warn('保存データを読めなかったので、新しく始めます。', e);
      return defaultState();
    }
  }
  function normalize(obj) {
    const base = defaultState();
    const s = Object.assign({}, base, obj || {});
    s.settings = Object.assign({}, base.settings, (obj && obj.settings) || {});
    if (!THEMES.some(t => t.id === s.settings.theme)) s.settings.theme = 'ai';
    if (!['system', 'light', 'dark'].includes(s.settings.appearance)) s.settings.appearance = 'system';
    if (!['list', 'quad'].includes(s.settings.view)) s.settings.view = 'list';
    s.settings.celebrate = s.settings.celebrate !== false;
    s.tasks = Array.isArray(s.tasks) ? s.tasks.filter(t => t && typeof t.title === 'string').map(t => ({
      id: String(t.id || uid()),
      title: t.title.slice(0, 120),
      done: !!t.done,
      doneAt: t.doneAt || null,
      q: [1, 2, 3, 4].includes(t.q) ? t.q : 0,
      createdAt: t.createdAt || Date.now(),
    })) : [];
    if (typeof s.date !== 'string') s.date = todayKey();
    s.recent = Array.isArray(s.recent) ? s.recent.filter(x => typeof x === 'string').slice(0, RECENT_MAX) : [];
    const names = a => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim().slice(0, 20)).slice(0, 10) : [];
    const h = Object.assign({}, base.household, (obj && obj.household) || {});
    s.household = { kidsOn: h.kidsOn !== false, kids: names(h.kids), partnerOn: !!h.partnerOn, partnerName: String(h.partnerName || '').slice(0, 20), family: names(h.family), pets: names(h.pets) };
    const groupIds = new Set(DICT_GROUPS.map(g => g.id));
    s.custom = Array.isArray(s.custom) ? s.custom.filter(c => c && typeof c.w === 'string' && c.w.trim()).map(c => ({
      w: c.w.trim().slice(0, 60), tags: (Array.isArray(c.tags) ? c.tags : []).filter(t => groupIds.has(t)), custom: true,
    })).slice(0, 200) : [];
    return s;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('保存できませんでした。容量がいっぱいかもしれません。'); }
  }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

  function todayKey(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* 日付が変わっていたら、できた分は手放し、まだの分だけ持ち越す */
  function rollover() {
    const today = todayKey();
    if (state.date === today) return;
    const remaining = state.tasks.filter(t => !t.done);
    carried = remaining.length;
    state.tasks = remaining;
    state.date = today;
    save();
    if (carried > 0) {
      $('#carryText').textContent = `前の日から ${carried} 件を持ち越しました。いま必要なものだけ残しても大丈夫です。`;
      $('#carryNotice').hidden = false;
    }
  }

  // ---------- DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7.5"/></svg>';
  const ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v13M6 12l6 6 6-6"/></svg>';

  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- テーマ ----------
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const { theme, appearance } = state.settings;
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    const dark = appearance === 'dark' || (appearance === 'system' && darkQuery.matches);
    root.setAttribute('data-mode', dark ? 'dark' : 'light');
    const t = THEMES.find(x => x.id === theme);
    const meta = $('meta[name="theme-color"]');
    if (meta && t) meta.setAttribute('content', dark ? t.dark[0] : t.light[0]);
  }
  darkQuery.addEventListener('change', applyTheme);

  // ---------- 描画 ----------
  const undone = () => state.tasks.filter(t => !t.done);
  const doneList = () => state.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  function render() {
    renderToday();
    renderViews();
  }

  function renderToday() {
    const d = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    $('#todayDate').innerHTML = `${d.getMonth() + 1}月${d.getDate()}日<small>${days[d.getDay()]}曜日</small>`;
    const total = state.tasks.length, done = total - undone().length;
    $('#ringDone').textContent = done;
    $('#ringTotal').textContent = total;
    const ratio = total ? done / total : 0;
    $('#ringBar').style.strokeDashoffset = String(251.3 * (1 - ratio));
    let status;
    if (total === 0) status = 'まだ何も置いていません。';
    else if (done === total) status = 'きょうの分は、ぜんぶ歩きました。';
    else if (done === 0) status = `${total} 件。ひとつずつで、だいじょうぶ。`;
    else status = `あと ${total - done} 件。いい歩き方です。`;
    $('#todayStatus').textContent = status;
  }

  function renderViews() {
    const view = state.settings.view;
    $('.seg').dataset.active = view;
    $$('.seg-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    $('#viewList').hidden = view !== 'list';
    $('#viewQuad').hidden = view !== 'quad';
    document.body.classList.toggle('wide', view === 'quad');
    $('#suggestBtn').hidden = !(view === 'list' && undone().some(t => t.q));
    if (view === 'list') renderList(); else renderQuad();
  }

  function taskRow(t, i, arr) {
    const q = t.q ? `<span class="q-tag q${t.q}">${QUADS[t.q].name}</span>` : '';
    const order = t.done ? '' : `
      <div class="order">
        <button type="button" data-act="up" aria-label="上へ" ${i === 0 ? 'disabled' : ''}>${ICON_UP}</button>
        <button type="button" data-act="down" aria-label="下へ" ${i === arr.length - 1 ? 'disabled' : ''}>${ICON_DOWN}</button>
      </div>`;
    return `
      <li class="task ${t.done ? 'is-done' : ''}" data-id="${t.id}">
        <button type="button" class="check ${t.done ? 'is-on' : ''}" data-act="toggle" data-q="${t.q}" aria-label="${t.done ? 'まだにする' : 'できた'}" aria-pressed="${t.done}">${ICON_CHECK}</button>
        <button type="button" class="title" data-act="edit">${esc(t.title)}${q}</button>
        ${order}
      </li>`;
  }

  function renderList() {
    const u = undone(), d = doneList();
    let html = '';
    if (u.length === 0 && d.length === 0) {
      html = `
        <div class="empty">
          <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 12 V 26.5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M7 27 H 19" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M8 6.5 H 22 L 26.25 10.75 L 22 15 H 8 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="10.75" r="1.6" fill="var(--bg)"/></svg>
          <p>きょうのあなたがやることを、ひとつ書いてみましょう。</p>
          <small>下の欄に入れて、追加するだけ。順番はあとから並べかえられます。</small>
        </div>`;
    } else {
      if (u.length === 0) {
        html += `<div class="empty"><p>まだのものは、ありません。</p><small>下の欄から、次の道を足せます。</small></div>`;
      } else {
        html += `<ul class="tasks" id="undoneList">${u.map((t, i) => taskRow(t, i, u)).join('')}</ul>`;
      }
      if (d.length) {
        html += `
          <details class="done-block" ${u.length === 0 ? 'open' : ''}>
            <summary>できた ${d.length}</summary>
            <ul class="tasks">${d.map((t, i) => taskRow(t, i, d)).join('')}</ul>
          </details>`;
      }
    }
    $('#viewList').innerHTML = html;
  }

  function cardHtml(t) {
    return `
      <div class="card" data-id="${t.id}" draggable="true">
        <button type="button" class="check ${t.done ? 'is-on' : ''}" data-act="toggle" data-q="${t.q}" aria-label="できた">${ICON_CHECK}</button>
        <button type="button" class="title" data-act="edit">${esc(t.title)}</button>
      </div>`;
  }

  function renderQuad() {
    const u = undone();
    const unsorted = u.filter(t => !t.q);
    const byQ = q => u.filter(t => t.q === q);
    let html = '';
    if (u.length === 0) {
      html += `<div class="empty"><p>分けるものが、まだありません。</p><small>下の欄から足すか、「ならべる」で書いたものがここに並びます。</small></div>`;
    } else {
      html += `
        <div class="tray">
          <div class="tray-head"><b>まだ分けていない</b><small>${unsorted.length ? 'タップして置き場所を選ぶ。PCならドラッグでも。' : 'すべて分けました。'}</small></div>
          ${unsorted.length ? `<div class="chips-row">${unsorted.map(cardHtml).join('')}</div>` : ''}
        </div>`;
    }
    html += `
      <div class="matrix">
        <div></div>
        <div class="axis-x"><span>いそぐ</span><span>いそがない</span></div>
        <div class="axis-y"><span>だいじ</span></div>
        ${quadHtml(1, byQ(1))}${quadHtml(2, byQ(2))}
        <div class="axis-y"><span>だいじではない</span></div>
        ${quadHtml(3, byQ(3))}${quadHtml(4, byQ(4))}
      </div>`;
    $('#viewQuad').innerHTML = html;
  }
  function quadHtml(q, list) {
    return `
      <section class="quad q${q}" data-q="${q}" aria-label="${QUADS[q].name}">
        <div class="quad-head"><span class="quad-name">${QUADS[q].name}</span><span class="quad-count">${list.length ? list.length : ''}</span></div>
        ${list.length ? `<div class="quad-list">${list.map(cardHtml).join('')}</div>` : `<p class="quad-empty">${QUADS[q].sub}</p>`}
      </section>`;
  }

  // ---------- 操作 ----------
  function addTask(raw) {
    const t = String(raw || '').trim();
    if (!t) return;
    const title = t.slice(0, 120);
    state.tasks.push({ id: uid(), title, done: false, doneAt: null, q: 0, createdAt: Date.now() });
    state.recent = [title].concat(state.recent.filter(x => x !== title)).slice(0, RECENT_MAX);
    save(); render(); renderSuggest();
    $('#carryNotice').hidden = true;
  }
  const hasToday = title => state.tasks.some(t => t.title === title);

  /* 入力欄の候補：自分が入れたことば → 辞書のことば */
  function renderSuggest() {
    const seen = new Set();
    const words = [];
    state.recent.concat(activeDictionary().map(d => d.w)).forEach(w => { if (!seen.has(w)) { seen.add(w); words.push(w); } });
    $('#suggestList').innerHTML = words.slice(0, 80).map(w => `<option value="${esc(w)}"></option>`).join('');
  }
  function findTask(id) { return state.tasks.find(t => t.id === id); }

  function toggleDone(id, el) {
    const t = findTask(id);
    if (!t) return;
    t.done = !t.done;
    t.doneAt = t.done ? Date.now() : null;
    if (!t.done) {
      // まだに戻したら、まだの列の最後へ
      state.tasks = state.tasks.filter(x => x.id !== id).concat([t]);
    }
    save();
    if (t.done && state.settings.celebrate) celebrate(el);
    // 完了の見た目を一瞬見せてから描き直す
    if (el) { el.classList.toggle('is-on', t.done); el.classList.add('pop'); }
    setTimeout(render, t.done ? 380 : 0);
    if (t.done && undone().length === 0) setTimeout(finale, 650);
  }

  function move(id, dir) {
    const u = undone();
    const i = u.findIndex(t => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= u.length) return;
    [u[i], u[j]] = [u[j], u[i]];
    state.tasks = u.concat(doneList());
    save(); render();
    const row = $(`.task[data-id="${id}"]`);
    if (row) {
      row.classList.add('bump');
      const btn = row.querySelector(`[data-act="${dir < 0 ? 'up' : 'down'}"]`);
      if (btn && !btn.disabled) btn.focus();
    }
  }

  function setQuadrant(id, q) {
    const t = findTask(id);
    if (!t) return;
    t.q = q;
    save(); render();
  }

  function suggestOrder() {
    const rank = t => (t.q ? t.q : 9);
    const u = undone().slice().sort((a, b) => rank(a) - rank(b));
    state.tasks = u.concat(doneList());
    save(); render();
    toast('4象限の順にならべました。');
  }

  function removeTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); render();
  }

  // ---------- 編集シート ----------
  const taskSheet = $('#taskSheet');
  function openTaskSheet(id) {
    const t = findTask(id);
    if (!t) return;
    editingId = id;
    pendingQ = t.q || 0;
    $('#taskTitle').value = t.title;
    paintQPicker();
    taskSheet.showModal();
    setTimeout(() => { $('#taskTitle').focus(); }, 50);
  }
  function paintQPicker() {
    $$('.q-opt').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.q) === pendingQ)));
  }
  $('#qPicker').addEventListener('click', e => {
    const b = e.target.closest('.q-opt'); if (!b) return;
    pendingQ = Number(b.dataset.q); paintQPicker();
  });
  $('#taskForm').addEventListener('submit', e => {
    e.preventDefault();
    const t = findTask(editingId);
    const title = $('#taskTitle').value.trim();
    if (t && title) { t.title = title.slice(0, 120); t.q = pendingQ; save(); render(); }
    taskSheet.close();
  });
  $('#taskCancel').addEventListener('click', () => taskSheet.close());
  $('#taskDelete').addEventListener('click', () => {
    const t = findTask(editingId);
    if (t && confirm(`「${t.title}」を消しますか？`)) { removeTask(editingId); taskSheet.close(); }
  });

  // ---------- 設定シート ----------
  const settingsSheet = $('#settingsSheet');
  let settingsTab = 'color';
  function openSettings(tab) {
    if (tab) settingsTab = tab;
    paintSettings(); settingsSheet.showModal();
  }
  function paintTabs() {
    $$('#settingsTabs .tab').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === settingsTab)));
    $$('.tab-panel').forEach(p => { p.hidden = p.dataset.panel !== settingsTab; });
  }
  $('#settingsTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    settingsTab = t.dataset.tab; paintTabs();
  });
  $('#settingsToDict').addEventListener('click', () => { settingsSheet.close(); openDict(); });
  function paintSettings() {
    paintTabs();
    paintHousehold();
    paintCustomList();
    $('#themePicker').innerHTML = THEMES.map(t => `
      <button type="button" class="theme-opt" data-theme="${t.id}" aria-pressed="${state.settings.theme === t.id}">
        <span class="theme-swatch"><i style="background:${t.light[1]}"></i><i style="background:${t.dark[1]}"></i></span>
        <b>${t.name}</b>
      </button>`).join('');
    $$('#appearancePicker .chip').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.appearance === state.settings.appearance)));
    $$('#celebratePicker .chip').forEach(c => c.setAttribute('aria-pressed', String((c.dataset.celebrate === 'on') === state.settings.celebrate)));
  }
  $('#themePicker').addEventListener('click', e => {
    const b = e.target.closest('.theme-opt'); if (!b) return;
    state.settings.theme = b.dataset.theme; save(); applyTheme(); paintSettings();
  });
  $('#appearancePicker').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.settings.appearance = b.dataset.appearance; save(); applyTheme(); paintSettings();
  });
  $('#celebratePicker').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.settings.celebrate = b.dataset.celebrate === 'on'; save(); paintSettings();
  });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#settingsClose').addEventListener('click', () => settingsSheet.close());

  // データの書き出し・読み込み・全消去
  $('#exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `michishiki-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('書き出しました。');
  });
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!obj || !Array.isArray(obj.tasks)) throw new Error('shape');
      if (state.tasks.length && !confirm('いまのデータを、読み込んだ内容で置きかえます。よいですか？')) return;
      state = normalize(obj);
      save(); applyTheme(); rollover(); render(); paintSettings();
      toast(`${state.tasks.length} 件を読み込みました。`);
    } catch (err) {
      toast('このファイルは読み込めませんでした。');
    }
  });
  $('#clearBtn').addEventListener('click', () => {
    if (!confirm('きょうのやることをすべて消します。カラーテーマ・くらしのかたち・辞書は残ります。よいですか？')) return;
    const keep = { settings: state.settings, household: state.household, custom: state.custom };
    state = Object.assign(defaultState(), keep);
    save(); render(); settingsSheet.close();
    toast('きょうのやることを、すべて消しました。');
  });

  // 背景タップでシートを閉じる
  [taskSheet, settingsSheet, $('#dictSheet'), $('#finale')].forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });



  function paintCustomList() {
    const nameOf = id => (DICT_GROUPS.find(g => g.id === id) || {}).name || id;
    $('#customList').innerHTML = state.custom.length
      ? `<div class="custom-list">${state.custom.map(c => `
          <div class="custom-item">
            <b>${esc(c.w)}</b>
            <span class="tags">${c.tags.map(t => `<span class="tag">${esc(nameOf(t))}</span>`).join('')}</span>
            <button type="button" class="word-x" data-remove="${esc(c.w)}" aria-label="「${esc(c.w)}」を辞書から消す">×</button>
          </div>`).join('')}</div>`
      : `<p class="word-empty">まだありません。「よく使うことば」の下の欄から足せます。</p>`;
  }
  $('#customList').addEventListener('click', e => {
    const x = e.target.closest('.word-x'); if (!x) return;
    const w = x.dataset.remove;
    if (!confirm(`「${w}」を辞書から消しますか？`)) return;
    state.custom = state.custom.filter(c => c.w !== w);
    save(); renderSuggest(); paintCustomList();
  });

  // ---------- くらしのかたち ----------
  function nameListHtml(key, items, placeholder) {
    return `
      <div class="names" data-key="${key}">
        ${items.map((n, i) => `<span class="name-chip">${esc(n)}<button type="button" class="name-x" data-idx="${i}" aria-label="「${esc(n)}」を消す">×</button></span>`).join('')}
        ${items.length < 10 ? `<form class="name-add" data-key="${key}"><input type="text" maxlength="20" placeholder="${placeholder}" aria-label="${placeholder}"><button type="submit" class="chip">足す</button></form>` : ''}
      </div>`;
  }
  function paintHousehold() {
    const h = state.household;
    $$('#kidsToggle .chip').forEach(c => c.setAttribute('aria-pressed', String((c.dataset.on === 'on') === h.kidsOn)));
    $('#kidsNames').innerHTML = h.kidsOn ? nameListHtml('kids', h.kids, 'こどもの名前') : '';
    $$('#partnerToggle .chip').forEach(c => c.setAttribute('aria-pressed', String((c.dataset.on === 'on') === h.partnerOn)));
    $('#partnerBox').hidden = !h.partnerOn;
    const quick = PARTNER_QUICK.includes(h.partnerName) || !h.partnerName ? PARTNER_QUICK : PARTNER_QUICK.concat([h.partnerName]);
    $('#partnerQuick').innerHTML = quick.map(n => `<button type="button" class="chip" data-name="${esc(n)}" aria-pressed="${h.partnerName === n}">${esc(n)}</button>`).join('');
    $('#partnerNameInput').value = PARTNER_QUICK.includes(h.partnerName) ? '' : h.partnerName;
    $('#familyQuick').innerHTML = FAMILY_QUICK.filter(n => !h.family.includes(n)).map(n => `<button type="button" class="chip small" data-name="${esc(n)}">＋ ${esc(n)}</button>`).join('');
    $('#familyNames').innerHTML = nameListHtml('family', h.family, 'ほかの呼び名・名前');
    $('#petNames').innerHTML = nameListHtml('pets', h.pets, 'ペットの名前');
  }
  function householdChanged() { save(); renderSuggest(); paintHousehold(); }
  $('#kidsToggle').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.household.kidsOn = b.dataset.on === 'on'; householdChanged();
  });
  $('#partnerToggle').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.household.partnerOn = b.dataset.on === 'on'; householdChanged();
  });
  $('#partnerQuick').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.household.partnerName = b.dataset.name; householdChanged();
  });
  const setPartnerName = () => {
    const v = $('#partnerNameInput').value.trim().slice(0, 20);
    if (!v) return;
    state.household.partnerName = v; householdChanged();
  };
  $('#partnerNameSet').addEventListener('click', setPartnerName);
  $('#partnerNameInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); setPartnerName(); } });
  $('#familyQuick').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const list = state.household.family;
    if (!list.includes(b.dataset.name) && list.length < 10) list.push(b.dataset.name);
    householdChanged();
  });
  $('#household').addEventListener('submit', e => {
    const f = e.target.closest('.name-add'); if (!f) return;
    e.preventDefault();
    const input = f.querySelector('input');
    const v = input.value.trim().slice(0, 20);
    if (!v) return;
    const list = state.household[f.dataset.key];
    if (!list.includes(v) && list.length < 10) list.push(v);
    householdChanged();
    const next = $(`.name-add[data-key="${f.dataset.key}"] input`); if (next) next.focus();
  });
  $('#household').addEventListener('click', e => {
    const x = e.target.closest('.name-x'); if (!x) return;
    const key = x.closest('.names').dataset.key;
    state.household[key].splice(Number(x.dataset.idx), 1);
    householdChanged();
  });

  // ---------- よく使うことば ----------
  const dictSheet = $('#dictSheet');
  const dictSel = { mine: false, time: null, scene: null };
  function openDict() {
    dictSel.mine = false; dictSel.time = null; dictSel.scene = null;
    customTags = []; paintCustomTags();
    paintDict();
    dictSheet.showModal();
  }
  $('#dictToSettings').addEventListener('click', () => { dictSheet.close(); openSettings('my'); });
  function dictWords() {
    if (dictSel.mine) return state.recent;
    const seen = new Set();
    return activeDictionary()
      .filter(d => (!dictSel.time || d.tags.includes(dictSel.time)) && (!dictSel.scene || d.tags.includes(dictSel.scene)))
      .map(d => d.w)
      .filter(w => !seen.has(w) && seen.add(w));
  }
  function visibleScenes() {
    return DICT_SCENE.filter(g => (g.id !== 'kodomo' || state.household.kidsOn) && (g.id !== 'kazoku' || kazokuOn() || state.custom.some(c => c.tags.includes('kazoku'))));
  }
  function paintDict() {
    const chip = (g, kind, on) => `<button type="button" class="dict-tab" data-kind="${kind}" data-id="${g.id}" aria-pressed="${on}">${g.name}</button>`;
    $('#dictMine').setAttribute('aria-pressed', String(dictSel.mine));
    $('#dictMineCount').textContent = state.recent.length ? state.recent.length : '';
    $('#dictTimeRow').innerHTML = DICT_TIME.map(g => chip(g, 'time', !dictSel.mine && dictSel.time === g.id)).join('');
    if (dictSel.scene && !visibleScenes().some(g => g.id === dictSel.scene)) dictSel.scene = null;
    $('#dictSceneRow').innerHTML = visibleScenes().map(g => chip(g, 'scene', !dictSel.mine && dictSel.scene === g.id)).join('');
    $('#dictFilters').classList.toggle('is-muted', dictSel.mine);

    const words = dictWords();
    const nameOf = id => (DICT_GROUPS.find(g => g.id === id) || {}).name || '';
    let label;
    if (dictSel.mine) label = 'じぶんのことば';
    else if (dictSel.time && dictSel.scene) label = `${nameOf(dictSel.time)} × ${nameOf(dictSel.scene)}`;
    else if (dictSel.time || dictSel.scene) label = nameOf(dictSel.time || dictSel.scene);
    else label = 'すべて';
    $('#dictLabel').innerHTML = `${esc(label)}<small>${words.length}</small>`;

    let empty;
    if (dictSel.mine) empty = '自分で入れたことばが、ここにたまっていきます。';
    else empty = 'この組み合わせには、まだことばがありません。片方をはずすか、下から足してみてください。';
    const customSet = new Set(state.custom.map(c => c.w));
    const wordHtml = w => `<span class="word-wrap"><button type="button" class="word ${customSet.has(w) ? 'is-custom' : ''}" data-word="${esc(w)}" aria-pressed="${hasToday(w)}">${esc(w)}</button>${customSet.has(w) && !dictSel.mine ? `<button type="button" class="word-x" data-remove="${esc(w)}" aria-label="「${esc(w)}」を辞書から消す">×</button>` : ''}</span>`;
    $('#dictBody').innerHTML = words.length
      ? `<div class="dict-words">${words.map(wordHtml).join('')}</div>`
      : `<p class="word-empty">${empty}</p>`;
    $('#customForm').hidden = dictSel.mine;
  }
  // ことばを足す（タグは「いつ」「なに」からいくつでも）
  function paintCustomTags() {
    const selT = new Set(customTags);
    $('#customTags').innerHTML = DICT_TIME.concat(DICT_SCENE).map(g => `<button type="button" class="dict-tab small" data-tag="${g.id}" aria-pressed="${selT.has(g.id)}">${g.name}</button>`).join('');
  }
  let customTags = [];
  $('#customTags').addEventListener('click', e => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    const t = b.dataset.tag;
    customTags = customTags.includes(t) ? customTags.filter(x => x !== t) : customTags.concat([t]);
    paintCustomTags();
  });
  $('#customForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#customWord');
    const w = input.value.trim().slice(0, 60);
    if (!w) return;
    const tags = customTags.length ? customTags.slice() : [dictSel.time, dictSel.scene].filter(Boolean);
    if (!state.custom.some(c => c.w === w)) state.custom.push({ w, tags, custom: true });
    else state.custom = state.custom.map(c => c.w === w ? { w, tags, custom: true } : c);
    save(); renderSuggest();
    input.value = ''; customTags = []; paintCustomTags();
    if (tags.length && !(dictSel.time && tags.includes(dictSel.time)) && !(dictSel.scene && tags.includes(dictSel.scene))) { dictSel.time = null; dictSel.scene = null; }
    paintDict();
    toast(`「${w}」を辞書に足しました。`);
  });
  $('#dictMine').addEventListener('click', () => { dictSel.mine = !dictSel.mine; paintDict(); });
  $('#dictFilters').addEventListener('click', e => {
    const b = e.target.closest('.dict-tab'); if (!b) return;
    dictSel.mine = false;
    const k = b.dataset.kind, id = b.dataset.id;
    dictSel[k] = dictSel[k] === id ? null : id;   // 同じものをもう一度押すと解除
    paintDict();
  });
  $('#dictBody').addEventListener('click', e => {
    const x = e.target.closest('.word-x');
    if (x) {
      const w = x.dataset.remove;
      if (!confirm(`「${w}」を辞書から消しますか？`)) return;
      state.custom = state.custom.filter(c => c.w !== w);
      save(); renderSuggest(); paintDict();
      return;
    }
    const b = e.target.closest('.word'); if (!b) return;
    const w = b.dataset.word;
    if (hasToday(w)) { toast('もう置いてあります。'); return; }
    addTask(w);
    b.setAttribute('aria-pressed', 'true');
    $('#dictMineCount').textContent = state.recent.length;
    toast(`「${w}」を置きました。`);
  });
  $('#dictBtn').addEventListener('click', openDict);
  $('#dictClose').addEventListener('click', () => dictSheet.close());

  // ---------- イベント（委譲） ----------
  document.addEventListener('click', e => {
    const actEl = e.target.closest('[data-act]');
    if (!actEl) return;
    const holder = actEl.closest('[data-id]');
    if (!holder) return;
    const id = holder.dataset.id;
    switch (actEl.dataset.act) {
      case 'toggle': toggleDone(id, actEl); break;
      case 'edit': openTaskSheet(id); break;
      case 'up': move(id, -1); break;
      case 'down': move(id, 1); break;
    }
  });

  $$('.seg-btn').forEach(b => b.addEventListener('click', () => {
    state.settings.view = b.dataset.view; save(); renderViews();
  }));
  $('#suggestBtn').addEventListener('click', suggestOrder);
  $('#carryClose').addEventListener('click', () => { $('#carryNotice').hidden = true; });

  $('#composer').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#composerInput');
    addTask(input.value);
    input.value = '';
    input.focus();
  });

  // ドラッグ＆ドロップ（PC向け。スマホはタップで象限を選ぶ）
  let dragId = null;
  document.addEventListener('dragstart', e => {
    const card = e.target.closest && e.target.closest('.card');
    if (!card) return;
    dragId = card.dataset.id;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  document.addEventListener('dragend', e => {
    const card = e.target.closest && e.target.closest('.card');
    if (card) card.classList.remove('dragging');
    $$('.quad.is-over').forEach(q => q.classList.remove('is-over'));
    dragId = null;
  });
  document.addEventListener('dragover', e => {
    const zone = e.target.closest && (e.target.closest('.quad') || e.target.closest('.tray'));
    if (!zone || !dragId) return;
    e.preventDefault();
    $$('.quad.is-over').forEach(q => q.classList.remove('is-over'));
    if (zone.classList.contains('quad')) zone.classList.add('is-over');
  });
  document.addEventListener('drop', e => {
    const zone = e.target.closest && (e.target.closest('.quad') || e.target.closest('.tray'));
    if (!zone || !dragId) return;
    e.preventDefault();
    setQuadrant(dragId, zone.classList.contains('quad') ? Number(zone.dataset.q) : 0);
    dragId = null;
  });

  // ---------- 演出 ----------
  const fx = $('#fx');
  const ctx = fx.getContext('2d');
  let particles = [];
  let fxRunning = false;

  function resizeFx() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = innerWidth * dpr; fx.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resizeFx); resizeFx();

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function fxColors() {
    return [cssVar('--accent'), cssVar('--q1'), cssVar('--q2'), cssVar('--q3'), cssVar('--accent-ink')];
  }

  function burst(x, y, count, spread) {
    const colors = fxColors();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spread * (0.5 + Math.random());
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spread * 0.6,
        life: 1, decay: 0.012 + Math.random() * 0.012,
        r: 2 + Math.random() * 3, color: colors[i % colors.length],
        shape: Math.random() < 0.5 ? 'dot' : 'leaf', rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2,
      });
    }
    if (!fxRunning) { fxRunning = true; requestAnimationFrame(tick); }
  }
  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985; p.vy *= 0.985;
      p.life -= p.decay; p.rot += p.vr;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.8, p.r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (particles.length) requestAnimationFrame(tick);
    else { fxRunning = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  function celebrate(el) {
    toast(DONE_WORDS[Math.floor(Math.random() * DONE_WORDS.length)]);
    if (reduceMotion() || !el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 22, 4.5);
  }

  function finale() {
    const dlg = $('#finale');
    if (dlg.open) return;
    const hour = new Date().getHours();
    const pool = FINALE_TITLES.concat(hour >= 19 || hour < 4 ? FINALE_TITLES_NIGHT : FINALE_TITLES_DAY);
    $('#finaleTitle').textContent = pool[Math.floor(Math.random() * pool.length)];
    $('#finaleSub').textContent = FINALE_SUB[Math.floor(Math.random() * FINALE_SUB.length)];
    dlg.showModal();
    if (state.settings.celebrate && !reduceMotion()) {
      const w = innerWidth, h = innerHeight;
      burst(w * 0.5, h * 0.35, 60, 7);
      setTimeout(() => burst(w * 0.25, h * 0.4, 40, 6), 220);
      setTimeout(() => burst(w * 0.75, h * 0.4, 40, 6), 420);
    }
  }
  $('#finaleClose').addEventListener('click', () => $('#finale').close());

  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ---------- 起動 ----------
  applyTheme();
  rollover();
  render();
  renderSuggest();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { rollover(); render(); }
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* オフライン対応はあくまで補助 */ });
    });
  }
})();
