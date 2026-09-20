/* ============================================================
   Rivalis · ui.js
   SÓ TELA. Este arquivo desenha o que recebe e envia o que o dedo
   toca. Ele não guarda papel secreto de ninguém, não decide nada e
   não valida regra: isso é trabalho do rivalis-core.js, que roda no
   aparelho do mestre.

   No celular de um jogador, o que existe aqui é apenas a visão que o
   mestre mandou para ele: os outros jogadores aparecem por um
   identificador público (pid), sem papel e sem voto secreto.
   ============================================================ */
'use strict';

const $app = document.getElementById('app');
const Q = new URLSearchParams(location.search);
const LOCAL = Q.has('local');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- guardados no aparelho ---------- */
function mkStore(kind){ return {
  get(k){ try{ return JSON.parse(window[kind].getItem(k)); }catch(e){ return null; } },
  set(k,v){ try{ window[kind].setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ window[kind].removeItem(k); }catch(e){} } }; }
const store  = mkStore('localStorage');
const pstore = LOCAL ? mkStore('sessionStorage') : store;   // no teste local cada aba é um jogador

/* ---------- personagem ---------- */
const HAS_AV = typeof Avatar !== 'undefined';
const AVKEY = 'rivalis-avatar';
const avLoad = () => { try{ return (LOCAL ? sessionStorage.getItem(AVKEY) : null) || localStorage.getItem(AVKEY) || ''; }catch(e){ return ''; } };
const avSave = c => { try{ (LOCAL ? sessionStorage : localStorage).setItem(AVKEY, c); }catch(e){} };
const avValid = c => typeof c === 'string' && /^\d{1,2}(-\d{1,2}){8}$/.test(c);
function avHTML(code, size){
  if(!HAS_AV || !avValid(code)) return '';
  try{ return `<span class="av" style="width:${size}px;height:${size}px">${Avatar.svg(Avatar.parse(code), {size})}</span>`; }
  catch(e){ return ''; }
}
const AV = { code:'', tab:'face', open:false };
if(HAS_AV) AV.code = avValid(avLoad()) ? avLoad() : Avatar.code(Avatar.random());

function avEditorHTML(){
  if(!HAS_AV) return '<p class="small mute">avatar.js não foi encontrado: coloque o arquivo na mesma pasta do jogo.</p>';
  const cfg = Avatar.parse(AV.code), part = Avatar.PARTS[AV.tab];
  const opts = part.color
    ? part.list.map((o,i)=>`<button class="chip ${cfg[AV.tab]===i?'on':''}" data-a="a-pick" data-v="${i}" style="background:${o.c};color:#0b0d12;border-color:#00000055;font-weight:600">${esc(o.name)}</button>`).join('')
    : part.list.map((o,i)=>`<button class="avopt ${cfg[AV.tab]===i?'on':''}" data-a="a-pick" data-v="${i}">${Avatar.svg(Object.assign({}, cfg, {[AV.tab]:i}), {size:52})}<span>${esc(o.name)}</span></button>`).join('');
  return `<div class="card" style="margin:10px 0 0">
    <div class="avtabs">${Avatar.KEYS.map(k=>`<button class="chip ${k===AV.tab?'on':''}" data-a="a-tab" data-v="${k}">${esc(Avatar.PARTS[k].name)}</button>`).join('')}</div>
    <div class="${part.color?'row':'avgrid'}" style="margin-top:10px">${opts}</div></div>`;
}
function avPickerHTML(label){
  if(!HAS_AV) return '';
  return `<div><label>${esc(label)}</label>
    <div class="row" style="align-items:center">
      ${avHTML(AV.code, 76)}
      <div class="col" style="flex:1;min-width:150px">
        <button class="chip" data-a="a-rnd">🎲 Sortear personagem</button>
        <button class="chip ${AV.open?'on':''}" data-a="a-open">${AV.open?'Pronto':'✏️ Personalizar'}</button>
      </div>
    </div>
    ${AV.open ? avEditorHTML() : ''}</div>`;
}
const avAct = {
  tab(v){ AV.tab = v; render(); },
  open(){ AV.open = !AV.open; render(); },
  rnd(){ setAvatar(Avatar.code(Avatar.random())); },
  pick(v){ const cfg = Avatar.parse(AV.code); cfg[AV.tab] = +v; setAvatar(Avatar.code(cfg)); },
};
function setAvatar(code){
  AV.code = code; avSave(code);
  if(mode === 'player' && cnet) cnet.send({t:'avatar', av:code});
  render();
}

/* ================== MESTRE (só tela; as regras estão no core) ================== */
let mode = 'start';
let hnet = null;
const hostUI = { showRoles:false, status:'', ready:false };

function startHost(code, saved){
  if(saved) Game.load(saved); else Game.create(code);
  mode = 'host';
  history.replaceState(null, '', '?mestre=' + Game.code + (LOCAL ? '&local=1' : ''));
  hnet = Net.host(Game.code, {
    onMsg:  (key, m) => Game.input(key, m),
    onLeave:(key)    => Game.dropConn(key),
    onReady(){ hostUI.ready = true; hostUI.status = ''; render(); },
    onError(msg){ hostUI.status = msg; render(); },
  });
  Game.init({ send:(k,m) => hnet.send(k,m), onChange: render });
  render();
  keepAwake();
}
let wakeLock = null;
async function keepAwake(){ try{ if('wakeLock' in navigator && !document.hidden) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){} }
document.addEventListener('visibilitychange', () => { if(mode === 'host' && !document.hidden) keepAwake(); });

const hostAct = {
  start(){ Game.act.start(); },
  team(pid){ Game.act.team(pid); },
  confirm(){ Game.act.confirm(); },
  after(){ Game.act.after(); },
  reveal(){ Game.act.reveal(); },
  next(){ Game.act.next(); },
  again(){ Game.act.again(); },
  kick(pid){ Game.act.kick(pid); },
  votetoggle(){ Game.act.votetoggle(); },
  roles(){ hostUI.showRoles = !hostUI.showRoles; render(); },
  lore(){ openLore(); },
  close(){
    if(!confirm('Encerrar a sala? Todos serão desconectados.')) return;
    Game.discard(); location.href = location.pathname + (LOCAL ? '?local=1' : '');
  },
};

/* ---------- Cenas (cena.js) ---------- */
const HAS_CENA = typeof Cena !== 'undefined';
function cenaHTML(code, opt){
  if(!HAS_CENA || !code) return '';
  try{ return `<div class="scene">${Cena.svg(Cena.parse(code), {w:(opt&&opt.w)||640})}</div>`; }
  catch(e){ return ''; }
}

/* ---------- Editor da história (só o mestre) ---------- */
// Fica numa tela própria para o texto digitado não se perder a cada redesenho.
let LORE = null;
let LOREUI = { scene:null };      // qual cena está aberta para edição: 0..4 ou 'cover'
const nl2br = t => esc(t).replace(/\n/g, '<br>');
const getScene = k => k === 'cover' ? LORE.cover : LORE.missions[k].scene;
const setScene = (k, v) => { if(k === 'cover') LORE.cover = v; else LORE.missions[k].scene = v; };
function scenePanelHTML(k){
  if(!HAS_CENA) return '<p class="small mute">cena.js não encontrado: coloque o arquivo na mesma pasta.</p>';
  const cur = getScene(k);
  const c = cur ? Cena.parse(cur) : null;
  if(LOREUI.scene !== k){
    return `<div class="row" style="align-items:center">
      ${cur ? `<div style="flex:1;min-width:160px">${cenaHTML(cur,{w:320})}</div>` : '<span class="small mute" style="flex:1">Sem cena</span>'}
      <button class="chip" data-a="l-scene" data-v="${k}">🎬 ${cur ? 'Trocar cena' : 'Escolher cena'}</button>
      ${cur ? `<button class="chip ghost" data-a="l-scenedel" data-v="${k}">Remover</button>` : ''}
    </div>`;
  }
  const cfg = c || Cena.normalize({});
  const chips = (list, key, cur2) => Object.entries(list)
    .map(([id,o]) => `<button class="chip ${cur2===id?'on':''}" data-a="l-scenekey" data-v="${k}|${key}|${id}">${esc(o.name||o)}</button>`).join('');
  return `<div class="card" style="margin:8px 0 0;background:var(--panel2)">
    ${cenaHTML(Cena.code(cfg), {w:560})}
    <div class="row" style="margin:10px 0">
      <button class="chip" data-a="l-scenesug" data-v="${k}">✨ Sugerir pelo texto</button>
      <button class="chip" data-a="l-scenevar" data-v="${k}">↻ Outra variação</button>
      <button class="chip ghost" data-a="l-scenedel" data-v="${k}">Sem cena</button>
      <button class="chip on" data-a="l-scene" data-v="${k}">Pronto</button>
    </div>
    <label>Cenário</label><div class="row">${chips(Cena.SCENES, 'id', cfg.id)}</div>
    <label style="margin-top:8px">Hora</label><div class="row">${chips(Cena.TIME, 'time', cfg.time)}</div>
    <label style="margin-top:8px">Clima</label><div class="row">${chips(Cena.WEATHER, 'weather', cfg.weather)}</div>
    <label style="margin-top:8px">Elementos</label><div class="row">${Object.entries(Cena.PROPS)
      .map(([id,o])=>`<button class="chip ${cfg.props.includes(id)?'on':''}" data-a="l-sceneprop" data-v="${k}|${id}">${esc(o.name)}</button>`).join('')}</div>
  </div>`;
}
function openLore(){
  const cur = Game.lore;
  LORE = JSON.parse(JSON.stringify(cur));
  mode = 'lore'; render();
}
function renderLore(){
  const L = LORE, M = Game.LORE_MAX;
  $app.innerHTML = `
  <div class="top">
    <div><div class="mute small">Sala ${esc(Game.code)}</div><h2 style="margin:0">História da aventura</h2></div>
    <button class="chip ghost" data-a="l-cancel">Cancelar</button>
  </div>
  <div class="card col">
    <p class="mute small">Os jogadores recebem o <b>título</b>, a <b>história</b> e o <b>chamado</b> assim que entram. A introdução de cada missão aparece no celular deles só quando aquela missão começa. Pode deixar campos em branco.</p>
    <div class="row">${Game.LORE_PRESETS.map((p,i)=>`<button class="chip" data-a="l-preset" data-v="${i}">📖 ${esc(p.name)}</button>`).join('')}
      <button class="chip ghost" data-a="l-clear">Limpar tudo</button></div>
  </div>
  <div class="card col">
    <div><label for="l-title">Título da aventura</label><input id="l-title" maxlength="${M.title}" value="${esc(L.title)}" placeholder="A Gruta dos Goblins"></div>
    <div><label for="l-world">A história (o mundo, quem são vocês, que existe um infiltrado)</label><textarea id="l-world" rows="6" maxlength="${M.world}" placeholder="Vocês são guerreiros de Pedra Fria…">${esc(L.world)}</textarea></div>
    <div><label for="l-call">O chamado (o objetivo geral da missão)</label><textarea id="l-call" rows="3" maxlength="${M.call}" placeholder="Entrem na gruta e cheguem ao salão do chefe…">${esc(L.call)}</textarea></div>
    <div><label>Cena de abertura (aparece com a história, no lobby)</label>${scenePanelHTML('cover')}</div>
  </div>
  ${L.missions.map((m,i)=>`
  <div class="card col">
    <h3>Missão ${i+1}</h3>
    <div><label for="l-mt${i}">Título</label><input id="l-mt${i}" data-m="${i}" data-f="title" maxlength="${M.mtitle}" value="${esc(m.title)}" placeholder="A boca da gruta"></div>
    <div><label for="l-mx${i}">Introdução (aparece quando esta missão começar)</label><textarea id="l-mx${i}" data-m="${i}" data-f="text" rows="4" maxlength="${M.mtext}" placeholder="O cheiro de enxofre sobe do buraco…">${esc(m.text)}</textarea></div>
    <div><label>Cena da missão</label>${scenePanelHTML(i)}</div>
  </div>`).join('')}
  <div class="card col">
    <div><label for="l-winR">Final se a resistência vencer</label><textarea id="l-winR" rows="3" maxlength="${M.win}" placeholder="A gruta está silenciosa…">${esc(L.winR)}</textarea></div>
    <div><label for="l-winS">Final se os espiões vencerem</label><textarea id="l-winS" rows="3" maxlength="${M.win}" placeholder="Os tambores ecoam pelo vale…">${esc(L.winS)}</textarea></div>
  </div>
  <button class="primary big" data-a="l-save">Salvar história</button>`;
}
function grabLore(){
  const g = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  LORE.title = g('l-title'); LORE.world = g('l-world'); LORE.call = g('l-call');
  LORE.winR = g('l-winR'); LORE.winS = g('l-winS');
  LORE.missions.forEach((m,i) => { m.title = g('l-mt'+i); m.text = g('l-mx'+i); });
}
const loreAct = {
  preset(i){ grabLore(); const p = Game.LORE_PRESETS[+i]; if(!p) return;
    LORE = {title:p.title, world:p.world, call:p.call, cover:p.cover||'', winR:p.winR, winS:p.winS,
            missions:p.missions.map(m=>({title:m.title, text:m.text, scene:m.scene||''}))};
    render(); window.scrollTo(0,0); },
  clear(){ LORE = Game.blankLore(); LOREUI.scene = null; render(); },
  scene(k){ grabLore(); LOREUI.scene = (LOREUI.scene === k || LOREUI.scene === +k) ? null : (k === 'cover' ? 'cover' : +k);
    if(LOREUI.scene !== null && HAS_CENA && !getScene(LOREUI.scene)) setScene(LOREUI.scene, Cena.code(Cena.normalize({})));
    render(); },
  scenedel(k){ grabLore(); setScene(k === 'cover' ? 'cover' : +k, ''); LOREUI.scene = null; render(); },
  scenekey(v){ grabLore(); const [k0, key, val] = v.split('|'); const k = k0 === 'cover' ? 'cover' : +k0;
    const cfg = Cena.parse(getScene(k) || ''); cfg[key] = val; setScene(k, Cena.code(cfg)); render(); },
  sceneprop(v){ grabLore(); const [k0, prop] = v.split('|'); const k = k0 === 'cover' ? 'cover' : +k0;
    const cfg = Cena.parse(getScene(k) || '');
    cfg.props = cfg.props.includes(prop) ? cfg.props.filter(p=>p!==prop) : cfg.props.concat(prop);
    setScene(k, Cena.code(cfg)); render(); },
  scenevar(k0){ grabLore(); const k = k0 === 'cover' ? 'cover' : +k0;
    const cfg = Cena.parse(getScene(k) || ''); cfg.seed = String(Math.floor(Math.random()*1e6));
    setScene(k, Cena.code(cfg)); render(); },
  scenesug(k0){ grabLore(); const k = k0 === 'cover' ? 'cover' : +k0;
    const txt = k === 'cover' ? (LORE.title + ' ' + LORE.world + ' ' + LORE.call)
                              : (LORE.missions[k].title + ' ' + LORE.missions[k].text);
    const cfg = Cena.fromText(txt);
    if(!cfg.matched) alert('Não reconheci nenhum cenário nesse texto. Escolha na mão abaixo.');
    setScene(k, Cena.code(cfg)); render(); },
  save(){ grabLore(); LOREUI.scene = null; Game.act.setLore(LORE); try{ localStorage.setItem('rivalis-lore', JSON.stringify(Game.lore)); }catch(e){} mode = 'host'; render(); window.scrollTo(0,0); },
  cancel(){ LOREUI.scene = null; mode = 'host'; render(); },
};
// Caixa de história mostrada nas telas (mestre e jogador)
function loreBoxHTML(v, opts){
  const L = v.lore; if(!L || !L.has) return '';
  const o = opts || {};
  const cur = L.missions[v.round];
  const showMission = o.mission !== false && v.phase !== 'lobby' && v.phase !== 'end' && cur && (cur.title || cur.text);
  let html = '';
  if(showMission){
    html += `<div class="card lore">
      ${cenaHTML(cur.scene)}
      <h3${cur.scene ? ' style="margin-top:10px"' : ''}>Missão ${v.round+1}${cur.title ? ' · ' + esc(cur.title) : ''}</h3>
      ${cur.text ? `<p class="story">${nl2br(cur.text)}</p>` : ''}</div>`;
  }
  if(o.full !== false){
    html += `<div class="card lore">
      <details ${o.open ? 'open' : ''}>
        <summary>${L.title ? '📖 ' + esc(L.title) : '📖 A história'}</summary>
        ${L.cover ? cenaHTML(L.cover) : ''}
        ${L.world ? `<p class="story">${nl2br(L.world)}</p>` : ''}
        ${L.call ? `<p class="story"><b>O chamado:</b><br>${nl2br(L.call)}</p>` : ''}
      </details></div>`;
  }
  return html;
}

/* ================== JOGADOR ================== */
let C = null, cnet = null;
function startPlayer(code, name){
  code = code.toUpperCase().trim(); name = name.trim().slice(0,16);
  const saved = pstore.get('rivalis-player');
  const cid = (saved && saved.code === code && saved.cid) || '';
  C = { code, name, cid, s:null, status:'server', err:'', seen:0, log:[],
        ui:{tab:'game', showRole:false, kind:'accuse', target:'', flash:''} };
  pstore.set('rivalis-player', {code, name, cid});
  history.replaceState(null, '', '?sala=' + code + (LOCAL ? '&local=1' : ''));
  mode = 'player';
  cnet = Net.client(code, {
    onStatus(st){
      C.status = st;
      if(st === 'open'){
        cnet.send({t:'hello', name:C.name, cid:C.cid || undefined, av:AV.code});
        clearTimeout(C.helloTimer);
        C.helloTimer = setTimeout(() => {
          if(!C.s && C.status === 'open'){ C.log.push('Mestre não respondeu, reenviando…'); cnet.send({t:'hello', name:C.name, cid:C.cid || undefined, av:AV.code}); render(); }
        }, 6000);
      }
      render();
    },
    onLog(t){
      const d = new Date(), p = n => String(n).padStart(2,'0');
      C.log.push(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${t}`);
      if(C.log.length > 12) C.log.shift();
      if(!C.s) render();
    },
    onMsg(m){
      if(!m || typeof m !== 'object') return;
      if(m.t === 'welcome'){ C.cid = m.cid; C.err=''; pstore.set('rivalis-player', {code:C.code, name:C.name, cid:C.cid}); }
      else if(m.t === 'state'){ C.s = m.s; C.err=''; if(C.ui.tab === 'chat') markSeen(); }
      else if(m.t === 'error'){ C.err = String(m.msg || '').slice(0,140); }
      else if(m.t === 'replaced'){ C.err = 'Você abriu o jogo em outro lugar. Esta tela ficou inativa.'; C.s = null; }
      else if(m.t === 'kicked'){ pstore.del('rivalis-player'); alert('Você foi removido da sala.'); location.href = location.pathname + (LOCAL?'?local=1':''); return; }
      render();
    },
  });
  render();
}
const send = m => cnet && cnet.send(m);
function markSeen(){ const c = C.s && C.s.chat; C.seen = c && c.length ? c[c.length-1].id : 0; }

const playerAct = {
  tab(v){ C.ui.tab = v; if(v === 'chat') markSeen(); render(); window.scrollTo(0,0); },
  role(){ C.ui.showRole = !C.ui.showRole; render(); },
  vote(v){ send({t:'vote', v}); },
  mission(v){ send({t:'mission', v}); },
  kind(v){ C.ui.kind = v; render(); },
  target(v){ C.ui.target = C.ui.target === v ? '' : v; render(); },
  say(i){
    const k = C.ui.kind;
    if(k !== 'say' && !C.ui.target) return;
    send({t:'chat', kind:k, i:+i, target: k === 'say' ? undefined : C.ui.target});
    C.ui.flash = 'Enviado!'; render(); setTimeout(()=>{ C.ui.flash=''; render(); }, 1200);
  },
  allyreq(){ if(C.ui.target) send({t:'ally_req', target:C.ui.target}); },
  allyyes(from){ send({t:'ally_resp', from, accept:true}); },
  allyno(from){ send({t:'ally_resp', from, accept:false}); },
  allycancel(){ send({t:'ally_cancel'}); },
  allybreak(){ if(confirm('Romper a aliança? Todos vão ver.')) send({t:'ally_break'}); },
  leave(){ if(!confirm('Sair da sala?')) return; pstore.del('rivalis-player'); location.href = location.pathname + (LOCAL?'?local=1':''); },
};

/* ================== Tela inicial ================== */
const startForm = {code:'', name:''};
const startAct = {
  host(){ const a='ABCDEFGHJKLMNPQRSTUVWXYZ'; let c=''; for(const x of crypto.getRandomValues(new Uint8Array(4))) c+=a[x%a.length]; startHost(c); },
  resume(){ const s = Game.loadSaved(); if(s) startHost(s.code, s); },
  join(){
    const code = document.getElementById('jcode').value, name = document.getElementById('jname').value;
    if(!/^[A-Za-z]{4}$/.test(code.trim())) return alert('O código da sala tem 4 letras.');
    if(!name.trim()) return alert('Digite seu nome.');
    startPlayer(code, name);
  },
};

/* ================== Desenho ================== */
function render(){
  if(mode === 'lore') return renderLore();
  if(mode === 'host') return renderHost();
  if(mode === 'player') return renderPlayer();
  renderStart();
}
const nameOf = (v, pid) => { const p = v.players.find(p => p.pid === pid); return p ? p.name : '?'; };
const avOf   = (v, pid) => { const p = v.players.find(p => p.pid === pid); return p ? p.av : ''; };

function trackHTML(v){
  if(!v.missions.length) return '';
  const cur = ['team','vote','voteResult','mission','missionDone'].includes(v.phase) ? v.round : -1;
  return `<div class="track">${v.missions.map((m,i)=>`
    <div class="m ${m.result||''} ${i===cur?'cur':''}" title="Missão ${i+1}">
      <span>${m.result==='S'?'✓':m.result==='F'?'✗':m.size}</span><small>${m.result?(m.fails?m.fails+' sab.':''):'pessoas'}</small>
      ${m.two ? '<span class="two">2✗</span>' : ''}
    </div>`).join('')}</div>
    <div class="rej">Rejeições: ${[0,1,2,3,4].map(i=>`<i class="${i<v.rejects?'x':''}"></i>`).join('')}</div>`;
}
function feedHTML(v, limit){
  const list = v.chat.slice().reverse().slice(0, limit || 50);
  if(!list.length) return '<p class="mute small">Nenhuma mensagem ainda.</p>';
  return `<div class="feed">${list.map(c => c.kind === 'sys'
    ? `<div class="msg sys">${esc(c.text)}</div>`
    : `<div class="msg ${esc(c.kind)}" style="display:flex;gap:8px;align-items:flex-start">${avHTML(avOf(v,c.from),28)}<div><b>${esc(nameOf(v,c.from))}</b><span class="mute small">${esc(Game.KIND_LABEL[c.kind]||'')}</span><div>${esc(c.text)}</div></div></div>`).join('')}</div>`;
}
function voteRevealHTML(v){
  const r = v.voteReveal; if(!r) return '';
  return `<p><b style="color:${r.approved?'var(--ok)':'var(--spy)'};font-size:20px">${r.approved?'EQUIPE APROVADA':'EQUIPE REJEITADA'}</b>
    <span class="mute">(${r.yes} a favor × ${r.no} contra)</span></p>
    <div class="vt">${v.players.map(p=>`<span>${esc(p.name)}${r.followed.includes(p.pid)?' <span class="mute small">🔗 seguiu aliado</span>':''}</span><span>${r.votes[p.pid]==='A'?'✅ Aprovou':'❌ Rejeitou'}</span>`).join('')}</div>
    ${r.broken.map(([a,b])=>`<p class="warn" style="margin-top:8px">⚠️ ${esc(nameOf(v,a))} e ${esc(nameOf(v,b))} são aliados, mas votaram diferente!</p>`).join('')}`;
}
function missionRevealHTML(v){
  const r = v.missionReveal; if(!r) return '';
  const sab = r.fails === 1 ? '1 sabotagem' : r.fails + ' sabotagens';
  return `<div class="cards">${r.cards.map((c,i)=>`<div class="mc ${c}" style="animation-delay:${i*0.35}s">${c==='S'?'✓':'✗'}</div>`).join('')}</div>
    <p style="text-align:center;font-size:20px;font-weight:800;color:${r.failed?'var(--spy)':'var(--ok)'}">${r.failed?`MISSÃO SABOTADA (${sab})`:'MISSÃO CUMPRIDA'}</p>`;
}
function endHTML(v){
  return `<div class="banner ${v.winner}">${v.winner==='R'?'🛡️ A RESISTÊNCIA VENCEU':'🕵️ OS ESPIÕES VENCERAM'}</div>
    ${v.lore && v.lore.win ? `<p class="story" style="margin:12px 2px">${nl2br(v.lore.win)}</p>` : ''}
    <p class="mute" style="text-align:center">${esc(v.winReason)}</p>
    <div class="players" style="margin-top:10px;grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">${v.players.map(p=>`<div class="pl ${v.roles&&v.roles[p.pid]==='S'?'spy':'resr'}">${avHTML(p.av,38)}<span class="nm">${esc(p.name)}</span><span>${v.roles&&v.roles[p.pid]==='S'?'🕵️':'🛡️'}</span></div>`).join('')}</div>`;
}

function renderStart(){
  const jc = document.getElementById('jcode'), jn = document.getElementById('jname');
  if(jc) startForm.code = jc.value;
  if(jn) startForm.name = jn.value;
  const saved = Game.loadSaved();
  const sala = (Q.get('sala') || '').toUpperCase();
  const lastP = pstore.get('rivalis-player');
  $app.innerHTML = `
  <div style="text-align:center;margin:18px 0 22px">
    <div class="logo">RIVALIS</div>
    <p class="mute">Confie. Acuse. Traia.</p>
  </div>
  <div class="grid2">
    <div class="card col">
      <h2>Entrar como jogador</h2>
      <div><label for="jcode">Código da sala</label><input id="jcode" maxlength="4" autocapitalize="characters" autocomplete="off" value="${esc(startForm.code || sala || (lastP&&lastP.code) || '')}" placeholder="ABCD" style="text-transform:uppercase;letter-spacing:4px;font-weight:700"></div>
      <div><label for="jname">Seu nome</label><input id="jname" maxlength="16" autocomplete="nickname" value="${esc(startForm.name || (lastP&&lastP.name) || '')}" placeholder="Como te chamam"></div>
      ${avPickerHTML('Seu personagem')}
      <button class="primary big" data-a="s-join">Entrar</button>
    </div>
    <div class="card col">
      <h2>Sou o mestre</h2>
      <p class="mute">Cria a sala neste aparelho. Os jogadores entram pelo celular com o código ou o QR code. O mestre escolhe as equipes e revela os resultados.</p>
      <button class="big" data-a="s-host">Criar sala</button>
      ${saved ? `<button class="ghost" data-a="s-resume">Retomar sala ${esc(saved.code)} (${(saved.players||[]).length} jogadores)</button>` : ''}
    </div>
  </div>
  <div class="card">
    <details><summary>Como jogar</summary>
      <ol class="small" style="padding-left:18px">
        <li>Cada jogador recebe um papel secreto: <b>Resistência</b> (maioria) ou <b>Espião</b>. Os espiões sabem quem são os outros espiões.</li>
        <li>Em cada rodada o <b>mestre escolhe a equipe</b> da missão.</li>
        <li>Todos votam para <b>aprovar ou rejeitar</b> a equipe. Cinco rejeições seguidas dão vitória aos espiões.</li>
        <li>Quem está na equipe joga em segredo <b>Sucesso</b> ou <b>Sabotagem</b> (só espiões podem sabotar). Uma sabotagem basta para falhar; com 7+ jogadores, a 4ª missão precisa de duas.</li>
        <li>Quem vencer 3 missões primeiro ganha.</li>
        <li>Na <b>Conversa</b>, use textos prontos para acusar, defender ou propor <b>aliança</b>. Aliados podem votar com "Seguir aliado", e se votarem diferente todos ficam sabendo.</li>
      </ol>
    </details>
  </div>
  ${LOCAL ? `<div class="warn">Modo teste local: abra várias abas deste navegador (uma para o mestre e uma para cada jogador).</div>` : ''}`;
}

function renderHost(){
  const v = Game.hostView(hostUI.showRoles);
  const n = v.players.length;
  const cfg = Game.TABLE[n];
  const url = location.origin + location.pathname + '?sala=' + v.code + (LOCAL ? '&local=1' : '');
  let qr = '';
  if(typeof qrcode !== 'undefined'){ try{ const q = qrcode(0,'M'); q.addData(url); q.make(); qr = q.createSvgTag({cellSize:4, margin:2, scalable:true}); }catch(e){} }
  const mis = v.missions[v.round];
  let phase = '';
  switch(v.phase){
    case 'lobby':
      phase = `<h3>Aguardando jogadores</h3>
        <p>${n} na sala. ${cfg ? `${cfg.spies} ${cfg.spies>1?'espiões':'espião'} nesta configuração.` : n<3 ? 'Mínimo 3 para testar, 5 para uma partida normal.' : 'Máximo 10.'}</p>
        ${n>=3 && n<5 ? '<p class="warn">Com menos de 5 jogadores é só um modo de teste.</p>' : ''}
        ${v.lore.has
          ? `<p class="small">📖 História: <b>${esc(v.lore.title || 'sem título')}</b> · <button class="chip" data-a="h-lore">Editar</button></p>`
          : `<p class="small mute">Sem história. <button class="chip" data-a="h-lore">📖 Escrever a história</button> (ou use um exemplo pronto)</p>`}
        <div class="switch" style="margin:10px 0"><button class="chip ${v.voteOn?'on':''}" data-a="h-votetoggle">${v.voteOn?'✓':'✗'} Votação da equipe</button><span class="mute small">${v.voteOn?'Jogadores aprovam ou rejeitam a equipe do mestre':'A equipe do mestre vai direto para a missão'}</span></div>
        <button class="primary big" data-a="h-start" ${cfg?'':'disabled'}>Iniciar partida</button>`;
      break;
    case 'team':
      phase = `<h3>Missão ${v.round+1}: escolha a equipe</h3>
        <p>Toque em <b>${mis.size}</b> jogadores abaixo (${v.team.length}/${mis.size}).${mis.two?' <b style="color:var(--warn)">Esta missão precisa de 2 sabotagens para falhar.</b>':''}</p>
        <button class="primary big" data-a="h-confirm" ${v.team.length===mis.size?'':'disabled'}>${v.voteOn?'Enviar para votação':'Iniciar missão'}</button>`;
      break;
    case 'vote':
      phase = `<h3>Votação: missão ${v.round+1}</h3>
        <p>Equipe: <b>${v.team.map(p=>esc(nameOf(v,p))).join(', ')}</b></p>
        <p>Votaram: <b>${v.voted.length}/${n}</b></p>
        <p class="small mute">Faltam: ${esc(v.players.filter(p=>!v.voted.includes(p.pid)).map(p=>p.name).join(', ')) || '—'}</p>`;
      break;
    case 'voteResult':
      phase = `<h3>Resultado da votação</h3>${voteRevealHTML(v)}
        <button class="primary big" style="margin-top:10px" data-a="h-after">${v.voteReveal.approved?'Começar a missão':'Escolher outra equipe'}</button>`;
      break;
    case 'mission':
      phase = `<h3>Missão ${v.round+1} em andamento</h3>
        <p>Equipe: <b>${v.team.map(p=>esc(nameOf(v,p))).join(', ')}</b></p>
        <p>Cartas recebidas: <b>${v.acted}/${v.team.length}</b></p>`;
      break;
    case 'missionDone':
      phase = `<h3>Todas as cartas chegaram</h3><p>Hora do suspense. Revele quando todos estiverem olhando.</p>
        <button class="danger big" data-a="h-reveal">Revelar resultado</button>`;
      break;
    case 'missionResult':
      phase = `<h3>Resultado da missão ${v.round+1}</h3>${missionRevealHTML(v)}
        <button class="primary big" data-a="h-next">Próxima missão</button>`;
      break;
    case 'end':
      phase = endHTML(v) + `<button class="primary big" style="margin-top:12px" data-a="h-again">Jogar de novo (mesma sala)</button>`;
      break;
  }
  const inGame = v.phase !== 'lobby';
  const playersHTML = v.players.map(p=>{
    const sel = v.team.includes(p.pid);
    const role = v.roles && v.roles[p.pid];
    const ally = v.allies[p.pid];
    const cls = `pl ${sel?'sel':''} ${role==='S'?'spy':role==='R'?'resr':''}`;
    const inner = `${avHTML(p.av,34)}<span class="dot ${p.on?'on':'off'}"></span><span class="nm">${esc(p.name)}${ally?`<br><span class="small mute">🤝${esc(nameOf(v,ally))}</span>`:''}</span>${sel?'⭐':''}${role==='S'?'🕵️':''}`;
    if(v.phase === 'team') return `<button class="${cls}" data-a="h-team" data-v="${esc(p.pid)}">${inner}</button>`;
    if(v.phase === 'lobby') return `<div class="${cls}">${inner}<button class="chip ghost" data-a="h-kick" data-v="${esc(p.pid)}" aria-label="Remover ${esc(p.name)}">✕</button></div>`;
    return `<div class="${cls}">${inner}</div>`;
  }).join('') || '<p class="mute">Ninguém entrou ainda.</p>';

  $app.innerHTML = `
  <div class="top">
    <div><div class="mute small">Sala · Mestre <span class="pill"><span class="dot ${hostUI.ready?'on':'off'}"></span>${hostUI.ready?'Sala online':'Abrindo sala…'}</span></div><div class="code">${esc(v.code)}</div></div>
    <div class="row">
      ${v.phase === 'lobby' ? `<button class="chip" data-a="h-lore">📖 História</button>` : ''}
      ${inGame && v.phase !== 'end' ? `<button class="chip" data-a="h-roles">${hostUI.showRoles?'🙈 Esconder papéis':'👁️ Ver papéis'}</button>` : ''}
      <button class="chip ghost" data-a="h-close">Encerrar sala</button>
    </div>
  </div>
  ${hostUI.status ? `<div class="warn" style="margin-bottom:12px">${esc(hostUI.status)}</div>` : ''}
  ${location.protocol==='file:' && !LOCAL ? `<div class="warn" style="margin-bottom:12px">Este arquivo foi aberto direto do computador, então o QR code não funciona nos celulares. Hospede o jogo (GitHub Pages, Netlify etc.).</div>` : ''}
  <div class="grid2">
    <div>
      ${inGame ? `<div class="card">${trackHTML(v)}</div>` : ''}
      ${loreBoxHTML(v, {open:false})}
      <div class="card phase">${phase}</div>
      <div class="card"><h3>Jogadores (${n})</h3><div class="players">${playersHTML}</div></div>
    </div>
    <div>
      ${!inGame ? `<div class="card" style="text-align:center">
        <h3>Entrar na sala</h3>
        ${qr ? `<div class="qr">${qr}</div>` : ''}
        <p class="link">${esc(url)}</p>
        <p class="small mute">Ou abra a página e digite o código <b>${esc(v.code)}</b></p>
        <p class="small mute">Deixe esta tela aberta e acesa durante o jogo. Se o mestre trocar de aba ou bloquear o aparelho, a sala pausa.</p>
      </div>` : ''}
      <div class="card"><h3>Conversa</h3>${feedHTML(v, 40)}</div>
    </div>
  </div>`;
}

function renderPlayer(){
  const v = C.s;
  const statusTxt = {
    server:'Conectando ao servidor de salas…',
    linking:'Ligando no aparelho do mestre…',
    open: v ? 'Conectado' : 'Conectado, aguardando o mestre…',
    retry:'Reconectando…',
    stuck:'A ligação com o mestre não completou. Tentando de novo…',
    nohost:`Sala ${C.code} não encontrada.`,
    noserver:'Sem acesso ao servidor de salas.',
    nolib:'Este navegador bloqueou a conexão.',
  }[C.status] || '';
  const HINT = {
    nohost:'Confira o código. A tela do mestre precisa estar aberta e acesa: se o mestre estiver no mesmo celular em outra aba, o navegador pausa a sala. Use dois aparelhos.',
    stuck:'A rede pode estar bloqueando a ligação direta. Tente com o celular nos dados móveis ou os dois aparelhos no mesmo Wi-Fi.',
    noserver:'Verifique a internet deste aparelho. Redes de empresa ou escola às vezes bloqueiam.',
    nolib:'Abra o link do jogo direto no Safari ou Chrome (não dentro de outro app).',
  }[C.status];

  if(!v){
    $app.innerHTML = `
      <div class="top"><div><div class="mute small">Sala</div><div class="code">${esc(C.code)}</div></div>
      <button class="chip ghost" data-a="p-leave">Sair</button></div>
      <div class="card" style="text-align:center"><p style="font-size:18px">${esc(statusTxt)}</p>${HINT?`<p class="warn" style="text-align:left">${esc(HINT)}</p>`:''}${C.err?`<p class="err">${esc(C.err)}</p>`:''}</div>
      <div class="card"><details ${['stuck','nohost'].includes(C.status)?'open':''}><summary>Detalhes da conexão</summary><pre class="small mute" style="white-space:pre-wrap;margin:8px 0 0">${esc(C.log.join('\n')) || '—'}</pre></details></div>`;
    return;
  }
  const me = v.me, others = v.players.filter(p => p.pid !== me.pid);
  const unread = C.ui.tab !== 'chat' ? v.chat.filter(c => c.id > C.seen && c.from !== me.pid).length : 0;
  const onTeam = me.onTeam;

  let phase = '';
  switch(v.phase){
    case 'lobby':
      phase = `<h3>Aguardando o mestre</h3><p>${v.players.length} jogadores na sala.</p>
        <div class="players">${v.players.map(p=>`<div class="pl">${avHTML(p.av,34)}<span class="dot ${p.on?'on':'off'}"></span><span class="nm">${esc(p.name)}${p.pid===me.pid?' (você)':''}</span></div>`).join('')}</div>
        <div style="margin-top:12px">${avPickerHTML('Seu personagem')}</div>`;
      break;
    case 'team':
      phase = `<h3>Escolha da equipe</h3><p>O mestre está escolhendo quem vai na missão ${v.round+1} (${v.missions[v.round].size} pessoas)…</p>
        ${v.team.length ? `<div class="row">${v.team.map(p=>`<span class="pill" style="padding-left:3px">${avHTML(avOf(v,p),28)} ${esc(nameOf(v,p))}</span>`).join('')}</div>` : ''}
        <p class="small mute">Aproveite para conversar na aba Conversa.</p>`;
      break;
    case 'vote':
      phase = `<h3>Votação: missão ${v.round+1}</h3>
        <p>Equipe proposta:${onTeam?' <span class="pill">você está nela</span>':''}</p>
        <div class="row" style="margin-bottom:10px">${v.team.map(p=>`<span class="pill" style="padding-left:3px">${avHTML(avOf(v,p),28)} ${esc(nameOf(v,p))}</span>`).join('')}</div>
        ${me.voted
          ? `<p>Voto enviado: <b>${me.myVote==='A'?'✅ Aprovar':me.myVote==='R'?'❌ Rejeitar':'🔗 Seguir aliado'}</b></p><p class="mute">Aguardando ${v.players.length - v.voted.length} jogador(es)…</p>`
          : `<div class="col">
              <button class="ok big" data-a="p-vote" data-v="A">✅ Aprovar equipe</button>
              <button class="danger big" data-a="p-vote" data-v="R">❌ Rejeitar equipe</button>
              ${me.ally ? `<button class="big" data-a="p-vote" data-v="F">🔗 Seguir meu aliado (${esc(nameOf(v,me.ally))})${v.voted.includes(me.ally)?' · já votou':''}</button>` : ''}
            </div>`}`;
      break;
    case 'voteResult':
      phase = `<h3>Resultado da votação</h3>${voteRevealHTML(v)}<p class="small mute">Aguardando o mestre…</p>`;
      break;
    case 'mission':
      if(onTeam && !me.acted){
        phase = `<h3>Você está na missão ${v.round+1}!</h3><p>Escolha em segredo. Ninguém vai saber quem jogou o quê.</p>
          <div class="col">
            <button class="primary big" data-a="p-mission" data-v="S">✓ Sucesso</button>
            ${me.role==='S' ? `<button class="danger big" data-a="p-mission" data-v="F">✗ Sabotar</button>` : `<p class="small mute">Como resistência, você só pode jogar sucesso.</p>`}
          </div>`;
      } else {
        phase = `<h3>Missão ${v.round+1} em andamento</h3><p>${onTeam?'Sua carta foi enviada. ':''}Cartas recebidas: ${v.acted}/${v.team.length}</p>`;
      }
      break;
    case 'missionDone':
      phase = `<h3>Missão ${v.round+1}</h3><p>Todas as cartas chegaram. Olhe para o mestre, ele vai revelar o resultado.</p>`;
      break;
    case 'missionResult':
      phase = `<h3>Resultado da missão ${v.round+1}</h3>${missionRevealHTML(v)}`;
      break;
    case 'end':
      phase = endHTML(v);
      break;
  }
  const roleCard = me.role ? `
    <div class="role ${C.ui.showRole ? me.role : 'hid'}" data-a="p-role" role="button" aria-label="Mostrar ou esconder papel">
      ${C.ui.showRole
        ? (me.role==='S'
            ? `<div>🕵️</div><div class="t">ESPIÃO</div><p>Sabote missões sem ser descoberto.</p>${me.spies.length?`<p><b>Seus parceiros:</b> ${me.spies.map(esc).join(', ')}</p>`:''}`
            : `<div>🛡️</div><div class="t">RESISTÊNCIA</div><p>Faça as missões darem certo e descubra os espiões.</p>`)
          + '<p class="small mute">Toque para esconder</p>'
        : '<div class="t">🔒 Papel secreto</div><p class="mute">Toque para ver (cuidado com quem está olhando)</p>'}
    </div>` : '';

  const incoming = me.incoming.map(f=>`<div class="row" style="justify-content:space-between"><span>🤝 <b>${esc(nameOf(v,f))}</b> quer ser seu aliado</span><span class="row"><button class="chip ok" data-a="p-allyyes" data-v="${esc(f)}">Aceitar</button><button class="chip" data-a="p-allyno" data-v="${esc(f)}">Recusar</button></span></div>`).join('');
  const allyBox = (me.ally || incoming || me.outgoing.length) ? `<div class="card col">
      <h3>Aliança</h3>
      ${me.ally ? `<div class="row" style="justify-content:space-between"><span>🤝 Aliado de <b>${esc(nameOf(v,me.ally))}</b></span><button class="chip" data-a="p-allybreak">Romper</button></div><p class="small mute">Na votação você pode escolher "Seguir aliado". Se votarem diferente, todos ficam sabendo.</p>` : ''}
      ${incoming}
      ${me.outgoing.length ? `<div class="row" style="justify-content:space-between"><span class="mute">Aguardando resposta de ${esc(nameOf(v,me.outgoing[0]))}…</span><button class="chip" data-a="p-allycancel">Cancelar</button></div>` : ''}
    </div>` : '';

  const gameTab = `
    ${roleCard ? `<div class="card" style="padding:10px">${roleCard}</div>` : ''}
    ${v.missions.length ? `<div class="card">${trackHTML(v)}</div>` : ''}
    ${loreBoxHTML(v, {open: v.phase === 'lobby'})}
    <div class="card phase">${phase}</div>
    ${allyBox}`;

  const k = C.ui.kind;
  const needsTarget = k === 'accuse' || k === 'defend' || k === 'ally';
  if(C.ui.target && !others.some(p => p.pid === C.ui.target)) C.ui.target = '';
  const tname = C.ui.target ? nameOf(v, C.ui.target) : '';
  let composer = '';
  if(k === 'ally'){
    composer = me.ally
      ? `<p>Você já é aliado de <b>${esc(nameOf(v,me.ally))}</b>. Rompa a aliança na aba Jogo para fazer outra.</p>`
      : `<button class="primary big" data-a="p-allyreq" ${C.ui.target && !v.alliances.some(a=>a.includes(C.ui.target))?'':'disabled'}>${C.ui.target ? `Propor aliança a ${esc(tname)}` : 'Escolha um jogador acima'}</button>
         ${C.ui.target && v.alliances.some(a=>a.includes(C.ui.target)) ? '<p class="small mute">Esse jogador já tem um aliado.</p>' : ''}
         <p class="small mute">Aliados combinam de votar igual. Se um votar diferente do outro, a quebra aparece para todos.</p>`;
  } else {
    composer = (needsTarget && !C.ui.target)
      ? '<p class="mute">Escolha um jogador acima.</p>'
      : `<div class="col">${Game.TPL[k].map((t,i)=>`<button class="tpl" data-a="p-say" data-v="${i}">${esc(t.replace('{X}', tname))}</button>`).join('')}</div>`;
  }
  const chatTab = `
    <div class="card col">
      <div class="row">${['accuse','defend','ally','say'].map(x=>`<button class="chip ${k===x?'on':''}" data-a="p-kind" data-v="${x}">${esc(Game.KIND_LABEL[x])}</button>`).join('')}</div>
      ${needsTarget ? `<div><label>Jogador</label><div class="row">${others.map(p=>`<button class="chip ${C.ui.target===p.pid?'on':''}" data-a="p-target" data-v="${esc(p.pid)}" style="padding-left:4px">${avHTML(p.av,26)} ${esc(p.name)}</button>`).join('') || '<span class="mute small">Ninguém mais na sala.</span>'}</div></div>` : ''}
      ${composer}
      ${C.ui.flash ? `<p style="color:var(--ok)">${esc(C.ui.flash)}</p>` : ''}
    </div>
    <div class="card"><h3>Mensagens</h3>${feedHTML(v, 50)}</div>`;

  $app.innerHTML = `
    <div class="top">
      <div class="row" style="gap:10px">${avHTML(me.av, 44)}<div><div class="mute small">Sala ${esc(C.code)}</div><h2 style="margin:0">${esc(me.name)}</h2></div></div>
      <div class="row"><span class="pill"><span class="dot ${C.status==='open'?'on':'off'}"></span>${esc(statusTxt)}</span><button class="chip ghost" data-a="p-leave">Sair</button></div>
    </div>
    ${C.err ? `<div class="err" style="margin-bottom:12px">${esc(C.err)}</div>` : ''}
    <div class="tabs">
      <button class="${C.ui.tab==='game'?'on':''}" data-a="p-tab" data-v="game">Jogo</button>
      <button class="${C.ui.tab==='chat'?'on':''}" data-a="p-tab" data-v="chat">Conversa${unread?`<span class="badge">${unread}</span>`:''}</button>
    </div>
    ${C.ui.tab==='game' ? gameTab : chatTab}`;
}

/* ================== Eventos ================== */
const ACTIONS = {};
for(const [k,f] of Object.entries(hostAct))   ACTIONS['h-'+k] = f;
for(const [k,f] of Object.entries(playerAct)) ACTIONS['p-'+k] = f;
for(const [k,f] of Object.entries(startAct))  ACTIONS['s-'+k] = f;
for(const [k,f] of Object.entries(avAct))     ACTIONS['a-'+k] = f;
for(const [k,f] of Object.entries(loreAct))   ACTIONS['l-'+k] = f;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if(!b || b.disabled) return;
  const f = ACTIONS[b.dataset.a];
  if(f) f(b.dataset.v);
});
document.addEventListener('keydown', e => {
  if(e.key === 'Enter' && mode === 'start' && (e.target.id === 'jname' || e.target.id === 'jcode')) startAct.join();
});

/* ================== Início ================== */
(function boot(){
  const m = Q.get('mestre'), sala = Q.get('sala');
  if(m){ const s = Game.loadSaved(); if(s && s.code === m.toUpperCase()) return startHost(s.code, s); }
  if(sala){ const p = pstore.get('rivalis-player'); if(p && p.code === sala.toUpperCase() && p.name) return startPlayer(p.code, p.name); }
  render();
})();
