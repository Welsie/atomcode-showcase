const fs = require('fs');
const path = require('path');
const ROOT = '/Users/yuweizhao/atomcode-showcase';

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let css  = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
let js   = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

// 1) 图片 -> data URI 映射
const assetRe = /assets\/covers\/[A-Za-z0-9_.-]+\.png/g;
const assets = Array.from(new Set((js.match(assetRe) || []).concat(css.match(assetRe) || [])));
const map = {};
for (const rel of assets) {
  const buf = fs.readFileSync(path.join(ROOT, rel));
  map[rel] = 'data:image/png;base64,' + buf.toString('base64');
}

// 2) 在 JS / CSS 中替换资源路径；本地 demo 指向线上
for (const rel of assets) {
  js = js.split(rel).join(map[rel]);
  css = css.split(rel).join(map[rel]);
}
js = js.split("demo: 'demos/incoterms/'").join("demo: 'https://welsie.github.io/atomcode-showcase/demos/incoterms/'");

// 3) 单文件专用补丁：策展案例的内联 base64 封面体积大，若整体写入 localStorage
//    会超出 5MB 配额。这里改写 save/load：持久化时把策展封面替换成占位符，
//    加载后再从内存中的 curatedData() 重新挂回。用户自己发布的作品封面不受影响。
const PATCH = [
  ';(function () {',
  '  var _reg = null;',
  '  function reg() {',
  '    if (!_reg) { _reg = {}; try { curatedData().forEach(function (c) { _reg[c.id] = { cover: c.cover, gallery: c.gallery }; }); } catch (e) {} }',
  '    return _reg;',
  '  }',
  '  var PH = "__CURATED_ASSET__";',
  '  save = function () {',
  '    var r = reg();',
  '    var slim = items.map(function (it) {',
  '      if (!r[it.id]) return it;',
  '      var c = Object.assign({}, it); c.cover = PH; c.gallery = PH; return c;',
  '    });',
  '    try { localStorage.setItem(STORE_KEY, JSON.stringify(slim)); } catch (e) {}',
  '  };',
  '  var _load = load;',
  '  load = function () {',
  '    _load();',
  '    var r = reg();',
  '    items.forEach(function (it) { if (r[it.id]) { it.cover = r[it.id].cover; it.gallery = r[it.id].gallery; } });',
  '  };',
  '})();',
  ''
].join('\n');
js = PATCH + js;

// 4) 兜底：避免字符串里出现 </script> 截断标签
js = js.replace(/<\/script>/gi, '<\\/script>');

// 4) 内联 CSS / JS —— 用函数式替换，避免替换串里的 $ 被当成特殊模式
html = html.replace(/<link rel="stylesheet" href="styles\.css[^"]*"\s*\/>/,
  () => '<style>\n' + css + '\n</style>');
html = html.replace(/<script src="app\.js[^"]*"><\/script>/,
  () => '<script>\n' + js + '\n</script>');

// 5) README 作为文件顶部注释
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const banner =
  '<!--\n' +
  '================================================================\n' +
  ' AtomCode 灵感展示墙 - 单文件离线版 (standalone)\n' +
  '================================================================\n' +
  ' 自包含单文件：HTML / CSS / JS / 所有图片素材已全部内联。\n' +
  ' 双击本文件即可在浏览器离线运行，无需服务器、无需联网。\n' +
  ' 你的数据（点赞 / 评论 / 发布的作品）保存在浏览器 localStorage。\n' +
  ' 案例的“在线演示”链接指向公网地址，点击查看需要联网。\n' +
  '\n' +
  ' 生成方式：由多文件源码 (index.html + styles.css + app.js + assets/)\n' +
  ' 经 build-standalone.js 自动内联打包而成。\n' +
  '----------------------------------------------------------------\n' +
  ' 以下为项目 README：\n\n' +
  readme.replace(/--+>/g, '-- >') + '\n' +
  '================================================================\n' +
  '-->\n';
html = html.replace('<!DOCTYPE html>', () => '<!DOCTYPE html>\n' + banner);

const out = path.join(ROOT, 'atomcode-showcase-standalone.html');
fs.writeFileSync(out, html);
const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log('WROTE', out, kb + 'KB', 'assets_inlined=' + assets.length,
  'link_left=' + (/href="styles\.css/.test(html) ? 'YES' : 'no'),
  'script_left=' + (/src="app\.js/.test(html) ? 'YES' : 'no'),
  'assetpath_left=' + (/assets\/covers\//.test(html) ? 'YES' : 'no'));
