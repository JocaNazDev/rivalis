/* ============================================================
   Rivalis · rivalis-net.js
   Só o transporte: liga os celulares ao aparelho do mestre.
   Não conhece regra de jogo nenhuma e não guarda estado de partida.

     Net.host(code, {onMsg, onLeave, onReady, onError})  -> {send, drop}
     Net.client(code, {onMsg, onStatus, onLog})          -> {send}

   Em ?local=1 as abas do mesmo navegador conversam entre si
   (BroadcastChannel), para testar sozinho no PC.
   ============================================================ */
(function (root) {
'use strict';

const LOCAL = new URLSearchParams(location.search).has('local');
const PREFIX = 'resistencia-jogo-v1-';
const rid = (n=10) => { const a='abcdefghijkmnpqrstuvwxyz23456789'; let s=''; for(const x of crypto.getRandomValues(new Uint8Array(n))) s += a[x%a.length]; return s; };

// Servidores para atravessar roteadores e 4G (STUN) e retransmitir quando a
// ligação direta não passa (TURN).
const PEER_OPTS = { debug:1, config:{ iceServers:[
  {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},
  {urls:'stun:stun.cloudflare.com:3478'},
  {urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'], username:'peerjs', credential:'peerjsp'},
]}};

function host(code, h){
  if(LOCAL){
    const bc = new BroadcastChannel(PREFIX + code);
    bc.onmessage = e => { const x = e.data; if(!x || x.to !== 'host') return;
      if(x.d && x.d.t === 'bye') h.onLeave(x.from); else h.onMsg(x.from, x.d); };
    setTimeout(h.onReady, 0);
    return { send(k,m){ bc.postMessage({to:k, d:m}); }, drop(){} };
  }
  if(typeof Peer === 'undefined'){
    setTimeout(()=>h.onError('Não foi possível carregar a conexão. Verifique a internet e recarregue.'), 0);
    return { send(){}, drop(){} };
  }
  const conns = {}; let peer;
  const open = () => {
    try{ peer = new Peer(PREFIX + code, PEER_OPTS); }
    catch(e){ h.onError('Este navegador bloqueou a conexão. Abra o link do jogo no Safari ou Chrome.'); return; }
    peer.on('open', () => h.onReady());
    peer.on('connection', c => {
      conns[c.connectionId] = c;
      c.on('data', m => h.onMsg(c.connectionId, m));
      c.on('close', () => { delete conns[c.connectionId]; h.onLeave(c.connectionId); });
      c.on('error', () => {});
    });
    peer.on('disconnected', () => { if(!peer.destroyed) setTimeout(()=>{ try{ peer.reconnect(); }catch(e){} }, 1500); });
    peer.on('error', e => {
      if(e.type === 'unavailable-id'){ h.onError('Reabrindo a sala… aguarde alguns segundos.'); peer.destroy(); setTimeout(open, 3000); }
      else if(['network','server-error','socket-error','socket-closed'].includes(e.type)){
        h.onError('Sem conexão com o servidor de salas. Se você abriu o arquivo dentro de uma pré-visualização, abra pelo link hospedado no navegador. Tentando de novo…');
      }
    });
  };
  open();
  return {
    send(k,m){ const c = conns[k]; if(c && c.open){ try{ c.send(m); }catch(e){} } },
    drop(k){ const c = conns[k]; if(c){ try{ c.close(); }catch(e){} } },
  };
}

function client(code, h){
  if(LOCAL){
    const me = rid();
    const bc = new BroadcastChannel(PREFIX + code);
    bc.onmessage = e => { if(e.data && e.data.to === me) h.onMsg(e.data.d); };
    addEventListener('pagehide', () => bc.postMessage({to:'host', from:me, d:{t:'bye'}}));
    setTimeout(()=>h.onStatus('open'), 0);
    return { send(m){ bc.postMessage({to:'host', from:me, d:m}); } };
  }
  if(typeof Peer === 'undefined'){ setTimeout(()=>h.onStatus('nolib'), 0); return { send(){} }; }

  let peer = null, conn = null, linkTimer = null, retryTimer = null, attempts = 0;
  const log = t => h.onLog && h.onLog(t);
  const later = (fn, ms) => { clearTimeout(retryTimer); retryTimer = setTimeout(fn, ms); };

  const startPeer = () => {                       // 1) registra no servidor de salas
    try{ peer && peer.destroy(); }catch(e){}
    conn = null; clearTimeout(linkTimer);
    h.onStatus('server'); log('Conectando ao servidor de salas…');
    try{ peer = new Peer(PEER_OPTS); }catch(e){ h.onStatus('nolib'); log('Erro ao criar conexão: ' + e.message); return; }
    peer.on('open', () => { log('Servidor OK.'); connectHost(); });
    peer.on('disconnected', () => { log('Servidor caiu, reconectando…'); if(!peer.destroyed){ try{ peer.reconnect(); }catch(e){} } });
    peer.on('error', e => {
      log('Erro: ' + e.type);
      if(e.type === 'peer-unavailable'){ h.onStatus('nohost'); later(connectHost, 4000); }
      else if(['network','server-error','socket-error','socket-closed','unavailable-id'].includes(e.type)){ h.onStatus('noserver'); later(startPeer, 4000); }
      else if(e.type === 'browser-incompatible'){ h.onStatus('nolib'); }
      else later(startPeer, 4000);
    });
  };
  const connectHost = () => {                     // 2) liga no aparelho do mestre
    if(!peer || peer.destroyed || peer.disconnected) return startPeer();
    try{ conn && conn.close(); }catch(e){}
    attempts++;
    h.onStatus('linking'); log(`Ligando no mestre (tentativa ${attempts})…`);
    const c = peer.connect(PREFIX + code, {reliable:true});
    conn = c;
    clearTimeout(linkTimer);
    linkTimer = setTimeout(() => {                // negociação travada
      if(conn === c && !c.open){ log('Tempo esgotado ligando no mestre.'); h.onStatus('stuck'); try{ c.close(); }catch(e){} later(connectHost, 1500); }
    }, 15000);
    c.on('open', () => { if(conn !== c) return; clearTimeout(linkTimer); attempts = 0; log('Conectado ao mestre!'); h.onStatus('open'); });
    c.on('data', m => { if(conn === c) h.onMsg(m); });
    c.on('close', () => { if(conn !== c) return; clearTimeout(linkTimer); log('Conexão com o mestre fechou.'); h.onStatus('retry'); later(connectHost, 2000); });
    c.on('error', e => { if(conn === c) log('Erro na conexão: ' + ((e && e.type) || e)); });
  };
  startPeer();
  document.addEventListener('visibilitychange', () => {
    if(document.hidden || (conn && conn.open)) return;
    log('Voltou para o app, reconectando…');
    if(!peer || peer.destroyed || peer.disconnected) startPeer(); else connectHost();
  });
  return { send(m){ if(conn && conn.open){ try{ conn.send(m); }catch(e){} } } };
}

root.Net = { host, client, LOCAL, PREFIX };

})(typeof window !== 'undefined' ? window : globalThis);
