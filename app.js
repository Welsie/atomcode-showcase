/* ============================================================
   AtomCode 灵感展示墙 — 前端逻辑（纯本地存储，无需后端）
   ============================================================ */

const STORE_KEY = 'atomcode_showcase_v1';
const LIKED_KEY = 'atomcode_liked_v1';
const OWNED_KEY = 'atomcode_owned_v1';

/* ---------- 工具函数 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const esc = (s = '') => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return '刚刚';
  if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
  if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
  if (d < 2592000) return Math.floor(d / 86400) + ' 天前';
  return new Date(ts).toLocaleDateString('zh-CN');
}

/* 由字符串生成稳定的渐变色（用于自动封面 & 头像） */
function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}
function gradientFor(str) {
  const h = hashHue(str);
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 55) % 360} 65% 45%))`;
}
function initials(name = '?') {
  const t = name.trim();
  return (t[0] || '?').toUpperCase();
}
/* 生成一张带 emoji 的渐变封面（data URI SVG） */
function emojiCover(emoji, seed) {
  const h = hashHue(seed);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${h},70%,55%)'/><stop offset='1' stop-color='hsl(${(h + 55) % 360},65%,45%)'/></linearGradient></defs>` +
    `<rect width='320' height='200' fill='url(#g)'/>` +
    `<text x='160' y='132' font-size='96' text-anchor='middle'>${emoji}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/* ---------- 数据层 ---------- */
let items = [];
let likedSet = new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
let ownedSet = new Set(JSON.parse(localStorage.getItem(OWNED_KEY) || '[]')); // 本浏览器发布的作品
let warpLevel = 0, warpTarget = 0;   // 飞船升空时的星星拉线（warp）强度 0..1
const isMine = id => ownedSet.has(id);
function saveOwned() { localStorage.setItem(OWNED_KEY, JSON.stringify([...ownedSet])); }
/* 作品传承链：从原作到父级（不含自身） */
function ancestry(item) {
  const chain = []; let p = item.parentId ? byId(item.parentId) : null, g = 0;
  while (p && g++ < 24) { chain.unshift(p); p = p.parentId ? byId(p.parentId) : null; }
  return chain;
}

function load() {
  const raw = localStorage.getItem(STORE_KEY);
  if (raw) {
    try { items = JSON.parse(raw); return; } catch (e) { /* fallthrough */ }
  }
  items = seedData();
  save();
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}
function saveLiked() {
  localStorage.setItem(LIKED_KEY, JSON.stringify([...likedSet]));
}
function byId(id) { return items.find(i => i.id === id); }

/* 初始示例作品 */
function seedData() {
  const now = Date.now();
  const mk = (o, ageH) => ({
    id: uid(), likes: 0, views: 0, comments: [], parentId: null,
    cover: null, createdAt: now - ageH * 3600000, ...o,
  });
  return [
    mk({ title: '像素天气小助手', tagline: '把实时天气变成会呼吸的像素动画', description: '用 AtomCode 生成的极简天气应用，晴天有会飘的云、雨天有像素雨滴。灵感来自老式游戏机。\n\n点击城市名可切换，长按可收藏。', author: '小林', tags: ['工具', '像素', '天气'], link: 'https://example.com', likes: 128, views: 940 }, 30),
    mk({ title: '深夜写诗机', tagline: '给一个词，还你一首赛博朋克小诗', description: '把任意关键词丢进去，它会用 AI 生成一段带霓虹感的短诗，还能一键生成配图卡片分享。', author: 'Neo', tags: ['AI', '创意', '文字'], likes: 96, views: 610, comments: [{ id: uid(), author: '路人甲', text: '半夜刷到，直接破防了 🥲', at: now - 2 * 3600000 }] }, 20),
    mk({ title: '番茄专注小宇宙', tagline: '每完成一个番茄钟，就点亮一颗星球', description: '把专注时间可视化成一个不断扩张的小宇宙，坚持越久星系越壮观。适合拖延症患者。', author: '阿泽', tags: ['效率', '游戏化'], likes: 74, views: 430 }, 12),
    mk({ title: '一键做表情包', tagline: '上传照片，秒变魔性动图', description: '内置十几种夸张模板，选一张脸就能生成会动的表情包，直接复制到聊天窗口。', author: 'Mimi', tags: ['工具', '娱乐', '图片'], likes: 205, views: 1520 }, 6),
    mk({ title: '声音可视化钢琴', tagline: '弹一个音，屏幕就绽放一朵花', description: '网页版钢琴，每个琴键对应一种粒子花，边弹边生成艺术画面，可导出成壁纸。', author: 'Lya', tags: ['音乐', '艺术', '互动'], likes: 158, views: 880 }, 3),
    mk({ title: '摸鱼倒计时', tagline: '离下班还有多少个「一杯咖啡」', description: '把枯燥的下班倒计时换算成咖啡、地铁、剧集数量，让等待变得有盼头。', author: '打工人', tags: ['效率', '娱乐'], likes: 61, views: 350 }, 1),
    ...curatedData(),
  ];
}

/* 精选真实案例（来自 AtomGit，固定 id + 真实项目截图） */
const CURATED_KEY = 'atomcode_curated_v5';
function curatedData() {
  const now = Date.now();
  return [
    {
      id: 'c_teris', title: '3D 圆柱俄罗斯方块', tagline: '把经典俄罗斯方块搬到旋转的圆柱体上，还能召唤魔法小人',
      description: '一款移动端网页版俄罗斯方块，最大的不同是——棋盘是一个 3D 圆柱：方块绕着圆柱表面排列，左右移动会环绕一整圈，横向滑动还能旋转视角。\n\n✨ 玩法亮点\n· 2 档难度（简单 26px×14 行 / 困难 22px×16 行）\n· 起始 100 分，可花分召唤「魔法小人」跳跃 / 穿墙 / 固化成方块补满一行\n· 消行、软降、硬降计分，每 10 行升级、落速加快\n\n🎨 7 种「眼前一亮」的动效：+N 飞分拖尾、SINGLE/DOUBLE/TRIPLE/TETRIS 通报、TETRIS 抖屏、LEVEL UP 爆破、MAGIC TIME 屏闪、按钮涟漪；还有 conic 旋转舞台光、MAGIC 充能进度条、玻璃高光键帽等 UI 细节。\n\n🔗 在线试玩：https://tetris.atomgit.com/',
      author: 'Midora', link: 'https://atomgit.com/Midora/teris-web', demo: 'https://raw.gitcode.work/Midora/teris-web/raw/main/index.html', tags: ['游戏', '3D', '俄罗斯方块', '移动端'],
      cover: 'assets/covers/teris-1.png', gallery: ['assets/covers/teris-1.png'], parentId: null, likes: 152, views: 1180,
      comments: [{ id: uid(), author: '方块控', text: '圆柱面下落太上头了！', at: now - 5 * 3600000 }], createdAt: now - 26 * 3600000,
    },
    {
      id: 'c_minecraft', title: 'Three.js 我的世界', tagline: '在单个 HTML 文件里，用 Three.js 复刻《我的世界》',
      description: '基于 Three.js 的第一人称沙盒体素世界，整个游戏塞进一个约 600 行的 HTML 文件，仅从 CDN 加载 Three.js，纯客户端运行。\n\n🎮 核心玩法\n· 程序化世界生成（Perlin 噪声）：草 / 泥土 / 石头 / 沙子 / 木头 / 树叶 / 木板 / 砖块 / 玻璃 / 水 10 种方块\n· 第一人称控制：WASD 移动、空格跳跃、Shift 奔跑、鼠标视角\n· 方块交互：左键挖掘、右键放置，9 格快捷栏（1-9 / 滚轮切换）\n· 半透明水体、AABB 碰撞检测\n\n🛠 技术亮点：区块化渲染 + 贪婪网格合并优化性能、顶点着色呈现自然质感、指针锁定 API 实现沉浸式操控。\n\n仓库：https://atomgit.com/saulcy/Minecraft',
      author: 'saulcy', link: 'https://atomgit.com/saulcy/Minecraft', demo: 'https://raw.gitcode.work/saulcy/Minecraft/raw/master/minecraft.html', tags: ['游戏', '3D', 'Three.js', '沙盒'],
      cover: 'assets/covers/minecraft-2.png', gallery: ['assets/covers/minecraft-2.png', 'assets/covers/minecraft-1.png'], parentId: null, likes: 233, views: 1620, comments: [], createdAt: now - 14 * 3600000,
    },
    {
      id: 'c_incoterms', title: 'Incoterms 2020 交互查询', tagline: '零依赖单页应用，快速理解与选择国际贸易术语',
      description: '一个零依赖、纯 HTML/CSS/原生 JS 的单页应用，帮外贸从业者快速理解和选择合适的 Incoterms® 2020 国际贸易术语。\n\n📋 六大模块\n· 规则全览：11 条规则卡片，按运输方式分组，标注风险 / 费用 / 清关责任\n· 规则详情：十大义务（A/B）、费用清单、注意事项、适用场景\n· 决策向导：参考 ICC 官方流程图，4-6 步问答推荐最合适的术语\n· 对比视图：并排对比最多 3 条规则\n· 运输链路：SVG 可视化风险转移点与费用承担分离\n· 多语言：中 / 英 / 西 / 法 / 德 / 日 6 种语言\n\n数据基于 ICC Incoterms® 2020 官方出版物（PUB723E / PUB817E / Wallchart）。\n\n仓库：https://atomgit.com/Gary_Yang/Incoterms2020',
      author: 'Gary_Yang', link: 'https://atomgit.com/Gary_Yang/Incoterms2020', demo: 'demos/incoterms/', tags: ['工具', '外贸', '效率', 'SPA'],
      cover: 'assets/covers/incoterms-1.png', gallery: ['assets/covers/incoterms-1.png', 'assets/covers/incoterms-2.png', 'assets/covers/incoterms-3.png'], parentId: null, likes: 74, views: 560, comments: [], createdAt: now - 8 * 3600000,
    },
    {
      id: 'c_guandan', title: '掼蛋 · 4人单机', tagline: '纯原生单文件，单人对三 AI 的竞技掼蛋',
      description: '一个纯原生 HTML/CSS/JS 实现的单人对三 AI 掼蛋（关牌）游戏，单文件全内联、无框架无构建无后端，双击即玩。你坐南，队友坐北，左右为对手，两队从打 2 一路升到打 A。\n\n🎴 完整竞技规则\n· 升级赛制：两队各自级别 2→A，坐庄方级牌为本局级牌；打 A 一局拿头游即赢整场\n· 打 A 保护、名次升级（双下 +3 / 1&3 名 +2 / 1&4 名 +1）\n· 进贡 / 还贡 / 抗贡；首局摸牌定先手\n· 红桃级牌 = 癞子（百搭）可拼任意牌型；接风\n\n🃏 牌型：单张 / 对子 / 三张 / 三带二 / 顺子 / 三连对 / 钢板，以及炸弹类（普通炸 / 同花顺 / 天王炸），非炸不能压炸；另有带拖特色玩法。\n\n🎮 操作：出牌 / 过 / 提示 / 新整场，点击手牌选中上浮。\n\n仓库：https://gitcode.com/Midora/guandan',
      author: 'Midora', link: 'https://gitcode.com/Midora/guandan', demo: 'https://raw.gitcode.work/Midora/guandan/raw/main/index.html', tags: ['游戏', '纸牌', '掼蛋', '单机'],
      cover: 'assets/covers/guandan-2.png', gallery: ['assets/covers/guandan-2.png', 'assets/covers/guandan-1.png'], parentId: null, likes: 96, views: 720, comments: [{ id: uid(), author: '牌搭子', text: '规则做得很全，AI 还会进贡抗贡，服气', at: now - 2 * 3600000 }], createdAt: now - 3 * 3600000,
    },
  ];
}
/* 合并精选案例（每个版本只跑一次）：新增缺失项，并刷新已有项的展示字段（封面/介绍等），保留用户的点赞/评论 */
function mergeCurated() {
  if (localStorage.getItem(CURATED_KEY)) return;
  const map = new Map(items.map(i => [i.id, i]));
  let changed = false;
  curatedData().forEach(c => {
    const ex = map.get(c.id);
    if (ex) { Object.assign(ex, { title: c.title, tagline: c.tagline, description: c.description, link: c.link, demo: c.demo, tags: c.tags, cover: c.cover, gallery: c.gallery }); changed = true; }
    else { items.push(c); changed = true; }
  });
  localStorage.setItem(CURATED_KEY, '1');
  if (changed) save();
}

/* ---------- 视图状态 ---------- */
let activeCat = null;   // 分类 key
let sortMode = 'new';
let keyword = '';
let scope = 'all';   // all | mine | liked

/* 精简的 3-4 个大分类：把细标签归并进去 */
const CATEGORIES = [
  { key: 'game', label: '🎮 游戏', tags: ['游戏', '3D', '俄罗斯方块', '沙盒', 'Three.js', '游戏化', '娱乐'] },
  { key: 'tool', label: '🛠 工具效率', tags: ['工具', '效率', '外贸', 'SPA', '天气', '移动端'] },
  { key: 'creative', label: '🎨 创意', tags: ['创意', '艺术', '音乐', '文字', '图片', '像素', '互动'] },
  { key: 'ai', label: '🤖 AI', tags: ['AI'] },
];
const catOf = key => CATEGORIES.find(c => c.key === key);
const itemInCat = (item, key) => { const c = catOf(key); return c ? (item.tags || []).some(t => c.tags.includes(t)) : true; };

function visibleItems() {
  let list = items.slice();
  if (scope === 'mine') list = list.filter(i => isMine(i.id));
  else if (scope === 'liked') list = list.filter(i => likedSet.has(i.id));
  if (activeCat) list = list.filter(i => itemInCat(i, activeCat));
  if (keyword) {
    const k = keyword.toLowerCase();
    list = list.filter(i =>
      (i.title + i.tagline + (i.description || '') + i.author + (i.tags || []).join(',')).toLowerCase().includes(k)
    );
  }
  const remixCount = id => items.filter(x => x.parentId === id).length;
  switch (sortMode) {
    case 'hot': list.sort((a, b) => b.likes - a.likes); break;
    case 'views': list.sort((a, b) => b.views - a.views); break;
    case 'remix': list.sort((a, b) => remixCount(b.id) - remixCount(a.id)); break;
    default: list.sort((a, b) => b.createdAt - a.createdAt);
  }
  return list;
}

/* ---------- 渲染 ---------- */
/* 返回封面内部内容（img 或自动生成的渐变块），不含外层容器 */
function coverInner(item) {
  if (item.cover) {
    return `<img src="${item.cover}" alt="${esc(item.title)} 封面" loading="lazy" draggable="false"/>`;
  }
  const grad = gradientFor(item.title + item.author);
  return `<div class="card__cover-gen" style="background:${grad}">${esc(initials(item.title))}</div>`;
}
/* 卡片封面：多图作品渲染成可轮播的层叠幻灯片 */
function cardCoverInner(item) {
  if (item.gallery && item.gallery.length > 1) {
    return item.gallery.map((s, i) => `<img class="cc-slide${i === 0 ? ' is-on' : ''}" src="${esc(s)}" alt="" loading="lazy" draggable="false"/>`).join('') +
      `<span class="cc-dots">${item.gallery.map((_, i) => `<i class="cc-dot${i === 0 ? ' is-on' : ''}"></i>`).join('')}</span>`;
  }
  return coverInner(item);
}
/* 悬停时循环播放多图封面（渲染后调用） */
function attachHoverPreviews(root) {
  if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.card__cover--multi').forEach(cover => {
    const slides = [...cover.querySelectorAll('.cc-slide')];
    const dots = [...cover.querySelectorAll('.cc-dot')];
    if (slides.length < 2) return;
    let idx = 0, timer = null;
    const show = i => {
      slides[idx].classList.remove('is-on'); if (dots[idx]) dots[idx].classList.remove('is-on');
      idx = i;
      slides[idx].classList.add('is-on'); if (dots[idx]) dots[idx].classList.add('is-on');
    };
    cover.addEventListener('mouseenter', () => { clearInterval(timer); timer = setInterval(() => show((idx + 1) % slides.length), 1050); });
    cover.addEventListener('mouseleave', () => { clearInterval(timer); timer = null; show(0); });
  });
}

function coverHtml(item, cls = 'card__cover') {
  return `<div class="${cls}">${coverInner(item)}</div>`;
}

function renderStats() {
  const el = $('#heroStats');
  if (!el) return;
  const totalLikes = items.reduce((s, i) => s + i.likes, 0);
  const authors = new Set(items.map(i => i.author)).size;
  el.innerHTML = `
    <div class="stat"><b>${items.length}</b><span>件作品</span></div>
    <div class="stat"><b>${authors}</b><span>位创作者</span></div>
    <div class="stat"><b>${totalLikes}</b><span>次点赞</span></div>`;
}

function renderTags() {
  const box = $('#tagFilters');
  box.innerHTML = `<button class="chip ${!activeCat ? 'is-active' : ''}" data-cat="">全部</button>` +
    CATEGORIES.map(c => `<button class="chip ${activeCat === c.key ? 'is-active' : ''}" data-cat="${c.key}">${c.label}</button>`).join('');
}

function cardHtml(item, i = 0, rank = 0) {
  const remixN = items.filter(x => x.parentId === item.id).length;
  const liked = likedSet.has(item.id);
  const parent = item.parentId ? byId(item.parentId) : null;
  const badge = rank
    ? `<span class="card__rank">${rank < 10 ? '0' + rank : rank}</span>`
    : (parent ? `<span class="card__remix-tag">🔀 衍生自 ${esc(parent.title)}</span>` : '');
  const multi = item.gallery && item.gallery.length > 1;
  return `
    <article class="card" data-open="${item.id}" style="animation-delay:${Math.min(i * 45, 360)}ms">
      <div class="card__cover${multi ? ' card__cover--multi' : ''}">
        ${cardCoverInner(item)}
        <span class="card__scrim"></span>
        <span class="card__go" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
        </span>
        ${multi ? `<span class="card__shots" aria-hidden="true">▦ ${item.gallery.length}</span>` : ''}
        ${badge}
        ${isMine(item.id) ? '<span class="card__mine">我的</span>' : ''}
      </div>
      <div class="card__body">
        <h3 class="card__title">${esc(item.title)}</h3>
        <p class="card__tagline">${esc(item.tagline)}</p>
        <div class="card__tags">${(item.tags || []).slice(0, 3).map(t => `<span class="card__tag">#${esc(t)}</span>`).join('')}</div>
        <div class="card__foot">
          <span class="card__author">
            <span class="avatar" style="background:${gradientFor(item.author)}">${esc(initials(item.author))}</span>
            ${esc(item.author)}
          </span>
          <span class="card__metrics">
            <span class="like-btn ${liked ? 'is-liked' : ''}" data-like="${item.id}" title="点赞">❤ ${item.likes}</span>
            <span title="浏览">👁 ${item.views}</span>
            ${remixN ? `<span title="衍生作品">🔀 ${remixN}</span>` : ''}
          </span>
        </div>
      </div>
    </article>`;
}

function renderWall() {
  const list = visibleItems();
  const wall = $('#wall');
  $('#emptyState').hidden = list.length > 0;
  wall.innerHTML = list.map((item, i) => cardHtml(item, i)).join('');
  attachHoverPreviews(wall);
}

/* 互动热度分：点赞 + 评论 + 浏览 + 衍生 */
function hotScore(it) {
  const remixN = items.filter(x => x.parentId === it.id).length;
  return it.likes * 3 + (it.comments ? it.comments.length : 0) * 4 + it.views * 0.15 + remixN * 5;
}

/* 今日精选：只聚焦最热门的一个，做成大横幅 */
function renderFeatured() {
  const section = $('#featuredSection');
  const spot = $('#featuredSpot');
  if (!items.length) { section.hidden = true; return; }
  const top = items.slice().sort((a, b) => hotScore(b) - hotScore(a))[0];
  section.hidden = false;
  const remixN = items.filter(x => x.parentId === top.id).length;
  spot.dataset.open = top.id;
  spot.innerHTML = `
    <div class="spotlight__media card__cover${top.gallery && top.gallery.length > 1 ? ' card__cover--multi' : ''}">
      ${cardCoverInner(top)}
      <span class="card__scrim"></span>
    </div>
    <div class="spotlight__info">
      <span class="spotlight__badge">🔥 今日最值得一看</span>
      <h3 class="spotlight__title">${esc(top.title)}</h3>
      <p class="spotlight__tagline">${esc(top.tagline)}</p>
      <div class="spotlight__tags">${(top.tags || []).slice(0, 4).map(t => `<span class="card__tag">#${esc(t)}</span>`).join('')}</div>
      <div class="spotlight__meta">
        <span class="card__author"><span class="avatar" style="background:${gradientFor(top.author)}">${esc(initials(top.author))}</span> ${esc(top.author)}</span>
        <span>❤ ${top.likes}</span><span>👁 ${top.views}</span>${remixN ? `<span>🔀 ${remixN}</span>` : ''}
      </div>
      <div class="spotlight__actions">
        <button class="btn btn--primary" data-open="${top.id}">查看详情 →</button>
        ${top.demo ? `<a class="btn btn--ghost" href="${esc(top.demo)}" target="_blank" rel="noopener" data-stop>▶ 在线演示</a>` : ''}
      </div>
    </div>
    <div class="spotlight__cone" aria-hidden="true"></div>
    <div class="spotlight__shine" aria-hidden="true"></div>`;
  attachHoverPreviews(spot);
}

/* 本周热门：近 7 天内按互动热度排序 */
function renderHot() {
  const section = $('#hotSection');
  const row = $('#hotRow');
  const weekAgo = Date.now() - 7 * 86400000;
  let pool = items.filter(i => i.createdAt >= weekAgo);
  if (pool.length < 4) pool = items.slice();          // 数据太少则不限时间
  const pick = pool.sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 8);
  if (pick.length < 3) { section.hidden = true; return; }
  section.hidden = false;
  row.innerHTML = pick.map((item, i) => cardHtml(item, i, i + 1)).join('');
  attachHoverPreviews(row);
  updateHotNav();
}

function renderAll() {
  renderStats();
  renderTags();
  renderFeatured();
  renderHot();
  renderWall();
}

/* ---------- 详情弹窗 ---------- */
function openDetail(id) {
  const item = byId(id);
  if (!item) return;
  item.views++;
  save();

  const chain = ancestry(item);
  const children = items.filter(x => x.parentId === id);
  const liked = likedSet.has(id);
  const mine = isMine(id);

  const isRepo = /atomgit\.com|github\.com/.test(item.link || '');
  const shots = (item.gallery && item.gallery.length) ? item.gallery : (item.cover ? [item.cover] : []);
  const galleryHtml = shots.length
    ? `<div class="detail__gallery" id="detailGallery" data-i="0">
         <div class="detail__gallery-track">${shots.map(s => `<div class="dg-slide"><img src="${esc(s)}" alt="项目截图" draggable="false"/></div>`).join('')}</div>
         <span class="detail__cover-fade"></span>
         ${shots.length > 1 ? `<button class="dg-arrow dg-arrow--prev" data-dg="prev" aria-label="上一张">‹</button><button class="dg-arrow dg-arrow--next" data-dg="next" aria-label="下一张">›</button><div class="dg-dots">${shots.map((_, i) => `<button class="dg-dot${i === 0 ? ' is-on' : ''}" data-dg-dot="${i}" aria-label="第 ${i + 1} 张"></button>`).join('')}</div>` : ''}
       </div>`
    : `<div class="detail__cover">${coverInner(item)}<span class="detail__cover-fade"></span></div>`;
  $('#detailBody').innerHTML = `
    ${galleryHtml}
    <div class="detail__inner">
      <div class="detail__head">
        <h2 class="detail__title">${esc(item.title)}</h2>
        <p class="detail__tagline">${esc(item.tagline)}</p>
        <div class="detail__badges">
          <span class="card__author"><span class="avatar" style="background:${gradientFor(item.author)}">${esc(initials(item.author))}</span> ${esc(item.author)}</span>
          <span class="detail__stat">🕒 ${timeAgo(item.createdAt)}</span>
          <span class="detail__stat">❤ ${item.likes}</span>
          <span class="detail__stat">👁 ${item.views}</span>
          ${children.length ? `<span class="detail__stat">🔀 ${children.length} 衍生</span>` : ''}
          ${(item.tags || []).map(t => `<span class="detail__badge">#${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="detail__actions">
        ${item.demo ? `<a class="btn btn--primary" href="${esc(item.demo)}" target="_blank" rel="noopener">▶ 在线演示</a>` : ''}
        ${item.link ? `<a class="btn btn--${item.demo ? 'ghost' : 'primary'}" href="${esc(item.link)}" target="_blank" rel="noopener">${isRepo ? '🔗 查看源码' : '🔗 体验作品'}</a>` : ''}
        <button class="btn btn--ghost" data-like-detail="${item.id}">${liked ? '💖 已赞' : '❤ 点赞'}</button>
        <button class="btn btn--ghost" data-remix="${item.id}">🔀 二次创作</button>
        <button class="btn btn--ghost" data-share="${item.id}">🔗 复制链接</button>
        ${mine ? `<button class="btn btn--ghost" data-edit="${item.id}">✏️ 编辑</button><button class="btn btn--ghost btn--danger" data-delete="${item.id}">🗑️ 删除</button>` : ''}
      </div>
      ${chain.length ? `<div class="lineage-tree"><span class="lineage-tree__label">🌳 传承</span>${chain.map(c => `<b data-open="${c.id}">${esc(c.title)}</b><i>›</i>`).join('')}<em>${esc(item.title)}</em></div>` : ''}
      ${item.description ? `<div class="detail__section"><h3 class="detail__h">项目介绍</h3><p class="detail__desc">${esc(item.description)}</p></div>` : ''}
      ${children.length ? `<div class="lineage-tree lineage-tree--down"><span class="lineage-tree__label">🌱 ${children.length} 个衍生</span>${children.map(c => `<b data-open="${c.id}">${esc(c.title)} · ${esc(c.author)}</b>`).join('')}</div>` : ''}
      <div class="comments">
        <h3>💬 评论 (${item.comments.length})</h3>
        <form class="comment-form" data-comment="${item.id}">
          <input name="author" type="text" placeholder="昵称" maxlength="20" required style="max-width:110px" />
          <input name="text" type="text" placeholder="说点什么…" maxlength="200" required />
          <button class="btn btn--primary" type="submit">发送</button>
        </form>
        <div class="comment-list">
          ${item.comments.length ? item.comments.slice().reverse().map(c => `
            <div class="comment">
              <span class="avatar" style="background:${gradientFor(c.author)}">${esc(initials(c.author))}</span>
              <div class="comment__body"><b>${esc(c.author)}</b><time>${timeAgo(c.at)}</time><p>${esc(c.text)}</p></div>
            </div>`).join('') : '<p class="comment-empty">还没有评论，来抢沙发吧～</p>'}
        </div>
      </div>
    </div>`;
  showModal('#detailModal');
  renderWall(); // 更新浏览数
}

/* ---------- 详情截图画廊 ---------- */
function moveGallery(dir, dotIndex) {
  const g = $('#detailGallery'); if (!g) return;
  const n = g.querySelectorAll('.dg-slide').length;
  let i = parseInt(g.dataset.i || '0', 10);
  if (dir === 'next') i = (i + 1) % n;
  else if (dir === 'prev') i = (i - 1 + n) % n;
  else if (dotIndex != null) i = dotIndex;
  g.dataset.i = i;
  g.querySelector('.detail__gallery-track').style.transform = `translateX(${-i * 100}%)`;
  g.querySelectorAll('.dg-dot').forEach((d, j) => d.classList.toggle('is-on', j === i));
}

/* ---------- 点赞 ---------- */
function toggleLike(id) {
  const item = byId(id);
  if (!item) return;
  if (likedSet.has(id)) { likedSet.delete(id); item.likes = Math.max(0, item.likes - 1); }
  else { likedSet.add(id); item.likes++; }
  saveLiked(); save();
}

/* ---------- 弹窗控制 ---------- */
function showModal(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
function hideModals() { $$('.modal').forEach(m => m.hidden = true); document.body.style.overflow = ''; }

/* ---------- 发布 / 二次创作 / 编辑 ---------- */
let pendingCover = null;
let remixParentId = null;
let editingId = null;

function setCoverPreview(src) {
  if (src) { pendingCover = src; $('#coverPreview').querySelector('img').src = src; $('#coverPreview').hidden = false; $('#uploadHint').hidden = true; }
  else { pendingCover = null; $('#coverPreview').hidden = true; $('#uploadHint').hidden = false; }
}

function openSubmit(parentId = null, editId = null) {
  const form = $('#submitForm');
  form.reset();
  setCoverPreview(null);
  remixParentId = parentId;
  editingId = editId;

  const editItem = editId ? byId(editId) : null;
  const parent = parentId ? byId(parentId) : null;
  $('#remixBanner').hidden = !parent;
  $('#modalTitle').textContent = editItem ? '编辑作品' : parent ? '二次创作' : '发布你的作品';
  $('#submitBtn').textContent = editItem ? '保存修改' : '发布到展示墙';

  if (editItem) {
    form.title.value = editItem.title;
    form.tagline.value = editItem.tagline;
    form.description.value = editItem.description || '';
    form.author.value = editItem.author;
    form.link.value = editItem.link || '';
    form.tags.value = (editItem.tags || []).join(', ');
    if (editItem.cover) setCoverPreview(editItem.cover);
  } else if (parent) {
    $('#remixSource').textContent = parent.title;
    form.title.value = parent.title + '（我的改编）';
    form.tagline.value = parent.tagline;
    form.tags.value = (parent.tags || []).join(', ');
    form.description.value = `灵感来自 @${parent.author} 的《${parent.title}》。\n\n我的改动：`;
  }
  showModal('#submitModal');
  setTimeout(() => form.title.focus(), 50);
}

function handleSubmit(e) {
  e.preventDefault();
  const f = e.target;
  const tags = f.tags.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 5);
  const fields = {
    title: f.title.value.trim(), tagline: f.tagline.value.trim(),
    description: f.description.value.trim(), author: f.author.value.trim(),
    link: f.link.value.trim(), tags, cover: pendingCover,
  };

  if (editingId) {                       // 编辑已有作品
    const it = byId(editingId);
    if (it) Object.assign(it, fields);
    save(); hideModals(); renderAll();
    if (it) openDetail(editingId);
    toast('✅ 已保存修改');
    editingId = null; remixParentId = null;
    return;
  }

  const item = { id: uid(), ...fields, parentId: remixParentId, likes: 0, views: 0, comments: [], createdAt: Date.now() };
  items.push(item);
  ownedSet.add(item.id); saveOwned();
  save();
  hideModals();
  scope = 'all'; activeCat = null; keyword = ''; sortMode = 'new';
  $('#searchInput').value = ''; $('#sortSelect').value = 'new';
  renderAll();
  toast(remixParentId ? '🔀 二次创作已发布！' : '🎉 作品已发布到展示墙！');
  remixParentId = null;
}

/* ---------- 编辑 / 删除 / 分享（仅自己的作品可编辑删除） ---------- */
function deleteWork(id) {
  const it = byId(id);
  if (!it || !isMine(id)) return;
  if (!window.confirm(`确定删除《${it.title}》吗？此操作不可撤销。`)) return;
  // 衍生作品上提一级，保留传承链
  items.forEach(c => { if (c.parentId === id) c.parentId = it.parentId; });
  items = items.filter(x => x.id !== id);
  ownedSet.delete(id); saveOwned(); save();
  hideModals(); renderAll();
  toast('🗑️ 作品已删除');
}

function shareWork(id) {
  const url = location.origin + location.pathname + '#work=' + id;
  const done = () => toast('🔗 链接已复制，可分享给别人');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => prompt('复制此链接分享：', url));
  } else { prompt('复制此链接分享：', url); }
}

/* ---------- 评论 ---------- */
function handleComment(id, f) {
  const item = byId(id);
  if (!item) return;
  item.comments.push({ id: uid(), author: f.author.value.trim(), text: f.text.value.trim(), at: Date.now() });
  save();
  openDetail(id); // 重新渲染
}

/* ---------- 封面上传 ---------- */
function handleCover(file) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('图片请小于 3MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingCover = reader.result;
    const prev = $('#coverPreview');
    prev.querySelector('img').src = pendingCover;
    prev.hidden = false;
    $('#uploadHint').hidden = true;
  };
  reader.readAsDataURL(file);
}

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 2400);
}

/* ---------- 事件绑定 ---------- */
function bind() {
  // 顶部
  $('#openSubmit').addEventListener('click', () => openSubmit());
  $('#heroSubmit').addEventListener('click', () => openSubmit());
  $('#searchInput').addEventListener('input', e => { keyword = e.target.value.trim(); renderWall(); });
  $('#sortSelect').addEventListener('change', e => { sortMode = e.target.value; renderWall(); });

  // 范围筛选：全部 / 我的 / 我赞过
  $('#scopeFilters').addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    scope = btn.dataset.scope || 'all';
    $$('#scopeFilters .chip').forEach(b => b.classList.toggle('is-active', b === btn));
    renderWall();
  });

  // 分类筛选
  $('#tagFilters').addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    activeCat = btn.dataset.cat || null;
    renderTags(); renderWall();
  });
  $('#clearFilters').addEventListener('click', () => {
    activeCat = null; keyword = ''; $('#searchInput').value = '';
    renderTags(); renderWall();
  });

  // 作品墙 / 今日精选 / 本周热门 点击（打开详情 / 点赞）
  const onCardClick = e => {
    if (e.target.closest('a[href], [data-stop]')) return; // 演示等外链正常跳转，不打开详情
    const like = e.target.closest('[data-like]');
    if (like) { e.stopPropagation(); toggleLike(like.dataset.like); renderWall(); renderFeatured(); renderHot(); renderStats(); return; }
    const card = e.target.closest('[data-open]');
    if (card) openDetail(card.dataset.open);
  };
  $('#wall').addEventListener('click', onCardClick);
  $('#featuredSpot').addEventListener('click', onCardClick);
  $('#hotRow').addEventListener('click', onCardClick);

  // 详情弹窗内的交互
  $('#detailBody').addEventListener('click', e => {
    const dg = e.target.closest('[data-dg]');
    if (dg) { moveGallery(dg.dataset.dg); return; }
    const dgDot = e.target.closest('[data-dg-dot]');
    if (dgDot) { moveGallery(null, +dgDot.dataset.dgDot); return; }
    const share = e.target.closest('[data-share]');
    if (share) { shareWork(share.dataset.share); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { hideModals(); openSubmit(null, edit.dataset.edit); return; }
    const del = e.target.closest('[data-delete]');
    if (del) { deleteWork(del.dataset.delete); return; }
    const like = e.target.closest('[data-like-detail]');
    if (like) { toggleLike(like.dataset.likeDetail); openDetail(like.dataset.likeDetail); renderWall(); renderFeatured(); renderHot(); renderStats(); return; }
    const remix = e.target.closest('[data-remix]');
    if (remix) { hideModals(); openSubmit(remix.dataset.remix); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openDetail(open.dataset.open); return; }
  });
  $('#detailBody').addEventListener('submit', e => {
    const cf = e.target.closest('[data-comment]');
    if (cf) { e.preventDefault(); handleComment(cf.dataset.comment, cf); }
  });

  // 发布表单
  $('#submitForm').addEventListener('submit', handleSubmit);
  $('#uploadZone').addEventListener('click', () => $('#coverInput').click());
  $('#coverInput').addEventListener('change', e => handleCover(e.target.files[0]));

  // 关闭弹窗
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) hideModals(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideModals(); });

  // 分享深链：#work=<id> 直接打开作品详情
  const openFromHash = () => { const m = /#work=([\w-]+)/.exec(location.hash); if (m && byId(m[1])) openDetail(m[1]); };
  window.addEventListener('hashchange', openFromHash);
  openFromHash();
}

/* ---------- 改变世界的科技里程碑 ---------- */
const MILESTONES = [
  { year: 1440, title: '古腾堡印刷术', place: '德国', desc: '活字印刷让知识第一次大规模流动，点燃文艺复兴。',
    icon: '<path d="M11 13h26"/><path d="M24 13V7"/><rect x="14" y="17" width="20" height="21" rx="1.5"/><path d="M19 24h10M19 29h10M19 34h6"/>' },
  { year: 1687, title: '万有引力', place: '牛顿', desc: '一颗苹果的启示，写下了整个宇宙的运行法则。',
    icon: '<circle cx="22" cy="27" r="7"/><ellipse cx="22" cy="27" rx="17" ry="7" transform="rotate(-22 22 27)"/><circle cx="35" cy="12" r="3.4" fill="currentColor" stroke="none"/>' },
  { year: 1769, title: '蒸汽机', place: '瓦特', desc: '机器第一次代替人力，开启工业革命的洪流。',
    icon: '<circle cx="19" cy="30" r="7" stroke-dasharray="3 3"/><circle cx="19" cy="30" r="2.6"/><rect x="27" y="26" width="9" height="8" rx="1"/><path d="M36 30h4"/><path d="M17 17c-2-2 2-4 0-6M24 15c-2-2 2-4 0-6"/>' },
  { year: 1876, title: '电话', place: '贝尔', desc: '第一次，人的声音跨越千里瞬间抵达。',
    icon: '<path d="M14 15c0 13 6 19 19 19 3 0 4-2 3-4l-4-4c-1-1-3-1-4 0-3-2-6-5-8-8 1-1 1-3 0-4l-4-4c-2-1-4 0-4 3z"/>' },
  { year: 1879, title: '白炽灯', place: '爱迪生', desc: '人类点亮了黑夜，昼夜的界限从此被改写。',
    icon: '<path d="M24 8a11 11 0 0 0-7 19c1.6 1.4 2 2.6 2 4h10c0-1.4.4-2.6 2-4A11 11 0 0 0 24 8z"/><path d="M19 35h10M21 39h6"/>' },
  { year: 1903, title: '飞机', place: '莱特兄弟', desc: '12 秒的飞行，让人类真正挣脱了地心引力。',
    icon: '<path d="M6 26l36-13-12 30-6-13-18-4z"/><path d="M24 30l6-9"/>' },
  { year: 1947, title: '晶体管', place: '贝尔实验室', desc: '微小的开关，成为整个数字文明的地基。',
    icon: '<rect x="16" y="16" width="16" height="16" rx="2"/><path d="M20 16v-6M28 16v-6M20 32v6M28 32v6M16 22h-6M16 28h-6M32 22h6M32 28h6"/>' },
  { year: 1969, title: '互联网', place: 'ARPANET', desc: '第一次远程连接，让世界开始织成一张网。',
    icon: '<circle cx="24" cy="12" r="3.4"/><circle cx="12" cy="34" r="3.4"/><circle cx="36" cy="34" r="3.4"/><circle cx="24" cy="24" r="3.4"/><path d="M24 15v6M21.6 26.4 14.4 31M26.4 26.4 33.6 31"/>' },
  { year: 1990, title: '万维网', place: 'Tim Berners-Lee', desc: '一个链接连起所有网页，信息从此触手可及。',
    icon: '<circle cx="24" cy="24" r="16"/><ellipse cx="24" cy="24" rx="7" ry="16"/><path d="M8 24h32M11 15h26M11 33h26"/>' },
  { year: 2007, title: '智能手机', place: 'iPhone', desc: '整个世界，被装进了每个人的口袋里。',
    icon: '<rect x="16" y="8" width="16" height="32" rx="3"/><path d="M22 35h4"/>' },
  { year: 2023, title: '生成式 AI', place: 'GPT', desc: '机器开始创造，人与智能进入协作的新纪元。',
    icon: '<path d="M24 10l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path d="M37 30l1.4 3.6L42 35l-3.6 1.4L37 40l-1.4-3.6L32 35z" fill="currentColor" stroke="none"/>' },
  { year: 2026, title: 'AtomCode · 你的灵感', place: '此刻', desc: '下一个改变世界的点子，也许就从你按下发布开始。', now: true,
    icon: '<circle cx="24" cy="24" r="3.4" fill="currentColor" stroke="none"/><ellipse cx="24" cy="24" rx="16" ry="6"/><ellipse cx="24" cy="24" rx="16" ry="6" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="16" ry="6" transform="rotate(120 24 24)"/>' },
  { year: '∞', title: '未来', place: '星辰大海', desc: '越过此刻，驶向尚未被想象的世界——你的下一个作品，也许就是通往未来的船票。', future: true,
    icon: '<path d="M24 6c6 5 8 12 8 19l-3.5 6h-9L16 25c0-7 2-14 8-19z"/><circle cx="24" cy="20" r="3.2"/><path d="M16 27l-6 6 6-1.6zM32 27l6 6-6-1.6z"/><path d="M20 33l4 8 4-8" opacity=".85"/>' },
];

function initMilestones() {
  const nodesBox = $('#tlNodes');
  if (!nodesBox) return;
  const n = MILESTONES.length;
  nodesBox.innerHTML = MILESTONES.map((m, i) =>
    `<button class="node" data-i="${i}" aria-label="${m.year} ${esc(m.title)}"><span class="node__dot"></span><span class="node__yr">${m.year}</span></button>`
  ).join('');
  const nodes = [...nodesBox.children];
  const stage = $('#mstage'), yearEl = $('#mYear');
  const iconEl = $('#mIcon'), titleEl = $('#mTitle'), descEl = $('#mDesc'), walker = $('#tlWalker'), ship = $('#tlShip');
  const bridgeSvg = $('#tlBridge'), timelineEl = $('#timeline'), heroEl = $('#top');

  // —— 桥面几何（自然下垂弧线）——
  const geom = { W: 0, PAD: 8, span: 0, Y_DECK: 24, SAG: 11 };
  let litRect = null;
  function sagAt(x) { const u = Math.min(Math.max((x - geom.PAD) / geom.span, 0), 1); return geom.SAG * 4 * u * (1 - u); }
  function deckY(x) { return geom.Y_DECK + sagAt(x); }
  function xOfFr(fr) { return geom.PAD + fr * geom.span; }
  function xOf(i) { return xOfFr(i / (n - 1)); }
  function buildBridge() {
    if (!bridgeSvg) return;
    const W = Math.round(timelineEl.clientWidth) || 900, H = 48;
    geom.W = W; geom.span = W - geom.PAD * 2;
    bridgeSvg.setAttribute('width', W); bridgeSvg.setAttribute('height', H); bridgeSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const Y_RAIL = 10, Y_DECK = geom.Y_DECK, Y_BOT = 33, S = 44;
    const line = yb => { let d = ''; for (let k = 0; k <= S; k++) { const x = geom.PAD + geom.span * k / S; d += (k ? 'L' : 'M') + x.toFixed(1) + ',' + (yb + sagAt(x)).toFixed(1) + ' '; } return d; };
    let posts = '', knots = '';
    for (let i = 0; i < n; i++) {
      const x = xOf(i), ry = (Y_RAIL + sagAt(x)).toFixed(1), dy = (Y_DECK + sagAt(x)).toFixed(1);
      posts += `<line x1="${x.toFixed(1)}" y1="${ry}" x2="${x.toFixed(1)}" y2="${dy}"/>`;
      // 桥柱与绳索的连接处打绳结
      knots += `<circle class="b-knot" cx="${x.toFixed(1)}" cy="${ry}" r="2.6"/><circle class="b-knot" cx="${x.toFixed(1)}" cy="${dy}" r="2.6"/>`;
    }
    // 桥面木板上的铆钉（每段两颗）
    let rivets = '';
    const RN = (n - 1) * 2;
    for (let r = 0; r <= RN; r++) { const x = geom.PAD + geom.span * (r + 0.5) / RN; if (x < geom.W - geom.PAD) rivets += `<circle class="b-rivet" cx="${x.toFixed(1)}" cy="${(Y_DECK + sagAt(x)).toFixed(1)}" r="1.05"/>`; }
    const grp = () => `<path class="b-rope" d="${line(Y_RAIL)}"/><path class="b-rope" d="${line(Y_BOT)}"/><path class="b-deck" d="${line(Y_DECK)}"/>` +
      `<g class="b-rivets">${rivets}</g><g class="b-posts">${posts}</g><g class="b-knots">${knots}</g>`;
    bridgeSvg.innerHTML = `<defs><clipPath id="litClip"><rect id="litRect" x="0" y="0" width="0" height="${H}"/></clipPath></defs>` +
      `<g class="bridge-wood">${grp()}</g><g class="bridge-lit" clip-path="url(#litClip)">${grp()}</g>`;
    litRect = bridgeSvg.querySelector('#litRect');
  }
  function setLit(x) { if (litRect) litRect.setAttribute('width', Math.max(0, x)); }
  function placeWalker(fr) { const x = xOfFr(fr); walker.style.left = x + 'px'; walker.style.top = (deckY(x) - 36) + 'px'; }
  function hideShip() { if (ship) { ship.style.display = 'none'; ship.classList.remove('is-launch'); } }
  // 星尘粒子（附着在 timeline 坐标系，自动消失）
  function spawnShock(x, y) {
    for (const cls of ['shockwave', 'shockwave shockwave--2']) {
      const s = document.createElement('span');
      s.className = cls;
      s.style.left = x.toFixed(1) + 'px';
      s.style.top = y.toFixed(1) + 'px';
      s.addEventListener('animationend', () => s.remove());
      timelineEl.appendChild(s);
    }
  }
  function spawnDust(x, y) {
    const d = document.createElement('span');
    d.className = 'stardust';
    d.style.left = x.toFixed(1) + 'px';
    d.style.top = y.toFixed(1) + 'px';
    d.style.setProperty('--dx', (Math.random() * 18 - 9).toFixed(0) + 'px');
    d.style.setProperty('--dy', (12 + Math.random() * 22).toFixed(0) + 'px');
    d.style.setProperty('--dur', (0.5 + Math.random() * 0.55).toFixed(2) + 's');
    d.addEventListener('animationend', () => d.remove());
    timelineEl.appendChild(d);
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DWELL = 4200;                 // 每段绳索桥的行走时长
  const WAVE = 1300;                  // 到站挥手庆祝时长
  const MOVES = ['walk', 'walk', 'walk', 'dance', 'spin', 'flip', 'kiss', 'sit', 'heart']; // 行走时随机穿插（走路权重更高）
  const pct = i => (i / (n - 1)) * 100;
  let cur = -1, playing = false, segStart = 0, pausedMs = 0, raf = null, curMove = '', nextMoveAt = 0, launched = false;
  function setMove(m) { if (m === curMove) return; curMove = m; if (walker) walker.className = 'walker' + (m ? ' move-' + m : ''); }

  function setActive(i, celebrate) {
    i = (i + n) % n;
    if (i === cur) return;
    cur = i;
    const m = MILESTONES[i];
    yearEl.textContent = m.year;
    iconEl.innerHTML = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m.icon}</svg>`;
    titleEl.innerHTML = esc(m.title) + (m.place ? ` <span class="mstage__place">${esc(m.place)}</span>` : '');
    descEl.textContent = m.desc;
    stage.classList.toggle('is-now', !!m.now);
    stage.classList.add('is-active-spot');
    const fr = i / (n - 1);
    setLit(xOfFr(fr)); placeWalker(fr);
    nodes.forEach((nd, j) => { nd.classList.toggle('is-active', j === i); nd.classList.toggle('is-done', j < i); });
    // 未来节点：小人悬浮在太空中；其余节点：站在桥面
    const fut = !!m.future;
    if (walker) {
      walker.style.setProperty('--lift', fut ? '-42px' : '0px');
      walker.style.setProperty('--sc', fut ? '0.72' : '1');
      walker.style.setProperty('--sho', fut ? '0' : '1');
    }
    // celebrate：先在站上挥手庆祝 WAVE 毫秒，再出发走向下一站
    segStart = performance.now() + (celebrate ? WAVE : 0);
    pausedMs = 0; nextMoveAt = 0; launched = false;
    if (!reduced) { stage.classList.remove('swap'); void stage.offsetWidth; stage.classList.add('swap'); }
  }
  // 2026 → 未来：飞船停靠，小人走进飞船，一起沿弧线升空驶入太空
  function boardAndLaunch(frac) {
    const parkFr = ((n - 2) + 0.5) / (n - 1);     // 停在最后一段桥的中段
    const xPark = xOfFr(parkFr), yPark = deckY(xPark);
    ship.style.display = 'block';
    ship.style.left = xPark + 'px';
    ship.style.top = (yPark - 44) + 'px';
    if (frac < 0.5) {
      // 小人走向飞船
      ship.classList.remove('is-launch');
      setMove('walk'); walker.style.opacity = '1';
      ship.style.transform = 'translate(-50%, 0) scale(1)';
      ship.style.opacity = '1';
      ship.style.setProperty('--trail', '0px');
    } else if (frac < 0.62) {
      // 蓄力下蹲 + 一顿：船身下沉压扁、微微震动、尾焰渐旺
      walker.style.opacity = '0';
      ship.classList.remove('is-launch');
      const c = Math.min((frac - 0.5) / 0.09, 1);  // 0.09 内蹲到底并保持（"顿"）
      const dip = c * 6, sqX = (1 + c * 0.08).toFixed(3), sqY = (1 - c * 0.16).toFixed(3);
      const jit = (Math.random() * 1.6 - 0.8) * c;
      ship.style.transform = `translate(calc(-50% + ${jit.toFixed(1)}px), ${dip.toFixed(1)}px) scale(${sqX}, ${sqY})`;
      ship.style.opacity = '1';
      ship.style.setProperty('--trail', (c * 8).toFixed(0) + 'px');
      warpTarget = c * 0.12;                        // 轻微预热
    } else {
      // 起飞瞬间"轰"：双环冲击波 + warp 拉满 + 加速升空
      walker.style.opacity = '0';
      ship.classList.add('is-launch');
      if (!launched) { launched = true; spawnShock(xPark, yPark); warpLevel = Math.max(warpLevel, 0.98); }
      const f = (frac - 0.62) / 0.38;              // 0..1 升空进度
      const ease = f * f;                           // 加速
      const up = ease * 182, right = f * 30, s = (1 - f * 0.52).toFixed(3);
      ship.style.transform = `translate(calc(-50% + ${right}px), ${(-up).toFixed(1)}px) rotate(${(f * 9).toFixed(1)}deg) scale(${s})`;
      ship.style.opacity = f > 0.86 ? (1 - (f - 0.86) / 0.14).toFixed(2) : '1';
      ship.style.setProperty('--trail', (22 + ease * 76).toFixed(0) + 'px');
      warpTarget = 0.42 + f * 0.58;
      const ex = xPark + right, ey = (yPark - 44) - up + 40;
      if (Math.random() < 0.75) spawnDust(ex + (Math.random() * 8 - 4), ey);
      if (f > 0.35 && Math.random() < 0.55) spawnDust(ex + (Math.random() * 10 - 5), ey + 4);
    }
  }
  // 逐帧：小人沿吊桥曲线行走，随机切换动作，到站挥手庆祝
  function frame() {
    const now = performance.now();
    let boarding = false;
    warpTarget = 0;
    if (playing && cur >= 0) {
      const elapsed = now - segStart;
      let fr;
      if (elapsed < 0) {                           // 刚到站，庆祝中（挥手）
        fr = cur / (n - 1); setMove('wave');
      } else if (cur >= n - 1) {                    // 终点·未来：太空中悬浮挥手，随后回到起点
        fr = 1; setMove('wave');
        if (elapsed >= DWELL) setActive(0, true);
      } else {
        const frac = Math.min(elapsed / DWELL, 1);
        fr = (cur + frac) / (n - 1);
        if (cur === n - 2) { boarding = true; boardAndLaunch(frac); }
        else if (now >= nextMoveAt) { setMove(MOVES[Math.floor(Math.random() * MOVES.length)]); nextMoveAt = now + 900 + Math.random() * 1500; }
        if (frac >= 1) setActive(cur + 1, true);
      }
      setLit(xOfFr(fr));
      placeWalker(fr);
    } else {
      setMove('');                                // 暂停：站立
    }
    if (!boarding) { hideShip(); if (walker) walker.style.opacity = '1'; }
    warpLevel += (warpTarget - warpLevel) * 0.12;   // 平滑进出 warp
    // warp 时整个第一屏轻微镜头抖动 + 边缘径向速度模糊
    if (heroEl) {
      heroEl.style.setProperty('--warp', warpLevel.toFixed(3));
      if (warpLevel > 0.06) {
        const a = warpLevel * 3.8;
        heroEl.style.transform = `translate(${((Math.random() * 2 - 1) * a).toFixed(1)}px, ${((Math.random() * 2 - 1) * a).toFixed(1)}px) scale(1.014)`;
      } else if (heroEl.style.transform) { heroEl.style.transform = ''; }
    }
    raf = requestAnimationFrame(frame);
  }
  function go(step) { setActive(cur + step, false); play(); }
  function play() { if (reduced) return; if (!playing) { playing = true; segStart = performance.now() - pausedMs; pausedMs = 0; } }
  function stop() { if (playing) { pausedMs = Math.min(performance.now() - segStart, DWELL); playing = false; } }

  nodesBox.addEventListener('click', e => { const b = e.target.closest('.node'); if (b) { setActive(+b.dataset.i); play(); } });
  $('#mPrev').addEventListener('click', () => go(-1));
  $('#mNext').addEventListener('click', () => go(1));
  [stage, $('#timeline')].forEach(el => {
    el.addEventListener('pointerenter', stop);
    el.addEventListener('pointerleave', play);
  });
  // 键盘左右切换（焦点在第一屏时）
  window.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const r = $('#top').getBoundingClientRect();
    if (r.bottom < 120) return; // 已滚过第一屏则不拦截
    if (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    go(e.key === 'ArrowRight' ? 1 : -1);
  });

  buildBridge();
  addEventListener('resize', () => { buildBridge(); const fr = cur >= 0 ? cur / (n - 1) : 0; setLit(xOfFr(fr)); placeWalker(fr); }, { passive: true });

  // 深链：?m=N 定位（静止）；?start=N 从第 N 站开始自动播放（便于预览特定片段）
  const params = new URLSearchParams(location.search);
  const pinned = parseInt(params.get('m'), 10);
  const startAt = parseInt(params.get('start'), 10);
  if (Number.isInteger(startAt) && startAt >= 0 && startAt < n) {
    setActive(startAt); play();
  } else if (Number.isInteger(pinned) && pinned >= 0 && pinned < n) {
    setActive(pinned);
  } else {
    setActive(0);
    play();
  }
  if (!reduced) raf = requestAnimationFrame(frame);
}

/* ---------- 本周热门：拖拽滑动 + 箭头 ---------- */
function updateHotNav() {
  const row = $('#hotRow');
  const prev = $('#hotPrev'), next = $('#hotNext');
  if (!row || !prev) return;
  const max = row.scrollWidth - row.clientWidth - 2;
  prev.disabled = row.scrollLeft <= 2;
  next.disabled = row.scrollLeft >= max;
}
function initHot() {
  const row = $('#hotRow');
  if (!row) return;
  const step = () => Math.max(320, row.clientWidth * 0.8);
  $('#hotPrev').addEventListener('click', () => row.scrollBy({ left: -step(), behavior: 'smooth' }));
  $('#hotNext').addEventListener('click', () => row.scrollBy({ left: step(), behavior: 'smooth' }));
  row.addEventListener('scroll', updateHotNav, { passive: true });
  addEventListener('resize', updateHotNav, { passive: true });

  // 鼠标按住拖拽（仅在真正拖动后才捕获指针，避免吞掉普通点击）
  let down = false, startX = 0, startLeft = 0, moved = 0, dragging = false;
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // 触屏用原生滚动
    down = true; moved = 0; dragging = false; startX = e.clientX; startLeft = row.scrollLeft;
  });
  row.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > 5) { dragging = true; row.classList.add('is-dragging'); try { row.setPointerCapture(e.pointerId); } catch (_) {} }
    if (dragging) { moved += Math.abs(dx); row.scrollLeft = startLeft - dx; }
  });
  const end = () => { down = false; dragging = false; row.classList.remove('is-dragging'); };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  row.addEventListener('pointerleave', () => { if (down && !dragging) down = false; else end(); });
  // 拖动结束后抑制误触发的点击（普通点击 moved 为 0，不受影响）
  row.addEventListener('click', e => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } moved = 0; }, true);
}

/* ---------- CTA 磁吸按钮 ---------- */
function initCta() {
  const magnet = $('#ctaMagnet'), btn = $('#ctaSubmit');
  if (!btn) return;
  btn.addEventListener('click', () => openSubmit());
  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const strength = 0.35;
    magnet.addEventListener('pointermove', e => {
      const r = magnet.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      magnet.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    magnet.addEventListener('pointerleave', () => { magnet.style.transform = ''; });
  }
}

/* ---------- 滚动揭示 ---------- */
function initReveals() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(el => io.observe(el));
}

/* 今日精选滚入时点亮（与第一屏光束呼应） */
function initFeaturedEcho() {
  const sec = $('#featuredSection');
  if (!sec) return;
  if (document.documentElement.classList.contains('flat') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { sec.classList.add('is-lit'); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { sec.classList.add('is-lit'); io.disconnect(); } }), { threshold: 0.08, rootMargin: '0px 0px -12% 0px' });
  io.observe(sec);
}

/* ---------- 顶栏滚动态 ---------- */
function initSticky() {
  const bar = $('#topbar');
  const onScroll = () => bar.classList.toggle('is-stuck', window.scrollY > 20);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- 宇宙流星背景 ---------- */
function initCosmos() {
  const canvas = $('#cosmos');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let w, h, dpr, stars = [], meteors = [], frame = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr;
    h = canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    const count = Math.round((innerWidth * innerHeight) / 9000);
    stars = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * w, y: Math.random() * h,
      r: (Math.random() * 1.3 + 0.3) * dpr,
      base: Math.random() * 0.5 + 0.2,
      tw: Math.random() * 0.02 + 0.004,
      ph: i,
    }));
  }
  function spawnMeteor() {
    const startX = Math.random() * w * 1.1;
    meteors.push({
      x: startX, y: -40 * dpr,
      len: (Math.random() * 90 + 90) * dpr,
      speed: (Math.random() * 5 + 5) * dpr,
      angle: Math.PI * 0.72,
      life: 0, max: Math.random() * 60 + 50,
    });
  }
  function draw() {
    frame++;
    ctx.clearRect(0, 0, w, h);
    // 星星闪烁
    for (const s of stars) {
      const a = s.base + Math.sin(frame * s.tw + s.ph) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,240,235,${Math.max(0.05, a)})`;
      ctx.fill();
    }
    // 偶发流星
    if (frame % 90 === 0 && meteors.length < 3 && Math.sin(frame) >= -2) spawnMeteor();
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.life++;
      m.x -= Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      const tx = m.x + Math.cos(m.angle) * m.len;
      const ty = m.y - Math.sin(m.angle) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      const fade = 1 - m.life / m.max;
      g.addColorStop(0, `rgba(216,255,62,${0.9 * fade})`);
      g.addColorStop(1, 'rgba(216,255,62,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      if (m.life > m.max || m.y > h + 60) meteors.splice(i, 1);
    }
    requestAnimationFrame(draw);
  }
  resize();
  addEventListener('resize', resize, { passive: true });
  draw();
}

/* ---------- 第一屏：流动光速氛围（叠加在星海之上，克制冷调） ---------- */
function initStreaks() {
  const c = $('#heroflow');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 冷调 + 柠檬绿点缀，营造速度与光的流动感，不喧宾夺主
  const COLORS = [[216,255,62], [140,255,214], [150,196,255], [206,224,255], [255,255,255], [180,255,150]];
  const ANG = 0.5; // ≈ 28.6°，左上→右下的流动方向
  const dx = Math.cos(ANG), dy = Math.sin(ANG);
  let w, h, dpr, streaks = [], t = 0;

  function mk() {
    const bright = Math.random() < 0.28; // 少量近白高亮细流光
    return {
      x: Math.random() * w * 1.4 - w * 0.2,
      y: Math.random() * h * 1.4 - h * 0.2,
      len: (Math.random() * 0.55 + 0.35) * Math.max(w, h),
      wdt: (bright ? Math.random() * 1.1 + 0.4 : Math.random() * 2.4 + 0.6) * dpr,
      col: bright ? [255, 255, 255] : COLORS[Math.floor(Math.random() * COLORS.length)],
      a: bright ? Math.random() * 0.22 + 0.1 : Math.random() * 0.14 + 0.03,
      sp: (Math.random() * 0.55 + 0.12) * dpr,
      ph: Math.random() * 6.28,
    };
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = c.width = innerWidth * dpr;
    h = c.height = Math.max(c.clientHeight, 1) * dpr;
    streaks = Array.from({ length: Math.round(innerWidth / 14) + 26 }, mk);
  }
  function render() {
    t += 0.016;
    // 透明底：让下方星海透出，只叠加流光
    ctx.clearRect(0, 0, w, h);
    // 中心极淡柠檬绿光晕，呼应巨型年份
    const bx = w * 0.44, by = h * 0.42;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, h * 0.62);
    rg.addColorStop(0, 'rgba(216,255,62,.07)'); rg.addColorStop(1, 'rgba(216,255,62,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
    // 流光（叠加发光）；warpLevel 升高时，流光被大幅拉长、加速、泛白 → 星星拉成线
    const wl = warpLevel, spMul = 1 + wl * 20, lenMul = 1 + wl * 8, aMul = 1 + wl * 2.6;
    ctx.lineCap = 'round';
    for (const s of streaks) {
      s.x += dx * s.sp * spMul; s.y += dy * s.sp * spMul;
      if (s.x > w * 1.2 || s.y > h * 1.2) { s.x = Math.random() * w * 0.5 - w * 0.3; s.y = Math.random() * h * 0.5 - h * 0.3; }
      const flick = 0.55 + 0.45 * Math.sin(t * 1.1 + s.ph);
      const half = s.len * lenMul / 2;
      const x1 = s.x - dx * half, y1 = s.y - dy * half, x2 = s.x + dx * half, y2 = s.y + dy * half;
      let [r, gg, b] = s.col;
      if (wl > 0.02) { const k = wl * 0.72; r += (255 - r) * k; gg += (255 - gg) * k; b += (255 - b) * k; }
      const a = Math.min(1, s.a * flick * aMul);
      const lg = ctx.createLinearGradient(x1, y1, x2, y2);
      lg.addColorStop(0, `rgba(${r},${gg},${b},0)`);
      lg.addColorStop(.5, `rgba(${r},${gg},${b},${a})`);
      lg.addColorStop(1, `rgba(${r},${gg},${b},0)`);
      ctx.strokeStyle = lg; ctx.lineWidth = s.wdt;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  function loop() { render(); requestAnimationFrame(loop); }
  resize();
  addEventListener('resize', resize, { passive: true });
  if (reduced) render(); else loop();
}

/* ---------- 启动 ---------- */
// 截图辅助模式：?flat=1 时展开所有区块、去除首屏满高，便于整页/分区截图
if (new URLSearchParams(location.search).has('flat')) document.documentElement.classList.add('flat');
load();
mergeCurated();
bind();
renderAll();
initStreaks();
initMilestones();
initHot();
initCta();
initReveals();
initFeaturedEcho();
initSticky();
initCosmos();

// 截图辅助：?only=<featured|wall|cta> 只保留目标区块置顶，便于 headless 分区截图
if (document.documentElement.classList.contains('flat')) {
  const only = new URLSearchParams(location.search).get('only');
  if (only) {
    const keep = { featured: ['featuredSection'], hot: ['hotSection'], wall: ['wallSection', 'wall', 'emptyState'], cta: ['ctaSection'] }[only] || [];
    ['top', 'featuredSection', 'hotSection', 'wallSection', 'wall', 'emptyState', 'ctaSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !keep.includes(id)) el.style.display = 'none';
    });
    if (only !== 'cta') { const f = document.querySelector('.footer'); if (f) f.style.display = 'none'; }
  }
}
