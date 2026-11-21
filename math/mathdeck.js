/* พื้นฐานคณิตศาสตร์ — slide viewer / presenter / editor for Baan Suay
   deck.json  = slides converted from the brother's Canva file (background image + editable text on a 1440×810 page)
   Firestore  = the brother's edits: doc "order" (chapters + slide order) and one doc per edited/new slide
   window.MathDeck.open({ch, sid, base, canEdit, db, col, toast, onClose}) */
(function(){
'use strict';
const W=1440,H=810;
const FAM={m:"'MD Mont','MD Thai',sans-serif",t:"'MD Thai','MD Mont',sans-serif",n:"'MD Noto','MD Thai',sans-serif",
  s:"'Cambria Math','STIX Two Math','Times New Roman',serif",e:"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",k:"'MD Sniglet','MD Thai',sans-serif"};
const FAMNAME={m:'Garet (Montserrat)',t:'Noto Sans Thai',n:'Noto Sans',s:'Serif',e:'Emoji',k:'Sniglet'};
const COLORS=['#000000','#001a47','#004aad','#1a73e8','#38b6ff','#ff3131','#e8590c','#ffbd59','#00bf63','#7e57c2','#737373','#d9d9d9','#ffffff'];
const PEN=['#ff3131','#004aad','#00bf63','#ffbd59','#000000','#ffffff'];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const nid=()=>'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const r2=v=>Math.round(v*100)/100;

let O=null;          // open() options
let BASE=null;       // deck.json as shipped
let D=null;          // live deck: {ch:[...], s:{sid:slide}}
let ROOT=null,cssDone=false;
const st={i:0,step:0,edit:false,sel:-1,tool:'none',color:'#ff3131',size:4,toc:false,dirty:new Set(),orderDirty:false,undo:[],textEdit:null,unsub:null,saving:0,lastSave:0};
const ink={};         // sid -> strokes (kept while the course is open)

/* ---------- styles ---------- */
function css(base){if(cssDone)return;cssDone=true;
  const f=(fam,file,w,sty,range)=>`@font-face{font-family:'${fam}';src:url(${base}fonts/${file}) format('woff2');font-weight:${w};font-style:${sty||'normal'};font-display:swap${range?';unicode-range:'+range:''}}`;
  const TH='U+0E01-0E5B,U+200C-200D,U+25CC',LA='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const s=document.createElement('style');s.id='mdCss';
  s.textContent=[f('MD Mont','montserrat-latin-400-normal.woff2',400),f('MD Mont','montserrat-latin-700-normal.woff2',700),f('MD Mont','montserrat-latin-800-normal.woff2',800),f('MD Mont','montserrat-latin-400-italic.woff2',400,'italic'),
   f('MD Thai','noto-sans-thai-thai-400-normal.woff2',400,0,TH),f('MD Thai','noto-sans-thai-thai-700-normal.woff2',700,0,TH),f('MD Thai','noto-sans-thai-latin-400-normal.woff2',400,0,LA),f('MD Thai','noto-sans-thai-latin-700-normal.woff2',700,0,LA),
   f('MD Noto','noto-sans-latin-400-normal.woff2',400),f('MD Noto','noto-sans-latin-700-normal.woff2',700),f('MD Sniglet','sniglet-latin-400-normal.woff2',400)].join('\n')+`
.md{position:fixed;inset:0;z-index:900;background:#14171c;color:#fff;display:flex;flex-direction:column;font-family:Sarabun,'Noto Sans Thai',sans-serif;user-select:none;-webkit-user-select:none;touch-action:none}
.md *{box-sizing:border-box}
.md button{font:inherit;color:inherit;cursor:pointer}
.md-top{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#1d2129;border-bottom:1px solid #2b313b;flex:0 0 auto;min-height:52px}
.md-top .ttl{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25}
.md-top .ttl b{font-family:Kanit,sans-serif;font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.md-top .ttl small{color:#9aa4b2;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.md-b{background:#2a303a;border:1px solid #39414d;border-radius:10px;padding:7px 12px;font-family:Kanit,sans-serif;font-size:14px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.md-b:hover{background:#343b47}.md-b.on{background:#3d6df2;border-color:#3d6df2}.md-b.warn{background:#5a2626;border-color:#7a3434}
.md-b svg{width:18px;height:18px;flex:0 0 auto}
.md-b.ic{padding:7px 9px}
.md-main{flex:1;display:flex;min-height:0}
.md-wrap{flex:1;min-width:0;min-height:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.md-box{position:relative;flex:0 0 auto}
.md-stage{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;background:#fff;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,.45)}
.md-slide{position:absolute;inset:0;cursor:default}
.md-bg{position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;-webkit-user-drag:none}
.md-el{position:absolute}
.md-tx{display:flex;flex-direction:column;white-space:pre;outline:none}
.md-tx.al-c{align-items:center}.md-tx.al-r{align-items:flex-end}.md-tx.al-l{align-items:flex-start}
.md-ln{white-space:pre;min-height:1px}
.md-sv{overflow:visible;pointer-events:none}
.md-go{display:block;border-radius:10px;cursor:pointer;transition:background .15s}
.md-go:hover{background:rgba(56,182,255,.16);box-shadow:0 0 0 3px rgba(56,182,255,.45)}
.md-hid{visibility:hidden}
.md-in.fx-fade{animation:mdFade .45s ease both}.md-in.fx-up{animation:mdUp .5s cubic-bezier(.2,.8,.2,1) both}.md-in.fx-zoom{animation:mdZoom .4s ease both}
@keyframes mdFade{from{opacity:0}to{opacity:1}}@keyframes mdUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}@keyframes mdZoom{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:none}}
.md-ink,.md-laser{position:absolute;inset:0;width:${W}px;height:${H}px;pointer-events:none}
.md.tool-pen .md-ink,.md.tool-hl .md-ink,.md.tool-er .md-ink{pointer-events:auto;cursor:crosshair}
.md.tool-laser .md-laser{pointer-events:auto;cursor:none}
.md-bar{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px;background:#1d2129;border-top:1px solid #2b313b;flex:0 0 auto;flex-wrap:wrap}
.md-bar .sep{width:1px;height:26px;background:#39414d;margin:0 4px}
.md-bar .pg{min-width:92px;text-align:center;font-family:Kanit,sans-serif;font-size:14px;color:#c9d1dc}
.md-sw{width:24px;height:24px;border-radius:50%;border:2px solid #39414d;padding:0}
.md-sw.on{border-color:#fff;box-shadow:0 0 0 2px #3d6df2}
.md-prog{height:3px;background:#2b313b;flex:0 0 auto}.md-prog i{display:block;height:100%;background:#38b6ff;transition:width .2s}
.md.fs .md-top,.md.fs .md-prog{display:none}
.md.fs .md-bar{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);border:1px solid #39414d;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.5);transition:opacity .3s;max-width:96vw}
.md.fs.idle .md-bar{opacity:0;pointer-events:none}
.md.fs{background:#000}
.md-toc{position:absolute;inset:0;background:rgba(10,12,16,.72);display:flex;justify-content:center;align-items:flex-start;padding:24px 12px;overflow:auto;z-index:5}
.md-toc .card{background:#1d2129;border:1px solid #2b313b;border-radius:16px;max-width:760px;width:100%;padding:18px 18px 10px}
.md-toc h2{font-family:Kanit,sans-serif;font-weight:600;font-size:22px;margin:0 0 4px}
.md-toc .sub{color:#9aa4b2;font-size:14px;margin:0 0 12px}
.md-toc ol{list-style:none;margin:0;padding:0}
.md-toc li{border-top:1px solid #2b313b}
.md-toc .row{display:flex;align-items:center;gap:10px;padding:10px 4px}
.md-toc .go{flex:1;display:flex;align-items:center;gap:12px;background:none;border:0;text-align:left;padding:0;min-width:0}
.md-toc .no{font-family:Kanit,sans-serif;font-weight:600;font-size:15px;min-width:44px;height:36px;border-radius:10px;background:#2a303a;display:flex;align-items:center;justify-content:center}
.md-toc .cur .no{background:#3d6df2}
.md-toc .nm{display:flex;flex-direction:column;min-width:0}
.md-toc .nm b{font-family:Kanit,sans-serif;font-weight:500;font-size:16px}
.md-toc .nm small{color:#9aa4b2;font-size:14px}
.md-toc .cnt{color:#9aa4b2;font-size:13px;white-space:nowrap}
.md-toc .secs{display:flex;flex-wrap:wrap;gap:6px;padding:0 0 10px 60px}
.md-toc .secs button{background:#2a303a;border:1px solid #39414d;border-radius:8px;padding:4px 10px;font-size:13px}
.md-toc input{background:#14171c;border:1px solid #39414d;border-radius:8px;color:#fff;padding:6px 8px;font:inherit;font-size:14px;min-width:0}
.md-side{width:212px;flex:0 0 auto;background:#1a1e25;border-right:1px solid #2b313b;overflow:auto;padding:10px 8px;display:none}
.md.editing .md-side{display:block}
.md-side h4{font-family:Kanit,sans-serif;font-weight:500;font-size:13px;color:#9aa4b2;margin:4px 4px 8px}
.md-th{position:relative;margin:0 0 10px;cursor:pointer;border-radius:8px;padding:3px;border:2px solid transparent}
.md-th.cur{border-color:#3d6df2}.md-th.drop{border-color:#ffbd59}
.md-th .tb{width:180px;height:101.25px;position:relative;overflow:hidden;border-radius:4px;background:#fff;pointer-events:none}
.md-th .tb .md-stage{transform:scale(.125);box-shadow:none}
.md-th .n{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.65);font-size:11px;border-radius:5px;padding:0 5px;font-family:Kanit,sans-serif}
.md-ed{display:none;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#232833;border-bottom:1px solid #2b313b;flex:0 0 auto}
.md.editing .md-ed{display:flex}
.md-ed label{flex:0 0 auto;white-space:nowrap;font-size:13px;color:#9aa4b2;display:inline-flex;align-items:center;gap:4px}
.md-ed select,.md-ed input[type=number]{flex:0 0 auto;background:#14171c;border:1px solid #39414d;color:#fff;border-radius:8px;padding:5px 6px;font:inherit;font-size:13px}
.md-ed input[type=number]{width:64px}
.md-ed .grp{flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;padding-right:8px;margin-right:2px;border-right:1px solid #39414d}
.md-ed .sv{color:#9aa4b2;font-size:12px;margin-left:auto}
.md.editing .md-el{cursor:move}
.md.editing .md-go{background:rgba(56,182,255,.12);outline:2px dashed rgba(56,182,255,.8)}
.md.editing .md-sv{pointer-events:auto}
.md-selbox{position:absolute;border:2px solid #3d6df2;pointer-events:none;z-index:3;border-radius:2px}
.md-selbox i{position:absolute;right:-9px;bottom:-9px;width:16px;height:16px;background:#3d6df2;border:2px solid #fff;border-radius:4px;pointer-events:auto;cursor:nwse-resize}
.md-selbox .stp{position:absolute;left:-2px;top:-26px;background:#3d6df2;color:#fff;font:600 13px Kanit,sans-serif;padding:1px 7px;border-radius:6px 6px 0 0}
.md.editing .md-hid{visibility:visible;opacity:.35}
.md-tx[contenteditable=true]{cursor:text;outline:2px solid #ffbd59;outline-offset:4px;user-select:text;-webkit-user-select:text}
.md-msg{position:absolute;left:50%;top:70px;transform:translateX(-50%);background:#232833;border:1px solid #39414d;border-radius:12px;padding:8px 14px;font-size:14px;z-index:9;pointer-events:none;transition:opacity .3s}
.md-empty{color:#9aa4b2;font-family:Kanit,sans-serif;font-size:20px}
@media (max-width:700px){.md-b .lb{display:none}.md-top{padding:6px}.md-bar{gap:4px}.md-side{width:150px}.md-th .tb{width:128px;height:72px}.md-th .tb .md-stage{transform:scale(.0889)}}
`;document.head.appendChild(s)}

/* ---------- data ---------- */
const flat=()=>{const out=[];if(!D)return out;D.ch.forEach((c,ci)=>c.sl.forEach((sid,k)=>{if(D.s[sid])out.push({sid,ci,k})}));return out};
const chOf=id=>D.ch.findIndex(c=>c.id===id);
const curSid=()=>{const f=flat();return f[st.i]?f[st.i].sid:null};
const curSlide=()=>D.s[curSid()];
function maxStep(sl){let m=0;(sl&&sl.els||[]).forEach(e=>{if(+e.st>m)m=+e.st});return m}

async function load(){
  if(!BASE){const r=await fetch(O.base+'deck.json',{cache:'no-cache'});BASE=await r.json()}
  D={ch:clone(BASE.ch),s:{}};Object.keys(BASE.s).forEach(k=>D.s[k]=BASE.s[k]);
  applyLocal();
}
/* edits: firestore collection (or localStorage when the site runs without Firebase) */
const LSK='house6.mathdeck';
function lsGet(){try{return JSON.parse(localStorage.getItem(LSK)||'{}')}catch(e){return {}}}
function lsSet(o){try{localStorage.setItem(LSK,JSON.stringify(o))}catch(e){}}
function applyDoc(id,j){if(!j)return;let v;try{v=JSON.parse(j)}catch(e){return}
  if(id==='order'){if(v&&Array.isArray(v.ch))D.ch=v.ch;return}
  if(v&&v.del){delete D.s[id];return}
  D.s[id]=v}
function applyLocal(){if(O.db)return;const o=lsGet();Object.keys(o).forEach(k=>applyDoc(k,o[k].j))}
function listen(){if(!O.db)return;try{
  st.unsub=O.db.collection(O.col).onSnapshot(snap=>{
    const docs={};snap.forEach(d=>docs[d.id]=d.data());
    D.ch=clone(BASE.ch);Object.keys(BASE.s).forEach(k=>D.s[k]=BASE.s[k]);Object.keys(D.s).forEach(k=>{if(!BASE.s[k]&&!docs[k])delete D.s[k]});
    Object.keys(docs).forEach(k=>{if(k!=='order')applyDoc(k,docs[k].j)});if(docs.order)applyDoc('order',docs.order.j);
    if(st.textEdit)return; // don't disturb typing
    paint(false)},err=>console.warn('mathdeck',err))}catch(e){console.warn(e)}}
let saveT=0;
function queueSave(){clearTimeout(saveT);showSave('กำลังบันทึก…');saveT=setTimeout(flush,700)}
async function flush(){
  const ids=[...st.dirty];st.dirty.clear();const ord=st.orderDirty;st.orderDirty=false;
  const put=async(id,obj)=>{const j=JSON.stringify(obj);
    if(O.db)await O.db.collection(O.col).doc(id).set({j,at:Date.now()});
    else{const o=lsGet();o[id]={j,at:Date.now()};lsSet(o)}};
  try{for(const id of ids){if(D.s[id])await put(id,D.s[id]);else if(BASE.s[id])await put(id,{del:1})}
    if(ord)await put('order',{ch:D.ch});
    showSave('บันทึกแล้ว ✓')}catch(e){console.warn(e);showSave('บันทึกไม่สำเร็จ');(O.toast||alert)('บันทึกสไลด์ไม่สำเร็จ ลองใหม่อีกครั้ง')}}
async function resetSlide(sid){
  if(!BASE.s[sid])return;
  if(O.db)await O.db.collection(O.col).doc(sid).delete();else{const o=lsGet();delete o[sid];lsSet(o)}
  D.s[sid]=BASE.s[sid];paint(true);showSave('คืนค่าเดิมแล้ว')}
function showSave(t){const e=ROOT&&ROOT.querySelector('.md-ed .sv');if(e)e.textContent=t}
function touch(sid){if(D.s[sid]===BASE.s[sid])D.s[sid]=clone(BASE.s[sid]);st.dirty.add(sid);queueSave()}
function pushUndo(){const sid=curSid();if(!sid)return;st.undo.push({sid,s:clone(D.s[sid]),ch:clone(D.ch)});if(st.undo.length>60)st.undo.shift()}
function undo(){const u=st.undo.pop();if(!u)return msg('ไม่มีอะไรให้ย้อน');D.s[u.sid]=u.s;D.ch=u.ch;st.dirty.add(u.sid);st.orderDirty=true;queueSave();st.sel=-1;const f=flat();const ix=f.findIndex(x=>x.sid===u.sid);if(ix>=0)st.i=ix;paint(true)}

/* ---------- rendering ---------- */
function runStyle(r){return `font-family:${FAM[r[1]]||FAM.m};font-weight:${r[2]};${r[3]?'font-style:italic;':''}font-size:${r[4]}px;color:${r[5]};${r[6]!=null&&r[6]<1?'opacity:'+r[6]+';':''}${r[7]?'letter-spacing:'+r[7]+'px;':''}`}
function txHTML(e){
  const lines=e.ln.map(ln=>{const r0=ln.r[0]||['', 't',400,0,40,'#000'];
    const st=`line-height:${ln.L}px;font-family:${FAM[r0[1]]||FAM.m};font-size:${r0[4]}px;${ln.m?'margin-top:'+ln.m+'px;':''}${ln.dx&&e.al==='l'?'margin-left:'+ln.dx+'px;':''}`;
    const body=ln.r.map(r=>`<span style="${runStyle(r)}">${esc(r[0])}</span>`).join('');
    return `<div class="md-ln" style="${st}">${ln.r.some(r=>r[0])?body:(ln.r[0]?`<span style="${runStyle(ln.r[0])}"><br></span>`:'<br>')}</div>`}).join('');
  const rot=e.rot?`transform:rotate(${e.rot}deg);transform-origin:0 ${e.oy0||0}px;`:'';
  const wd=e.al==='l'?'':`width:${e.w}px;`;
  return {cls:`md-tx al-${e.al||'l'}`,style:`left:${e.x}px;top:${e.y}px;${wd}${rot}`,inner:lines}}
function elHTML(e,i,step,fx){
  const hid=+e.st>step?' md-hid':'';const anim=fx&&+e.st===step&&step>0?` md-in fx-${fx}`:'';
  if(e.t==='tx'){const h=txHTML(e);return `<div class="md-el ${h.cls}${hid}${anim}" data-i="${i}" style="${h.style}">${h.inner}</div>`}
  if(e.t==='sv')return `<svg class="md-el md-sv${hid}${anim}" data-i="${i}" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px" viewBox="${e.ox} ${e.oy} ${e.vw||e.w} ${e.vh||e.h}" preserveAspectRatio="none"><path d="${esc(e.d)}" fill="none" stroke="${e.c||'#1d1d1f'}" stroke-width="${e.sw||3.5}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  if(e.t==='go')return `<a class="md-el md-go${hid}" data-i="${i}" data-go="${esc(e.to)}" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px" title="ไปที่บทนี้"></a>`;
  if(e.t==='im')return `<img class="md-el md-im${hid}${anim}" data-i="${i}" src="${esc(e.src)}" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px" draggable="false" alt="">`;
  return ''}
function slideHTML(sl,step,opt){
  opt=opt||{};if(!sl)return '';
  const bg=sl.bg?`<img class="md-bg" src="${O.base}bg/${esc(sl.bg)}" draggable="false" alt=""${opt.lazy?' loading="lazy"':''}>`:'';
  const fx=sl.fx&&sl.fx!=='none'?sl.fx:'';
  return bg+(sl.els||[]).map((e,i)=>opt.thumb&&e.t==='go'?'':elHTML(e,i,opt.thumb?99:step,opt.anim?fx:'')).join('')}

const ICON={
 prev:'<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 next:'<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 toc:'<svg viewBox="0 0 24 24"><path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
 fs:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
 ptr:'<svg viewBox="0 0 24 24"><path d="M6 3l13 9-6 1.5L10 20z" fill="currentColor"/></svg>',
 laser:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#ff3131"/><circle cx="12" cy="12" r="8.5" fill="none" stroke="#ff3131" stroke-opacity=".45" stroke-width="2"/></svg>',
 pen:'<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L16.5 4.1a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
 hl:'<svg viewBox="0 0 24 24"><path d="M9 15l-3 3h6zM8.5 14.5l7.8-9.8 3 3-9.8 7.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 21h18" stroke="#ffbd59" stroke-width="3" stroke-linecap="round"/></svg>',
 er:'<svg viewBox="0 0 24 24"><path d="M8.5 20H20M4.6 14.6l8.8-8.8a2 2 0 012.8 0l3.4 3.4a2 2 0 010 2.8L13 18.6a2 2 0 01-1.4.6H9.4a2 2 0 01-1.4-.6l-3.4-3.4a2 2 0 010-2.8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
 clear:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
 edit:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'};

function shell(){
  ROOT=document.createElement('div');ROOT.className='md';ROOT.tabIndex=-1;
  ROOT.innerHTML=`<div class="md-top">
      <button class="md-b ic" data-a="close" title="ปิดสไลด์">${ICON.close}</button>
      <div class="ttl"><b class="t1"></b><small class="t2"></small></div>
      <button class="md-b" data-a="toc" title="สารบัญ (T)">${ICON.toc}<span class="lb">สารบัญ</span></button>
      ${O.canEdit()?`<button class="md-b" data-a="edit" title="แก้ไขสไลด์ (โหมดพี่)">${ICON.edit}<span class="lb">แก้ไข</span></button>`:''}
      <button class="md-b" data-a="fs" title="เต็มจอ (F)">${ICON.fs}<span class="lb">นำเสนอ</span></button></div>
    <div class="md-prog"><i></i></div>
    <div class="md-ed"></div>
    <div class="md-main"><aside class="md-side"></aside><div class="md-wrap"><div class="md-box"><div class="md-stage"><div class="md-slide"></div><canvas class="md-ink"></canvas><canvas class="md-laser"></canvas></div></div></div></div>
    <div class="md-bar">
      <button class="md-b ic" data-a="prev" title="ก่อนหน้า (←)">${ICON.prev}</button><span class="pg"></span><button class="md-b ic" data-a="next" title="ถัดไป (→ / Space)">${ICON.next}</button>
      <span class="sep"></span>
      <button class="md-b ic" data-tool="none" title="ปกติ: แตะสไลด์เพื่อไปหน้าถัดไป (V)">${ICON.ptr}</button>
      <button class="md-b ic" data-tool="laser" title="เลเซอร์ (L)">${ICON.laser}</button>
      <button class="md-b ic" data-tool="pen" title="ปากกา (P)">${ICON.pen}</button>
      <button class="md-b ic" data-tool="hl" title="ไฮไลต์ (H)">${ICON.hl}</button>
      <button class="md-b ic" data-tool="er" title="ยางลบ (E)">${ICON.er}</button>
      <span class="pens"></span>
      <button class="md-b ic" data-a="clear" title="ลบที่เขียนในหน้านี้ (C)">${ICON.clear}</button>
      <button class="md-b ic fsx" data-a="fs" title="ออกจากเต็มจอ" style="display:none">${ICON.fs}</button>
    </div>`;
  document.body.appendChild(ROOT);
  bind();
}

function fit(){if(!ROOT)return;const wrap=ROOT.querySelector('.md-wrap');const pad=ROOT.classList.contains('fs')?0:16;
  const k=Math.max(.05,Math.min((wrap.clientWidth-pad)/W,(wrap.clientHeight-pad)/H));st.k=k;
  const box=ROOT.querySelector('.md-box');box.style.width=W*k+'px';box.style.height=H*k+'px';
  ROOT.querySelector('.md-box>.md-stage').style.transform=`scale(${k})`;sizeCanvas()}
function sizeCanvas(){const dpr=Math.min(2.5,(window.devicePixelRatio||1)*(st.k||1));
  ['.md-ink','.md-laser'].forEach(s=>{const c=ROOT.querySelector(s);const w=Math.round(W*dpr),h=Math.round(H*dpr);if(c.width!==w){c.width=w;c.height=h}});
  st.dpr=dpr;drawInk()}

function paint(anim){
  if(!ROOT)return;const f=flat();if(st.i>=f.length)st.i=Math.max(0,f.length-1);
  const cur=f[st.i];const sl=cur?D.s[cur.sid]:null;const ch=cur?D.ch[cur.ci]:null;
  const ms=maxStep(sl);if(st.step>ms)st.step=ms;
  const sEl=ROOT.querySelector('.md-slide');
  sEl.innerHTML=sl?slideHTML(sl,st.edit?99:st.step,{anim}):`<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center" class="md-empty">ยังไม่มีสไลด์</div>`;
  ROOT.querySelector('.t1').textContent=ch?(ch.no!==''&&ch.no!=null?(isNaN(+ch.no)?ch.no+' · ':'บทที่ '+ch.no+' · '):'')+ch.name:'พื้นฐานคณิตศาสตร์';
  ROOT.querySelector('.t2').textContent=ch?(ch.th||'')+' · หน้า '+(cur.k+1)+'/'+ch.sl.filter(x=>D.s[x]).length:'';
  ROOT.querySelector('.pg').textContent=f.length?(st.i+1)+' / '+f.length+(ms&&!st.edit?' · '+st.step+'/'+ms:''):'0';
  ROOT.querySelector('.md-prog i').style.width=f.length?((st.i+1)/f.length*100)+'%':'0';
  ROOT.classList.toggle('editing',st.edit);
  const eb=ROOT.querySelector('[data-a="edit"]');if(eb)eb.classList.toggle('on',st.edit);
  ROOT.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===st.tool));
  ROOT.className=ROOT.className.replace(/\btool-\S+/g,'').trim()+' tool-'+st.tool;
  ROOT.querySelector('.pens').innerHTML=st.tool==='pen'||st.tool==='hl'?PEN.map(c=>`<button class="md-sw ${st.color===c?'on':''}" data-pen="${c}" style="background:${c}" title="สี"></button>`).join(''):'';
  if(st.edit){paintSel();paintEd();paintSide()}
  if(st.toc)paintToc();else{const t=ROOT.querySelector('.md-toc');if(t)t.remove()}
  drawInk();
  try{O.onPos&&O.onPos(cur&&cur.sid,ch&&ch.id)}catch(e){}
}
function msg(t){if(!ROOT)return;let m=ROOT.querySelector('.md-msg');if(!m){m=document.createElement('div');m.className='md-msg';ROOT.appendChild(m)}
  m.textContent=t;m.style.opacity=1;clearTimeout(m._t);m._t=setTimeout(()=>m.style.opacity=0,1600)}

/* ---------- navigation ---------- */
function go(i,step){const f=flat();if(!f.length)return;st.i=Math.max(0,Math.min(f.length-1,i));st.step=step||0;st.sel=-1;endText();paint(true)}
function next(){const sl=curSlide();if(!st.edit&&st.step<maxStep(sl)){st.step++;paint(true);return}
  const f=flat();if(st.i<f.length-1)go(st.i+1,0);else msg('หน้าสุดท้ายแล้ว')}
function prev(){if(!st.edit&&st.step>0){st.step--;paint(false);return}
  if(st.i>0){const f=flat();const s=D.s[f[st.i-1].sid];go(st.i-1,st.edit?0:maxStep(s))}else msg('หน้าแรกแล้ว')}
function goTarget(to){const f=flat();let ix=-1;
  if(String(to).startsWith('s:'))ix=f.findIndex(x=>x.sid===to.slice(2));
  if(ix<0){const cid=String(to).startsWith('s:')?null:to;const ci=cid?chOf(cid):-1;
    if(ci<0&&String(to).startsWith('s:')){/* a part that was removed: go to its chapter */const sid=to.slice(2);const bc=BASE.ch.find(c=>c.sl.includes(sid));if(bc)return goTarget(bc.id)}
    ix=f.findIndex(x=>x.ci===ci)}
  if(ix<0){msg('บทนี้ยังไม่มีสไลด์');return}
  st.toc=false;go(ix,0)}

/* ---------- table of contents ---------- */
function fmtUpd(iso){try{const d=new Date(iso);return d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'})+' '+d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})+' น.'}catch(e){return iso}}
function paintToc(){let t=ROOT.querySelector('.md-toc');if(!t){t=document.createElement('div');t.className='md-toc';ROOT.querySelector('.md-wrap').appendChild(t)}
  const f=flat();const cur=f[st.i];const ed=st.edit;
  t.innerHTML=`<div class="card"><div style="display:flex;align-items:center;gap:8px"><h2 style="flex:1">สารบัญ · พื้นฐานคณิตศาสตร์</h2><button class="md-b ic" data-a="toc" title="ปิดสารบัญ">${ICON.close}</button></div>
    <p class="sub">แตะชื่อบทเพื่อไปหน้าแรกของบทนั้น${O.updated?' · อัปเดตล่าสุด '+fmtUpd(O.updated):''}${ed?' · โหมดแก้ไข: เปลี่ยนชื่อ เลขบท และลำดับบทได้':''}</p><ol>${D.ch.map((c,ci)=>{const n=c.sl.filter(x=>D.s[x]).length;
      return `<li class="${cur&&cur.ci===ci?'cur':''}"><div class="row">${ed?`<input data-chno="${ci}" value="${esc(c.no)}" style="width:52px;text-align:center"><div class="nm" style="flex:1;gap:4px"><input data-chname="${ci}" value="${esc(c.name)}"><input data-chth="${ci}" value="${esc(c.th||'')}" placeholder="ชื่อภาษาไทย"></div>
        <button class="md-b ic" data-chmv="${ci}:-1" title="เลื่อนขึ้น">↑</button><button class="md-b ic" data-chmv="${ci}:1" title="เลื่อนลง">↓</button><button class="md-b ic" data-chgo="${ci}" title="ไปบทนี้">${ICON.next}</button>${n?'':`<button class="md-b ic warn" data-chdel="${ci}" title="ลบบท (บทว่าง)">${ICON.clear}</button>`}`
        :`<button class="go" data-chgo="${ci}"><span class="no">${esc(c.no)}</span><span class="nm"><b>${esc(c.name)}</b>${c.th?`<small>${esc(c.th)}</small>`:''}</span></button><span class="cnt">${n} หน้า</span>`}</div>
        ${(c.sec||[]).length?`<div class="secs">${c.sec.map(s=>`<button data-to="s:${esc(s.sid)}">${esc(s.n)} ${esc(s.name)}</button>`).join('')}</div>`:''}</li>`}).join('')}</ol>
    ${ed?`<div style="padding:10px 0"><button class="md-b" data-a="chadd">+ เพิ่มบทใหม่ (ต่อท้าย)</button></div>`:''}</div>`}

/* ---------- ink: pen, highlighter, eraser, laser ---------- */
function stagePt(ev){const r=ROOT.querySelector('.md-box>.md-stage').getBoundingClientRect();return [(ev.clientX-r.left)/st.k,(ev.clientY-r.top)/st.k]}
function strokes(){const sid=curSid();return sid?(ink[sid]||(ink[sid]=[])):[]}
function drawInk(){if(!ROOT)return;const c=ROOT.querySelector('.md-ink');const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);
  const d=st.dpr||1;g.setTransform(d,0,0,d,0,0);g.lineCap='round';g.lineJoin='round';
  strokes().forEach(s=>{g.globalAlpha=s.hl?.35:1;g.strokeStyle=s.c;g.lineWidth=s.w;g.beginPath();s.p.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(s.p.length===1)g.lineTo(s.p[0][0]+.1,s.p[0][1]);g.stroke()});g.globalAlpha=1}
let drawing=null;
function inkDown(ev){if(st.tool==='none')return;ev.preventDefault();const p=stagePt(ev);
  if(st.tool==='er'){drawing={er:1};erase(p);return}
  drawing={c:st.color,w:st.tool==='hl'?26:st.size,hl:st.tool==='hl',p:[p]};strokes().push(drawing);drawInk()}
function inkMove(ev){if(!drawing)return;const p=stagePt(ev);if(drawing.er){erase(p);return}
  const l=drawing.p[drawing.p.length-1];if(Math.hypot(p[0]-l[0],p[1]-l[1])<1.5)return;drawing.p.push(p);drawInk()}
function inkUp(){drawing=null}
function erase(p){const a=strokes();for(let i=a.length-1;i>=0;i--){if(a[i].p.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<22))a.splice(i,1)}drawInk()}
let trail=[],laserOn=false,laserRaf=0;
function laserMove(ev){const p=stagePt(ev);trail.push([p[0],p[1],performance.now()]);if(!laserRaf)laserRaf=requestAnimationFrame(laserDraw)}
function laserDraw(){laserRaf=0;const c=ROOT&&ROOT.querySelector('.md-laser');if(!c)return;const g=c.getContext('2d');const d=st.dpr||1;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.setTransform(d,0,0,d,0,0);
  const now=performance.now();trail=trail.filter(t=>now-t[2]<380);
  if(trail.length>1){g.lineCap='round';g.lineJoin='round';for(let i=1;i<trail.length;i++){const a=1-(now-trail[i][2])/380;g.strokeStyle=`rgba(255,49,49,${.55*a})`;g.lineWidth=10*a+2;g.beginPath();g.moveTo(trail[i-1][0],trail[i-1][1]);g.lineTo(trail[i][0],trail[i][1]);g.stroke()}}
  const l=trail[trail.length-1]||st.lastLaser;if(l&&laserOn){st.lastLaser=l;const grd=g.createRadialGradient(l[0],l[1],0,l[0],l[1],22);grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(.18,'rgba(255,60,60,1)');grd.addColorStop(.45,'rgba(255,40,40,.55)');grd.addColorStop(1,'rgba(255,0,0,0)');g.fillStyle=grd;g.beginPath();g.arc(l[0],l[1],22,0,Math.PI*2);g.fill()}
  if(trail.length)laserRaf=requestAnimationFrame(laserDraw)}
function setTool(t){st.tool=t;if(t!=='laser'){laserOn=false;trail=[];laserDraw()}endText();paint(false)}

/* ---------- editing ---------- */
const ed=()=>st.edit&&O.canEdit();
function selEl(){const sl=curSlide();return sl&&st.sel>=0?sl.els[st.sel]:null}
function paintSel(){const box=ROOT.querySelector('.md-selbox');if(box)box.remove();const e=selEl();if(!e)return;
  const dom=ROOT.querySelector(`.md-slide [data-i="${st.sel}"]`);if(!dom)return;
  const b=document.createElement('div');b.className='md-selbox';
  const x=e.x,y=e.y,w=dom.offsetWidth,h=dom.offsetHeight;
  b.style.cssText=`left:${x-4}px;top:${y-4}px;width:${w+8}px;height:${h+8}px`+(e.rot?`;transform:rotate(${e.rot}deg);transform-origin:4px ${4+(e.oy0||0)}px`:'');
  b.innerHTML=(+e.st?`<span class="stp">ลำดับ ${e.st}</span>`:'')+(e.t!=='tx'||e.al!=='l'?'<i data-rs="1"></i>':'');
  ROOT.querySelector('.md-box>.md-stage').appendChild(b)}
function paintEd(){const bar=ROOT.querySelector('.md-ed');const e=selEl();const sl=curSlide();const sid=curSid();
  const chSel=`<select data-f="mvch" title="ย้ายหน้านี้ไปบท">${D.ch.map((c,ci)=>`<option value="${ci}" ${flat()[st.i]&&flat()[st.i].ci===ci?'selected':''}>บท ${esc(c.no)}</option>`).join('')}</select>`;
  let h=`<span class="grp"><button class="md-b" data-a="addtx">+ ข้อความ</button><button class="md-b" data-a="addld" title="วงเล็บตั้งหารยาว">+ หารยาว</button><button class="md-b" data-a="addsd" title="วงเล็บตั้งหารสั้น">+ หารสั้น</button><button class="md-b" data-a="addgo" title="กล่องกดไปบทอื่น">+ ลิงก์ไปบท</button></span>`;
  if(e){const r0=e.t==='tx'?e.ln[0].r[0]:null;
    h+=`<span class="grp">${e.t==='tx'?`<button class="md-b" data-a="txedit" title="แก้ข้อความ (ดับเบิลคลิกที่ข้อความก็ได้)">แก้ข้อความ</button>
      <label>ขนาด<input type="number" data-f="fs" value="${r0?Math.round(r0[4]):''}" min="6" max="300"></label>
      <button class="md-b ic" data-a="bold" title="ตัวหนา"><b>B</b></button>
      <select data-f="al" title="จัดแนว"><option value="l" ${e.al==='l'?'selected':''}>ชิดซ้าย</option><option value="c" ${e.al==='c'?'selected':''}>กึ่งกลาง</option><option value="r" ${e.al==='r'?'selected':''}>ชิดขวา</option></select>
      <span style="display:inline-flex;gap:3px">${COLORS.map(c=>`<button class="md-sw" data-col="${c}" style="background:${c};width:20px;height:20px" title="สีตัวอักษร"></button>`).join('')}</span>`:''}
      ${e.t==='go'?`<label>ไปที่<select data-f="to">${D.ch.map(c=>`<option value="${c.id}" ${e.to===c.id?'selected':''}>บท ${esc(c.no)} ${esc(c.name)}</option>`).join('')}${(D.ch.flatMap(c=>c.sec||[])).map(s=>`<option value="s:${s.sid}" ${e.to==='s:'+s.sid?'selected':''}>${esc(s.n)} ${esc(s.name)}</option>`).join('')}</select></label>`:''}
      ${e.t==='sv'?`<span style="display:inline-flex;gap:3px">${COLORS.slice(0,6).map(c=>`<button class="md-sw" data-col="${c}" style="background:${c};width:20px;height:20px"></button>`).join('')}</span>`:''}
      <label title="ให้ส่วนนี้โผล่ขึ้นมาตอนกดถัดไป">โผล่ลำดับ<select data-f="st">${[0,1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}" ${(+e.st||0)===n?'selected':''}>${n?n:'แสดงตลอด'}</option>`).join('')}</select></label>
      <button class="md-b" data-a="dupel">ทำซ้ำ</button><button class="md-b warn" data-a="delel">ลบ</button></span>`}
  h+=`<span class="grp"><label title="ท่าโผล่ของส่วนที่ตั้งลำดับไว้">ท่าโผล่<select data-f="fx">${[['none','ทันที'],['fade','ค่อยๆ จาง'],['up','เลื่อนขึ้น'],['zoom','ขยาย']].map(([v,n])=>`<option value="${v}" ${(sl&&sl.fx||'none')===v?'selected':''}>${n}</option>`).join('')}</select></label>
     <label>ย้ายไป${chSel}</label><button class="md-b" data-a="undo" title="ย้อนกลับ (Ctrl+Z)">ย้อน</button>${sid&&BASE.s[sid]&&D.s[sid]!==BASE.s[sid]?`<button class="md-b" data-a="reset" title="คืนหน้านี้เป็นแบบในไฟล์">คืนค่าเดิม</button>`:''}</span><span class="sv"></span>`;
  bar.innerHTML=h}
function paintSide(){const side=ROOT.querySelector('.md-side');const f=flat();const cur=f[st.i];if(!cur){side.innerHTML='';return}
  const ch=D.ch[cur.ci];
  side.innerHTML=`<h4>บท ${esc(ch.no)} · ${ch.sl.length} หน้า</h4>`+ch.sl.map((sid,k)=>D.s[sid]?`<div class="md-th ${sid===cur.sid?'cur':''}" draggable="true" data-th="${k}"><span class="n">${k+1}</span><div class="tb"><div class="md-stage">${slideHTML(D.s[sid],99,{thumb:1,lazy:1})}</div></div></div>`:'').join('')
    +`<div style="display:flex;flex-direction:column;gap:6px;padding:4px"><button class="md-b" data-a="newsl">+ หน้าใหม่ต่อจากนี้</button><button class="md-b" data-a="dupsl">ทำซ้ำหน้านี้</button><button class="md-b" data-a="upsl">เลื่อนหน้านี้ขึ้น</button><button class="md-b" data-a="dnsl">เลื่อนหน้านี้ลง</button><button class="md-b warn" data-a="delsl">ลบหน้านี้</button></div>`;
  const c=side.querySelector('.md-th.cur');if(c&&!side._kept)c.scrollIntoView({block:'nearest'});side._kept=false}
function setOrder(fn){pushUndo();fn();st.orderDirty=true;queueSave()}
function moveSlide(d){const f=flat();const cur=f[st.i];const ch=D.ch[cur.ci];const k=cur.k,j=k+d;if(j<0||j>=ch.sl.length)return;
  setOrder(()=>{[ch.sl[k],ch.sl[j]]=[ch.sl[j],ch.sl[k]]});st.i+=d;paint(false)}
function blankSlide(){const tpl=BASE.s.p031||Object.values(BASE.s)[0];
  return {bg:tpl.bg,els:[{t:'tx',x:120,y:24,w:1200,al:'c',ln:[{L:87.5,r:[['หัวข้อ','t',700,0,70,'#001a47']]}]},{t:'tx',x:110,y:220,w:600,al:'l',ln:[{L:55,r:[['พิมพ์เนื้อหาตรงนี้','t',400,0,44,'#000000']]}]}]}}
function insertSlide(sl){const f=flat();const cur=f[st.i];const id=nid();D.s[id]=sl;st.dirty.add(id);
  setOrder(()=>{if(cur)D.ch[cur.ci].sl.splice(cur.k+1,0,id);else D.ch[0].sl.push(id)});go(st.i+(cur?1:0),0)}
function delSlide(){const f=flat();const cur=f[st.i];if(!cur)return;
  if(!confirmTwice('delsl','แตะ "ลบหน้านี้" อีกครั้งเพื่อยืนยัน'))return;
  setOrder(()=>{D.ch[cur.ci].sl.splice(cur.k,1)});st.sel=-1;paint(false);msg('ลบหน้าแล้ว (กดย้อนได้)')}
let askKey='',askT=0;
function confirmTwice(k,t){if(askKey===k&&Date.now()-askT<4000){askKey='';return true}askKey=k;askT=Date.now();msg(t);return false}
function addEl(e){const sid=curSid();if(!sid)return;pushUndo();touch(sid);const sl=D.s[sid];sl.els.push(e);st.sel=sl.els.length-1;paint(false)}
function bracket(kind){const w=260,h=120;const d=kind==='long'?`M7,8 C26,34 26,92 6,${h-6} M7,8 L${w-4},8`:`M6,6 C26,30 26,88 7,${h-8} L${w-4},${h-8}`;
  return {t:'sv',x:600,y:340,w,h,ox:0,oy:0,vw:w,vh:h,d,sw:4,c:'#1d1d1f'}}
function editMut(fn){const sid=curSid();if(!sid)return;pushUndo();touch(sid);fn(D.s[sid]);paint(false)}

/* text editing: contenteditable, then read styles back from the DOM */
function startText(i){const sl=curSlide();if(!sl||!sl.els[i]||sl.els[i].t!=='tx')return;endText();st.sel=i;paint(false);
  const dom=ROOT.querySelector(`.md-slide [data-i="${i}"]`);if(!dom)return;st.textEdit={i,sid:curSid()};
  dom.contentEditable='true';dom.focus();const r=document.createRange();r.selectNodeContents(dom);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);
  try{document.execCommand('styleWithCSS',false,true)}catch(e){}
  const sb=ROOT.querySelector('.md-selbox');if(sb)sb.remove()}
function rgbHex(c){const m=String(c).match(/\d+(\.\d+)?/g);if(!m)return '#000000';return '#'+m.slice(0,3).map(v=>(+v|0).toString(16).padStart(2,'0')).join('')}
function famKey(ff){ff=String(ff);for(const k of ['m','t','n','k','e','s']){const n=FAM[k].split(',')[0];if(ff.indexOf(n.replace(/'/g,''))>=0||ff.indexOf(n)>=0)return k}return 't'}
function readText(dom,old){
  const lines=[];let curLine=null;
  const newLine=()=>{curLine={r:[]};lines.push(curLine)};
  const addRun=(txt,node)=>{const cs=getComputedStyle(node);
    const r=[txt,famKey(cs.fontFamily),+cs.fontWeight>=750?800:+cs.fontWeight>=550?700:400,cs.fontStyle==='italic'?1:0,r2(parseFloat(cs.fontSize)),rgbHex(cs.color)];
    const op=parseFloat(node.style&&node.style.opacity);const ls=parseFloat(cs.letterSpacing)||0;
    if((op&&op<1)||Math.abs(ls)>=.05)r.push(op&&op<1?op:1);if(Math.abs(ls)>=.05)r.push(r2(ls));
    if(!curLine)newLine();const p=curLine.r[curLine.r.length-1];
    if(p&&p.slice(1).join()===r.slice(1).join())p[0]+=txt;else curLine.r.push(r)};
  const walk=(n,isTop)=>{n.childNodes.forEach(c=>{
    if(c.nodeType===3){if(c.data)addRun(c.data.replace(/ /g,' '),c.parentElement)}
    else if(c.nodeType===1){const tag=c.tagName;
      if(tag==='BR'){if(!curLine||curLine.r.length){/* a line break */}if(c.parentElement.classList.contains('md-ln')||c.parentElement.parentElement&&c.parentElement.parentElement.classList.contains('md-ln')){if(curLine&&!curLine.r.length)curLine.r.push([' '.trim(),famKey(getComputedStyle(c.parentElement).fontFamily),400,0,r2(parseFloat(getComputedStyle(c.parentElement).fontSize)),rgbHex(getComputedStyle(c.parentElement).color)])}else newLine();return}
      if(tag==='DIV'||tag==='P'){newLine();walk(c);if(!curLine.r.length){const cs=getComputedStyle(c);curLine.r.push(['',famKey(cs.fontFamily),+cs.fontWeight>=550?700:400,0,r2(parseFloat(cs.fontSize)),rgbHex(cs.color)])}curLine=null;return}
      walk(c)}})};
  walk(dom,true);
  const out=lines.filter((l,ix)=>l.r.length).map((l,ix)=>{const o=old.ln[ix]||old.ln[old.ln.length-1]||{};const S=Math.max(...l.r.map(r=>r[4]));
    const sameSize=o.r&&Math.max(...o.r.map(r=>r[4]))===S;
    const ln={r:l.r,L:sameSize&&o.L?o.L:r2(S*1.25)};if(o.m&&ix>0)ln.m=o.m;if(o.dx&&old.al==='l')ln.dx=o.dx;return ln});
  return out}
function endText(){const te=st.textEdit;if(!te||!ROOT)return;st.textEdit=null;
  const dom=ROOT.querySelector(`.md-slide [data-i="${te.i}"]`);const sl=D.s[te.sid];
  if(dom){dom.contentEditable='false';const old=sl.els[te.i];const ln=readText(dom,old);
    const was=JSON.stringify(old.ln);
    if(!ln.length||!ln.some(l=>l.r.some(r=>r[0].trim()))){pushUndo();touch(te.sid);D.s[te.sid].els.splice(te.i,1);st.sel=-1}
    else if(JSON.stringify(ln)!==was){pushUndo();touch(te.sid);D.s[te.sid].els[te.i].ln=ln}}
  paint(false)}

/* ---------- events ---------- */
let drag=null,idleT=0,swipe=null;
function bind(){
  ROOT.addEventListener('click',ev=>{
    const a=ev.target.closest('[data-a]');const t=ev.target.closest('[data-tool]');const pen=ev.target.closest('[data-pen]');
    if(t){setTool(t.dataset.tool);return}
    if(pen){st.color=pen.dataset.pen;paint(false);return}
    const cg=ev.target.closest('[data-chgo]');if(cg&&!ev.target.closest('input')){goTarget(D.ch[+cg.dataset.chgo].id);return}
    const to=ev.target.closest('[data-to]');if(to){goTarget(to.dataset.to);return}
    const mv=ev.target.closest('[data-chmv]');if(mv){const [ci,d]=mv.dataset.chmv.split(':').map(Number);const j=ci+d;if(j<0||j>=D.ch.length)return;const sid=curSid();setOrder(()=>{[D.ch[ci],D.ch[j]]=[D.ch[j],D.ch[ci]]});const ix=flat().findIndex(x=>x.sid===sid);if(ix>=0)st.i=ix;paint(false);return}
    const cd=ev.target.closest('[data-chdel]');if(cd){const ci=+cd.dataset.chdel;if(D.ch[ci].sl.filter(x=>D.s[x]).length)return;setOrder(()=>D.ch.splice(ci,1));paint(false);return}
    const col=ev.target.closest('[data-col]');
    if(col&&ed()){const c=col.dataset.col;if(st.textEdit){document.execCommand('foreColor',false,c);return}
      editMut(sl=>{const e=sl.els[st.sel];if(!e)return;if(e.t==='tx')e.ln.forEach(l=>l.r.forEach(r=>r[5]=c));else e.c=c});return}
    if(a){const A=a.dataset.a;
      if(A==='close')return close();
      if(A==='next')return next();if(A==='prev')return prev();
      if(A==='toc'){st.toc=!st.toc;paint(false);return}
      if(A==='fs')return toggleFs();
      if(A==='clear'){const s=strokes();s.length=0;drawInk();return}
      if(A==='edit'){if(!O.canEdit())return;st.edit=!st.edit;st.sel=-1;endText();if(st.edit)setTool('none');else paint(false);fit();return}
      if(!ed())return;
      if(A==='addtx')return addEl({t:'tx',x:200,y:300,w:400,al:'l',ln:[{L:52.5,r:[['ข้อความ','t',400,0,42,'#000000']]}]});
      if(A==='addld')return addEl(bracket('long'));if(A==='addsd')return addEl(bracket('short'));
      if(A==='addgo')return addEl({t:'go',x:560,y:330,w:320,h:70,to:D.ch[0].id});
      if(A==='txedit')return startText(st.sel);
      if(A==='bold'){if(st.textEdit){document.execCommand('bold');return}editMut(sl=>{const e=sl.els[st.sel];if(!e||e.t!=='tx')return;const on=e.ln.every(l=>l.r.every(r=>r[2]>=700));e.ln.forEach(l=>l.r.forEach(r=>r[2]=on?400:(r[1]==='m'?800:700)))});return}
      if(A==='dupel')return editMut(sl=>{const e=sl.els[st.sel];if(!e)return;const c=clone(e);c.x+=20;c.y+=20;sl.els.push(c);st.sel=sl.els.length-1});
      if(A==='delel')return editMut(sl=>{if(st.sel>=0)sl.els.splice(st.sel,1);st.sel=-1});
      if(A==='undo')return undo();
      if(A==='reset'){if(confirmTwice('reset','แตะ "คืนค่าเดิม" อีกครั้งเพื่อยืนยัน'))resetSlide(curSid());return}
      if(A==='newsl')return insertSlide(blankSlide());
      if(A==='dupsl'){const s=curSlide();if(s)insertSlide(clone(s));return}
      if(A==='upsl')return moveSlide(-1);if(A==='dnsl')return moveSlide(1);
      if(A==='delsl')return delSlide();
      if(A==='chadd'){setOrder(()=>D.ch.push({id:'c'+nid(),no:String(D.ch.length),name:'บทใหม่',th:'',sl:[]}));paint(false);return}
    }
    const th=ev.target.closest('[data-th]');if(th){const f=flat();const cur=f[st.i];const sid=D.ch[cur.ci].sl[+th.dataset.th];const ix=f.findIndex(x=>x.sid===sid);ROOT.querySelector('.md-side')._kept=true;if(ix>=0)go(ix,0);return}
  });
  ROOT.addEventListener('change',ev=>{const f=ev.target.dataset.f;const t=ev.target;
    if(t.dataset.chname!=null||t.dataset.chno!=null||t.dataset.chth!=null){const ci=+(t.dataset.chname||t.dataset.chno||t.dataset.chth);setOrder(()=>{const c=D.ch[ci];if(t.dataset.chname!=null)c.name=t.value.trim()||c.name;else if(t.dataset.chno!=null)c.no=t.value.trim();else c.th=t.value.trim()});paint(false);return}
    if(!f||!ed())return;
    if(f==='mvch'){const f2=flat();const cur=f2[st.i];const ci=+t.value;if(ci===cur.ci)return;const sid=cur.sid;setOrder(()=>{D.ch[cur.ci].sl.splice(cur.k,1);D.ch[ci].sl.push(sid)});const ix=flat().findIndex(x=>x.sid===sid);go(ix,0);msg('ย้ายไปท้ายบท '+D.ch[ci].no+' แล้ว');return}
    if(f==='fx')return editMut(sl=>{sl.fx=t.value});
    if(f==='st')return editMut(sl=>{const e=sl.els[st.sel];if(e){if(+t.value)e.st=+t.value;else delete e.st}});
    if(f==='to')return editMut(sl=>{const e=sl.els[st.sel];if(e)e.to=t.value});
    if(f==='al')return editMut(sl=>{const e=sl.els[st.sel];if(!e||e.t!=='tx')return;const dom=ROOT.querySelector(`.md-slide [data-i="${st.sel}"]`);const w=dom?dom.offsetWidth:e.w;if(e.al==='l'){e.w=Math.max(e.w||0,w)}e.al=t.value;if(t.value!=='l')e.ln.forEach(l=>delete l.dx)});
    if(f==='fs')return editMut(sl=>{const e=sl.els[st.sel];if(!e||e.t!=='tx')return;const v=+t.value;if(!(v>0))return;const k=v/e.ln[0].r[0][4];e.ln.forEach(l=>{l.r.forEach(r=>r[4]=r2(r[4]*k));l.L=r2(l.L*k);if(l.m)l.m=r2(l.m*k)})});
  });
  /* pointer: slide area */
  const stage=ROOT.querySelector('.md-box>.md-stage');
  ROOT.querySelector('.md-wrap').addEventListener('pointerdown',ev=>{if(!ev.target.closest('.md-box')&&ed()){endText();if(st.sel>=0){st.sel=-1;paint(false)}}});
  stage.addEventListener('pointerdown',ev=>{
    if(st.tool==='laser'){laserOn=true;laserMove(ev);return}
    if(st.tool!=='none'){ev.target.setPointerCapture&&ev.target.setPointerCapture(ev.pointerId);inkDown(ev);return}
    if(ed()){
      if(st.textEdit&&ev.target.closest('[contenteditable=true]'))return;
      const rs=ev.target.closest('[data-rs]');
      if(rs&&selEl()){const e=selEl();pushUndo();touch(curSid());drag={rs:1,x0:ev.clientX,y0:ev.clientY,w:e.w,h:e.h||0};stage.setPointerCapture(ev.pointerId);ev.preventDefault();return}
      endText();
      const el=ev.target.closest('.md-el');
      if(el){st.sel=+el.dataset.i;const e=selEl();paintSel();paintEd();pushUndo();drag={x0:ev.clientX,y0:ev.clientY,ex:e.x,ey:e.y,moved:false,dom:el};stage.setPointerCapture(ev.pointerId);ev.preventDefault()}
      else{st.sel=-1;paintSel();paintEd()}
      return}
    swipe={x:ev.clientX,y:ev.clientY,t:Date.now()}});
  stage.addEventListener('pointermove',ev=>{
    if(st.tool==='laser'){if(laserOn||ev.pointerType==='mouse'){laserOn=true;laserMove(ev)}return}
    if(drawing){inkMove(ev);return}
    if(drag){const dx=(ev.clientX-drag.x0)/st.k,dy=(ev.clientY-drag.y0)/st.k;const e=selEl();if(!e)return;
      if(drag.rs){e.w=Math.max(20,r2(drag.w+dx));if(e.t!=='tx')e.h=Math.max(10,r2(drag.h+dy));paint(false);return}
      if(!drag.moved&&Math.hypot(dx,dy)<2)return;if(!drag.moved){drag.moved=true;touch(curSid())}
      e.x=r2(drag.ex+dx);e.y=r2(drag.ey+dy);drag.dom.style.left=e.x+'px';drag.dom.style.top=e.y+'px';paintSel()}});
  const up=ev=>{
    if(st.tool==='laser'){if(ev.pointerType!=='mouse'){laserOn=false;laserDraw()}return}
    if(drawing){inkUp();return}
    if(drag){const moved=drag.moved||drag.rs;drag=null;if(!moved){st.undo.pop();return}paint(false);return}
    if(swipe&&!st.edit){const dx=ev.clientX-swipe.x,dy=ev.clientY-swipe.y;const sw=swipe;swipe=null;
      const link=ev.target.closest('[data-go]');if(link&&Math.hypot(dx,dy)<10){goTarget(link.dataset.go);return}
      if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){dx<0?next():prev();return}
      if(Math.hypot(dx,dy)<10&&Date.now()-sw.t<600){const r=stage.getBoundingClientRect();(ev.clientX-r.left)<r.width*.25?prev():next()}}};
  stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',()=>{drag=null;drawing=null;swipe=null});
  stage.addEventListener('pointerleave',()=>{if(st.tool==='laser'){laserOn=false;laserDraw()}});
  stage.addEventListener('dblclick',ev=>{if(!ed())return;const el=ev.target.closest('.md-tx')||document.elementsFromPoint(ev.clientX,ev.clientY).map(x=>x.closest&&x.closest('.md-slide .md-tx')).find(Boolean);if(el)startText(+el.dataset.i)});
  stage.addEventListener('paste',ev=>{if(!st.textEdit)return;ev.preventDefault();const t=(ev.clipboardData||window.clipboardData).getData('text/plain');document.execCommand('insertText',false,t)});
  /* drag & drop slide order in the sidebar */
  const side=ROOT.querySelector('.md-side');let dragK=-1;
  side.addEventListener('dragstart',ev=>{const th=ev.target.closest('[data-th]');if(!th)return;dragK=+th.dataset.th;ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain',String(dragK))}catch(e){}});
  side.addEventListener('dragover',ev=>{const th=ev.target.closest('[data-th]');if(dragK<0||!th)return;ev.preventDefault();side.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));th.classList.add('drop')});
  side.addEventListener('drop',ev=>{const th=ev.target.closest('[data-th]');if(dragK<0||!th)return;ev.preventDefault();const to=+th.dataset.th;const f=flat();const cur=f[st.i];const ch=D.ch[cur.ci];const sid=ch.sl[dragK];
    if(to!==dragK){setOrder(()=>{ch.sl.splice(dragK,1);ch.sl.splice(to,0,sid)})}dragK=-1;const ix=flat().findIndex(x=>x.sid===sid);side._kept=true;go(ix,0)});
  side.addEventListener('dragend',()=>{dragK=-1;side.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'))});
  ROOT.addEventListener('pointermove',()=>{if(!ROOT.classList.contains('fs'))return;ROOT.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>ROOT&&ROOT.classList.add('idle'),2600)});
  window.addEventListener('resize',fit);document.addEventListener('keydown',onKey,true);document.addEventListener('fullscreenchange',onFs);document.addEventListener('webkitfullscreenchange',onFs);
}
function onKey(ev){if(!ROOT)return;
  const tag=(ev.target.tagName||'').toLowerCase();
  if(st.textEdit){if((ev.metaKey||ev.ctrlKey)&&ev.key==='Enter'){ev.preventDefault();endText()}return}
  if(tag==='input'||tag==='select'||tag==='textarea')return;
  const k=ev.key;const mod=ev.metaKey||ev.ctrlKey;
  if(mod&&(k==='z'||k==='Z')&&ed()){ev.preventDefault();undo();return}
  if(ed()&&st.sel>=0){
    if(k==='Delete'||k==='Backspace'){ev.preventDefault();editMut(sl=>{sl.els.splice(st.sel,1);st.sel=-1});return}
    const mv={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];
    if(mv){ev.preventDefault();const n=ev.shiftKey?10:1;editMut(sl=>{const e=sl.els[st.sel];e.x=r2(e.x+mv[0]*n);e.y=r2(e.y+mv[1]*n)});return}
    if(k==='Enter'){const e=selEl();if(e&&e.t==='tx'){ev.preventDefault();startText(st.sel)}return}
    if(mod&&(k==='d'||k==='D')){ev.preventDefault();editMut(sl=>{const c=clone(sl.els[st.sel]);c.x+=20;c.y+=20;sl.els.push(c);st.sel=sl.els.length-1});return}}
  if(mod||ev.altKey)return;
  if(k==='ArrowRight'||k==='PageDown'||k===' '||k==='ArrowDown'){ev.preventDefault();next();return}
  if(k==='ArrowLeft'||k==='PageUp'||k==='ArrowUp'){ev.preventDefault();prev();return}
  if(k==='Home'){ev.preventDefault();go(0,0);return}if(k==='End'){ev.preventDefault();go(flat().length-1,0);return}
  const map={l:'laser',p:'pen',h:'hl',e:'er',v:'none'};const kk=k.toLowerCase();
  if(map[kk]){ev.preventDefault();setTool(st.tool===map[kk]?'none':map[kk]);return}
  if(kk==='c'){strokes().length=0;drawInk();return}
  if(kk==='f'){toggleFs();return}
  if(kk==='t'){st.toc=!st.toc;paint(false);return}
  if(k==='Escape'){if(st.toc){st.toc=false;paint(false)}else if(st.tool!=='none')setTool('none');return}
}
function toggleFs(){const on=ROOT.classList.contains('fs');
  if(!on){ROOT.classList.add('fs');const r=ROOT.requestFullscreen||ROOT.webkitRequestFullscreen;try{r&&r.call(ROOT).catch&&r.call(ROOT).catch(()=>{})}catch(e){}if(st.edit){st.edit=false;st.sel=-1;endText()}}
  else{ROOT.classList.remove('fs','idle');const x=document.exitFullscreen||document.webkitExitFullscreen;try{if(document.fullscreenElement||document.webkitFullscreenElement)x.call(document)}catch(e){}}
  ROOT.querySelector('.fsx').style.display=ROOT.classList.contains('fs')?'':'none';paint(false);setTimeout(fit,60)}
function onFs(){if(!ROOT)return;if(!(document.fullscreenElement||document.webkitFullscreenElement)&&ROOT.classList.contains('fs')){ROOT.classList.remove('fs','idle');ROOT.querySelector('.fsx').style.display='none';setTimeout(fit,60)}}
function close(){endText();if(st.dirty.size||st.orderDirty)flush();
  if(st.unsub)try{st.unsub()}catch(e){}st.unsub=null;
  try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}
  document.removeEventListener('keydown',onKey,true);window.removeEventListener('resize',fit);document.removeEventListener('fullscreenchange',onFs);document.removeEventListener('webkitfullscreenchange',onFs);
  if(ROOT)ROOT.remove();ROOT=null;st.edit=false;st.toc=false;st.sel=-1;st.tool='none';
  try{O.onClose&&O.onClose()}catch(e){}}

async function open(opts){
  O=Object.assign({base:'math/',col:'mathdeck',canEdit:()=>false,db:null},opts||{});
  css(O.base);if(ROOT)close();
  shell();fit();
  ROOT.querySelector('.md-slide').innerHTML='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#eff5fb;color:#001a47;font:500 34px Kanit,sans-serif">กำลังโหลดสไลด์…</div>';
  try{await load()}catch(e){ROOT.querySelector('.md-slide').innerHTML='<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;color:#b00;font:500 30px Kanit,sans-serif">โหลดสไลด์ไม่ได้ ลองเปิดใหม่อีกครั้ง</div>';return}
  st.i=0;st.step=0;
  if(O.sid){const ix=flat().findIndex(x=>x.sid===O.sid);if(ix>=0)st.i=ix}
  else if(O.ch){const ci=chOf(O.ch);const ix=flat().findIndex(x=>x.ci===ci);if(ix>=0)st.i=ix}
  listen();paint(true);ROOT.focus()}

/* chapters list for the classroom (names come from the deck so renaming in the editor shows up there too) */
async function chapters(base){if(!BASE){const r=await fetch((base||'math/')+'deck.json',{cache:'no-cache'});BASE=await r.json()}return BASE.ch.map(c=>({id:c.id,no:c.no,name:c.name,th:c.th,n:c.sl.length}))}
window.MathDeck={open,close,chapters,_render:(sl,base)=>{O=O||{base:base||'math/',canEdit:()=>false};css(O.base);return slideHTML(sl,99,{})}};
})();
