// 极简 CDP 客户端（Node 8，无 ws 依赖）：对页面做一次"原生"点击并检查详情弹窗是否打开
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = 9222;
const TARGET_QUERY = process.argv[2] || '#featuredRow .card'; // 要点击的卡片选择器

function getJSON() {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: '/json/list' }, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

function connectWS(wsUrl) {
  return new Promise((res, rej) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.connect(Number(u.port), u.hostname, () => {
      sock.write(
        `GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.hostname}:${u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let buf = Buffer.alloc(0), handshook = false;
    const handlers = {};
    let nextId = 1;
    const api = {
      send(method, params) {
        const id = nextId++;
        const payload = Buffer.from(JSON.stringify({ id, method, params: params || {} }));
        const mask = crypto.randomBytes(4);
        const masked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
        let header;
        if (payload.length < 126) header = Buffer.from([0x81, 0x80 | payload.length]);
        else header = Buffer.from([0x81, 0x80 | 126, (payload.length >> 8) & 255, payload.length & 255]);
        sock.write(Buffer.concat([header, mask, masked]));
        return new Promise(r => { handlers[id] = r; });
      },
      close() { sock.end(); },
    };
    sock.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (!handshook) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx === -1) return;
        buf = buf.slice(idx + 4); handshook = true; res(api);
      }
      // 解析服务端帧（未掩码）
      while (buf.length >= 2) {
        const len0 = buf[1] & 127; let off = 2, len = len0;
        if (len0 === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
        else if (len0 === 127) { if (buf.length < 10) break; len = buf.readUInt32BE(6); off = 10; }
        if (buf.length < off + len) break;
        const payload = buf.slice(off, off + len); buf = buf.slice(off + len);
        try { const msg = JSON.parse(payload.toString()); if (msg.id && handlers[msg.id]) { handlers[msg.id](msg); delete handlers[msg.id]; } } catch (_) {}
      }
    });
    sock.on('error', rej);
  });
}

(async () => {
  const targets = await getJSON();
  const page = targets.find(t => t.type === 'page');
  const ws = await connectWS(page.webSocketDebuggerUrl);
  const evalJs = async expr => {
    const r = await ws.send('Runtime.evaluate', { expression: expr, returnByValue: true });
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  // 取卡片封面中心坐标
  const rectStr = await evalJs(`(()=>{const c=document.querySelector(${JSON.stringify(TARGET_QUERY)}); if(!c) return ''; const el=c.querySelector('.card__cover')||c; const r=el.getBoundingClientRect(); return JSON.stringify({x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2), t:(c.getAttribute('data-open')||'')});})()`);
  if (!rectStr) { console.log('NO_CARD_FOUND'); ws.close(); return; }
  const { x, y, t } = JSON.parse(rectStr);
  // 关闭可能已打开的弹窗，记录初始态
  const before = await evalJs(`!document.querySelector('#detailModal').hidden`);
  // 原生点击（按下+抬起，同坐标，无拖动）
  await ws.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await ws.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await ws.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await new Promise(r => setTimeout(r, 250));
  const after = await evalJs(`!document.querySelector('#detailModal').hidden`);
  const shownTitle = await evalJs(`(document.querySelector('#detailBody .detail__title')||{}).textContent||''`);
  console.log(JSON.stringify({ card: t, cover_xy: [x, y], modal_before: before, modal_after: after, detail_title: shownTitle }));
  ws.close();
})().catch(e => { console.log('ERR', e && e.message); process.exit(1); });
