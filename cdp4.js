const http=require('http'),net=require('net'),crypto=require('crypto'),{URL}=require('url');
const PORT=9222;
const getJSON=()=>new Promise((res,rej)=>http.get({host:'127.0.0.1',port:PORT,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));
function ws(u){return new Promise((res,rej)=>{const x=new URL(u),k=crypto.randomBytes(16).toString('base64');const s=net.connect(Number(x.port),x.hostname,()=>s.write(`GET ${x.pathname}${x.search} HTTP/1.1\r\nHost: ${x.hostname}:${x.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${k}\r\nSec-WebSocket-Version: 13\r\n\r\n`));let b=Buffer.alloc(0),hs=false;const h={};let id=1;const api={send(m,p){const i=id++;const pl=Buffer.from(JSON.stringify({id:i,method:m,params:p||{}}));const mk=crypto.randomBytes(4);const mm=Buffer.alloc(pl.length);for(let j=0;j<pl.length;j++)mm[j]=pl[j]^mk[j%4];let hd=pl.length<126?Buffer.from([0x81,0x80|pl.length]):Buffer.from([0x81,0x80|126,(pl.length>>8)&255,pl.length&255]);s.write(Buffer.concat([hd,mk,mm]));return new Promise(r=>h[i]=r)}};s.on('data',c=>{b=Buffer.concat([b,c]);if(!hs){const z=b.indexOf('\r\n\r\n');if(z===-1)return;b=b.slice(z+4);hs=true;res(api)}while(b.length>=2){const l0=b[1]&127;let off=2,len=l0;if(l0===126){if(b.length<4)break;len=b.readUInt16BE(2);off=4}else if(l0===127){if(b.length<10)break;len=b.readUInt32BE(6);off=10}if(b.length<off+len)break;const p=b.slice(off,off+len);b=b.slice(off+len);try{const m=JSON.parse(p.toString());if(m.id&&h[m.id]){h[m.id](m);delete h[m.id]}}catch(_){}}});s.on('error',rej)})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const t=(await getJSON()).find(x=>x.type==='page');const c=await ws(t.webSocketDebuggerUrl);await c.send('Runtime.enable',{});
const ev=async e=>{const r=await c.send('Runtime.evaluate',{expression:e,returnByValue:true});return r.result&&r.result.result?r.result.result.value:undefined};
await sleep(2500);
const geo=await ev(`(()=>{const s=document.getElementById('featuredSpot');const r=s.getBoundingClientRect();return JSON.stringify({top:r.top+scrollY,vh:innerHeight})})()`);
const {top,vh}=JSON.parse(geo);
// 1) 卡片只探头（顶部在视口 85% 处，可见约 15%）
await ev(`scrollTo(0, ${Math.round(top - vh*0.85)})`); await sleep(700);
const litPeek=await ev(`document.getElementById('featuredSection').classList.contains('is-lit')`);
// 2) 卡片真正进入（居中）
await ev(`scrollTo(0, ${Math.round(top - vh*0.28)})`); await sleep(700);
const litCenter=await ev(`document.getElementById('featuredSection').classList.contains('is-lit')`);
console.log(JSON.stringify({litWhenJustPeeking:litPeek,litWhenCentered:litCenter}));process.exit(0)})().catch(e=>{console.log('ERR',e&&e.message);process.exit(1)});
