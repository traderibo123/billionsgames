/* v3_11 — Bigger hero logo; Game Over only on time-out; negative scores allowed; continuous refill */
const GAME = {
  timeLimit: 60,
  maxCards: 100,         // büyük deste
  score: 0, correct: 0, total: 0,
  time: 60, timerId: null,
  name: 'Player',
  deckEl: null,
  pool: [],              // sürekli akış için havuz
  ptr: 0                 // sıradaki kart işaretçisi
};

const $ = (id)=>document.getElementById(id);
const qs = (sel)=>document.querySelector(sel);

function setScreen(which){
  ['screen-start','screen-game','screen-end'].forEach(id=>{
    const el=$(id); if(!el)return;
    id===which ? el.classList.add('active') : el.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  $('startBtn').addEventListener('click', async ()=>{
    const name = $('nickname').value.trim();
    GAME.name = name || 'Player';
    const hn = qs('#hudName'); if (hn) hn.textContent = GAME.name;
    setScreen('screen-game');
    await startGame();
  });

  $('btnReal').addEventListener('click', ()=> swipeTop('right'));
  $('btnFake').addEventListener('click', ()=> swipeTop('left'));
  $('playAgain').addEventListener('click', ()=> setScreen('screen-start'));

  GAME.deckEl = $('deck');
});

/* ---- image helpers ---- */
function unavatarFast(handle){
  const h = String(handle||'').replace(/^@+/, '');
  const raw = `unavatar.io/twitter/${encodeURIComponent(h)}`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}&w=256&h=256&fit=cover`;
}
function robo(seed){ return `https://robohash.org/${encodeURIComponent(seed)}.png?set=set3`; }

function showError(msg){ const box=$('errorBox'); if (box){ box.style.display='block'; box.textContent=msg; } else alert(msg); }
async function tryFetchHandles(){
  const paths=['handles.json','/handles.json','./handles.json'];
  let last; for (const p of paths){
    try{
      const r = await fetch(p, { cache:'no-store' });
      if(!r.ok) throw new Error(p+' -> '+r.status);
      const d = await r.json();
      if(!d || !Array.isArray(d.handles)) throw new Error(p+' missing {"handles":[]}')
      return d.handles;
    }catch(e){ last=e; }
  }
  throw last || new Error('handles.json not found');
}

function loadWithTimeout(url, t=2000){
  return new Promise(res=>{
    const img=new Image(); let done=false;
    const fin=(ok)=>{ if(!done){ done=true; res(!!ok); } };
    const to=setTimeout(()=>fin(false), t);
    img.onload=()=>{ clearTimeout(to); fin(true); };
    img.onerror=()=>{ clearTimeout(to); fin(false); };
    img.decoding='async'; img.loading='eager'; img.referrerPolicy='no-referrer';
    img.src=url;
  });
}
async function preloadItems(items, t=1800, conc=6){
  let i=0;
  async function worker(){
    while(i<items.length){
      const k=i++; const it=items[k];
      const ok=await loadWithTimeout(it.src,t);
      if(!ok && it.label==='human'){
        it._fellback=true; it.src=robo('fallback-'+Math.random());
        await loadWithTimeout(it.src,1200);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(conc,Math.max(1,items.length))}, worker));
}
async function warmSwapReal(items, t=4000){
  for(const it of items){
    if(it.label!=='human'||!it._fellback||!it.realSrc) continue;
    const ok = await loadWithTimeout(it.realSrc, t);
    if(ok){
      const el=document.querySelector(`[data-id="${it.id}"] img`);
      if(el) el.src = it.realSrc;
    }
  }
}

/* ---- pool & deck management ---- */
function takeNext(n){
  const out=[];
  while(out.length<n){
    if(GAME.ptr >= GAME.pool.length){
      // havuz bitti → yeniden karıştır
      GAME.ptr = 0;
      GAME.pool = GAME.pool.sort(()=>Math.random()-0.5);
    }
    out.push(GAME.pool[GAME.ptr++]);
  }
  return out;
}

async function ensureDeck(minCount=1, batchSize=8){
  const left = GAME.deckEl.querySelectorAll('.card').length;
  if (left >= minCount) return;
  const next = takeNext(batchSize);
  await preloadItems(next, 1600, 6);
  for(let i=next.length-1;i>=0;i--) createCard(next[i]);
}

async function startGame(){
  clearInterval(GAME.timerId);
  GAME.deckEl.innerHTML = '';
  GAME.score=0; GAME.correct=0; GAME.total=0;
  GAME.time=GAME.timeLimit;
  $('score').textContent='0'; $('time').textContent=String(GAME.time);

  // havuz hazırla
  let base=[];
  try{
    const handles = await tryFetchHandles();
    const shuffled = handles.slice().sort(()=>Math.random()-0.5);
    const batch = shuffled.slice(0, Math.max(40, Math.min(GAME.maxCards, handles.length)));
    let id=1;
    const humans = batch.map(h=>{
      const src = unavatarFast(h);
      return { id:'card-'+(id++), src, realSrc:src, label:'human' };
    });
    const bots = Array.from({length:batch.length}, (_,i)=>({ id:'card-'+(id++), src:robo('bills-bot-'+Date.now()+'-'+i), label:'bot' }));
    base = [...humans, ...bots];
  }catch(e){
    showError('Could not load handles.json or images.');
    setScreen('screen-start');
    return;
  }

  // büyük havuz: 3x çoğalt + karıştır → kesintisiz akış
  GAME.pool = Array.from({length:3}, ()=> base).flat().sort(()=>Math.random()-0.5);
  GAME.ptr = 0;

  // başta 8 kart yükle
  await ensureDeck(1, 8);

  // sadece süre bitince Game Over
  GAME.timerId = setInterval(()=>{
    GAME.time--;
    $('time').textContent = String(GAME.time);
    if (GAME.time <= 0){
      endGame();
    }else{
      // desteyi dolu tut
      ensureDeck(1, 6);
    }
  }, 1000);
}

function createCard(it){
  const card = document.createElement('div');
  card.className = 'card'; card.dataset.label = it.label; card.dataset.id = it.id;
  const img = document.createElement('img');
  img.alt = it.label==='human' ? 'Real Human' : 'Fake/Bot';
  img.decoding='async'; img.loading='lazy'; img.src = it.src;
  card.append(img);
  GAME.deckEl.appendChild(card);
  attachGesture(card);
}

function attachGesture(card){
  let sx=0, sy=0, dx=0, dy=0, drag=false;
  const start=(x,y)=>{ drag=true; sx=x; sy=y; card.style.transition='none'; };
  const move =(x,y)=>{ if(!drag) return; dx=x-sx; dy=y-sy; const rot=dx/20; card.style.transform=`translate(${dx}px, ${dy}px) rotate(${rot}deg)`; };
  const end  =()=>{ if(!drag) return; drag=false; const th=100;
    if(dx>th) swipe(card,'right');
    else if(dx<-th) swipe(card,'left');
    else { card.style.transition='transform .18s ease'; card.style.transform=''; }
  };
  card.addEventListener('mousedown',e=>start(e.clientX,e.clientY));
  window.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
  window.addEventListener('mouseup',end);
  card.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY);},{passive:true});
  card.addEventListener('touchmove', e=>{const t=e.touches[0];move(t.clientX,t.clientY);},{passive:true});
  card.addEventListener('touchend', end);
}

function swipeTop(direction){
  const top = GAME.deckEl.querySelector('.card:last-child');
  if(top) swipe(top, direction);
}

function swipe(card, direction){
  const dx = direction==='right' ? 800 : -800;
  card.style.transition='transform .22s ease';
  card.style.transform=`translate(${dx}px,0) rotate(${direction==='right'?20:-20}deg)`;

  const label = card.dataset.label;
  const correct = (direction==='right' && label==='human') || (direction==='left' && label==='bot');
  GAME.total++;
  if(correct){ GAME.score++; GAME.correct++; }
  else { GAME.score--; } // NEGATIVE allowed
  $('score').textContent = String(GAME.score);

  setTimeout(()=>{
    card.remove();
    // Deste bittiyse VE süre devam ediyorsa, yeni kart çek
    if(GAME.time > 0 && !GAME.deckEl.querySelector('.card')){
      ensureDeck(1, 6);
    }
  }, 200);
}

function endGame(){
  clearInterval(GAME.timerId);
  const acc = GAME.total ? Math.round(100*GAME.correct/GAME.total) : 0;
  $('finalName').textContent = GAME.name;
  $('finalScore').textContent = String(GAME.score);
  $('accuracy').textContent = acc + '%';
  if (typeof buildShareUrl === 'function') {
    $('shareX').href = buildShareUrl({ name: GAME.name, score: GAME.score, acc, seconds: GAME.timeLimit - GAME.time });
  }
  setScreen('screen-end');
}
