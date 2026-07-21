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

/* 精选真实案例（来自 AtomGit，固定 id，避免重复合并） */
const CURATED_KEY = 'atomcode_curated_v1';
function curatedData() {
  const now = Date.now();
  return [
    {
      id: 'c_teris', title: '3D 圆柱俄罗斯方块', tagline: '把经典俄罗斯方块搬到旋转的圆柱体上',
      description: '用 Web 技术实现的 3D 圆柱形俄罗斯方块——方块沿着圆柱曲面下落堆叠，换个维度重温经典，可在线试玩。\n\n仓库：https://atomgit.com/Midora/teris-web',
      author: 'Midora', link: 'https://tetris.atomgit.com/', tags: ['游戏', '3D', '俄罗斯方块'],
      cover: emojiCover('🕹️', 'teris'), parentId: null, likes: 152, views: 1180,
      comments: [{ id: uid(), author: '方块控', text: '圆柱面下落太上头了！', at: now - 5 * 3600000 }], createdAt: now - 26 * 3600000,
    },
    {
      id: 'c_minecraft', title: 'Three.js 我的世界', tagline: '基于 Three.js 的体素世界沙盒',
      description: '用 Three.js 打造的体素沙盒世界，可在浏览器里搭建、破坏、探索方块地形，还原《Minecraft》的核心玩法。\n\n仓库：https://atomgit.com/saulcy/Minecraft',
      author: 'saulcy', link: 'https://atomgit.com/saulcy/Minecraft', tags: ['游戏', '3D', 'Three.js', '沙盒'],
      cover: emojiCover('🧱', 'minecraft'), parentId: null, likes: 233, views: 1620, comments: [], createdAt: now - 14 * 3600000,
    },
    {
      id: 'c_incoterms', title: 'Incoterms 2020 交互查询', tagline: '快速查找与理解国际贸易术语',
      description: '一个零依赖的单页应用，帮外贸从业者快速查询、理解并选择合适的 Incoterms® 2020 国际贸易术语。纯 HTML/CSS/原生 JS 实现，轻量自包含。\n\n仓库：https://atomgit.com/Gary_Yang/Incoterms2020',
      author: 'Gary_Yang', link: 'https://atomgit.com/Gary_Yang/Incoterms2020', tags: ['工具', '外贸', '效率'],
      cover: emojiCover('🚢', 'incoterms'), parentId: null, likes: 74, views: 560, comments: [], createdAt: now - 8 * 3600000,
    },
  ];
}
/* 已打开过网站的访客也补上精选案例（只合并一次，不覆盖用户自己的作品） */
function mergeCurated() {
  if (localStorage.getItem(CURATED_KEY)) return;
  const have = new Set(items.map(i => i.id));
  let added = 0;
  curatedData().forEach(c => { if (!have.has(c.id)) { items.push(c); added++; } });
  localStorage.setItem(CURATED_KEY, '1');
  if (added) save();
}

/* ---------- 视图状态 ---------- */
let activeTag = null;
let sortMode = 'new';
let keyword = '';
let scope = 'all';   // all | mine | liked

function allTags() {
  const set = new Set();
  items.forEach(i => (i.tags || []).forEach(t => set.add(t)));
  return [...set].sort();
}

function visibleItems() {
  let list = items.slice();
  if (scope === 'mine') list = list.filter(i => isMine(i.id));
  else if (scope === 'liked') list = list.filter(i => likedSet.has(i.id));
  if (activeTag) list = list.filter(i => (i.tags || []).includes(activeTag));
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
    return `<img src="${item.cover}" alt="${esc(item.title)} 封面" loading="lazy"/>`;
  }
  const grad = gradientFor(item.title + item.author);
  return `<div class="card__cover-gen" style="background:${grad}">${esc(initials(item.title))}</div>`;
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
  const tags = allTags();
  const box = $('#tagFilters');
  box.innerHTML = `<button class="chip ${!activeTag ? 'is-active' : ''}" data-tag="">全部</button>` +
    tags.map(t => `<button class="chip ${activeTag === t ? 'is-active' : ''}" data-tag="${esc(t)}"># ${esc(t)}</button>`).join('');
}

function cardHtml(item, i = 0, rank = 0) {
  const remixN = items.filter(x => x.parentId === item.id).length;
  const liked = likedSet.has(item.id);
  const parent = item.parentId ? byId(item.parentId) : null;
  const badge = rank
    ? `<span class="card__rank">${rank < 10 ? '0' + rank : rank}</span>`
    : (parent ? `<span class="card__remix-tag">🔀 衍生自 ${esc(parent.title)}</span>` : '');
  return `
    <article class="card" data-open="${item.id}" style="animation-delay:${Math.min(i * 45, 360)}ms">
      <div class="card__cover">
        ${coverInner(item)}
        <span class="card__scrim"></span>
        <span class="card__go" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17"><path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M7 17L17 7M9 7h8v8"/></svg>
        </span>
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
}

/* 今日精选：按热度取前若干，无筛选时展示 */
function renderFeatured() {
  const section = $('#featuredSection');
  const pick = items.slice()
    .sort((a, b) => (b.likes + b.views * 0.2) - (a.likes + a.views * 0.2))
    .slice(0, 6);
  if (pick.length < 3) { section.hidden = true; return; }
  section.hidden = false;
  $('#featuredRow').innerHTML = pick.map((item, i) => cardHtml(item, i, i + 1)).join('');
  updateFeatNav();
}

function renderAll() {
  renderStats();
  renderTags();
  renderFeatured();
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

  $('#detailBody').innerHTML = `
    <div class="detail__cover">${coverInner(item)}</div>
    <div class="detail__inner">
      <h2 class="detail__title">${esc(item.title)}</h2>
      <p class="detail__tagline">${esc(item.tagline)}</p>
      <div class="detail__meta">
        <span class="card__author"><span class="avatar" style="background:${gradientFor(item.author)}">${esc(initials(item.author))}</span> ${esc(item.author)}</span>
        <span>🕒 ${timeAgo(item.createdAt)}</span>
        <span>👁 ${item.views} 浏览</span>
        ${children.length ? `<span>🔀 ${children.length} 个衍生</span>` : ''}
      </div>
      ${chain.length ? `<div class="lineage-tree"><span class="lineage-tree__label">🌳 传承</span>${chain.map(c => `<b data-open="${c.id}">${esc(c.title)}</b><i>›</i>`).join('')}<em>${esc(item.title)}</em></div>` : ''}
      ${item.description ? `<p class="detail__desc">${esc(item.description)}</p>` : ''}
      <div class="detail__tags">${(item.tags || []).map(t => `<span class="card__tag">#${esc(t)}</span>`).join('')}</div>
      <div class="detail__actions">
        <button class="btn btn--primary" data-like-detail="${item.id}">${liked ? '💖 已赞' : '❤ 点赞'} (${item.likes})</button>
        ${item.link ? `<a class="btn btn--ghost" href="${esc(item.link)}" target="_blank" rel="noopener">🔗 体验作品</a>` : ''}
        <button class="btn btn--ghost" data-remix="${item.id}">🔀 二次创作</button>
        <button class="btn btn--ghost" data-share="${item.id}">🔗 复制链接</button>
        ${mine ? `<button class="btn btn--ghost" data-edit="${item.id}">✏️ 编辑</button><button class="btn btn--ghost btn--danger" data-delete="${item.id}">🗑️ 删除</button>` : ''}
      </div>
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
  scope = 'all'; activeTag = null; keyword = ''; sortMode = 'new';
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

  // 标签筛选
  $('#tagFilters').addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    activeTag = btn.dataset.tag || null;
    renderTags(); renderWall();
  });
  $('#clearFilters').addEventListener('click', () => {
    activeTag = null; keyword = ''; $('#searchInput').value = '';
    renderTags(); renderWall();
  });

  // 作品墙 & 今日精选 点击（打开详情 / 点赞）
  const onCardClick = e => {
    const like = e.target.closest('[data-like]');
    if (like) { e.stopPropagation(); toggleLike(like.dataset.like); renderWall(); renderFeatured(); renderStats(); return; }
    const card = e.target.closest('[data-open]');
    if (card) openDetail(card.dataset.open);
  };
  $('#wall').addEventListener('click', onCardClick);
  $('#featuredRow').addEventListener('click', onCardClick);

  // 详情弹窗内的交互
  $('#detailBody').addEventListener('click', e => {
    const share = e.target.closest('[data-share]');
    if (share) { shareWork(share.dataset.share); return; }
    const edit = e.target.closest('[data-edit]');
    if (edit) { hideModals(); openSubmit(null, edit.dataset.edit); return; }
    const del = e.target.closest('[data-delete]');
    if (del) { deleteWork(del.dataset.delete); return; }
    const like = e.target.closest('[data-like-detail]');
    if (like) { toggleLike(like.dataset.likeDetail); openDetail(like.dataset.likeDetail); renderWall(); renderFeatured(); renderStats(); return; }
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
  const stage = $('#mstage'), yearEl = $('#mYear'), idxEl = $('#mIndex');
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
  function placeWalker(fr) { const x = xOfFr(fr); walker.style.left = x + 'px'; walker.style.top = (deckY(x) - 22) + 'px'; }
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
    idxEl.textContent = String(i + 1).padStart(2, '0') + ' / ' + n;
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

/* ---------- 今日精选：拖拽滑动 + 箭头 ---------- */
function updateFeatNav() {
  const row = $('#featuredRow');
  const prev = $('#featPrev'), next = $('#featNext');
  if (!row || !prev) return;
  const max = row.scrollWidth - row.clientWidth - 2;
  prev.disabled = row.scrollLeft <= 2;
  next.disabled = row.scrollLeft >= max;
}
function initFeatured() {
  const row = $('#featuredRow');
  if (!row) return;
  const step = () => Math.max(320, row.clientWidth * 0.8);
  $('#featPrev').addEventListener('click', () => row.scrollBy({ left: -step(), behavior: 'smooth' }));
  $('#featNext').addEventListener('click', () => row.scrollBy({ left: step(), behavior: 'smooth' }));
  row.addEventListener('scroll', updateFeatNav, { passive: true });
  addEventListener('resize', updateFeatNav, { passive: true });

  // 鼠标按住拖拽
  let down = false, startX = 0, startLeft = 0, moved = 0;
  row.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return; // 触屏用原生滚动
    down = true; moved = 0; startX = e.clientX; startLeft = row.scrollLeft;
    row.setPointerCapture(e.pointerId);
  });
  row.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) { row.classList.add('is-dragging'); moved += Math.abs(dx); }
    row.scrollLeft = startLeft - dx;
  });
  const end = () => { down = false; row.classList.remove('is-dragging'); };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
  row.addEventListener('pointerleave', end);
  // 拖动结束后抑制误触发的点击
  row.addEventListener('click', e => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); } }, true);
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
initFeatured();
initCta();
initReveals();
initSticky();
initCosmos();

// 截图辅助：?only=<featured|wall|cta> 只保留目标区块置顶，便于 headless 分区截图
if (document.documentElement.classList.contains('flat')) {
  const only = new URLSearchParams(location.search).get('only');
  if (only) {
    const keep = { featured: ['featuredSection'], wall: ['wallSection', 'wall', 'emptyState'], cta: ['ctaSection'] }[only] || [];
    ['top', 'featuredSection', 'wallSection', 'wall', 'emptyState', 'ctaSection'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !keep.includes(id)) el.style.display = 'none';
    });
    if (only !== 'cta') { const f = document.querySelector('.footer'); if (f) f.style.display = 'none'; }
  }
}
