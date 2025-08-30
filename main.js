/* v3_14 — less repetition, white credit, nicer card stack, negative scores, game over only on time */
const GAME = {
  timeLimit: 60,
  maxCards: 100,
  score: 0, correct: 0, total: 0,
  time: 60, timerId: null,
  name: 'Player',
  deckEl: null,
  pool: [], ptr: 0
};

const $  = (id)=>document.getElementById(id);
const qs = (sel)=>document.querySelector(sel);

function setScreen(which){
  ['screen-start','screen-game','screen-end'].forEach(id=>{
    const el=$(id); if(!el)return;
    id===which ? el.classList.add('active') : el.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  $('startBtn').addEventListener('click', async ()=>{
    GAME.name = $('nickname').value.trim() || 'Player';
    const hn = qs('#hudName'); if (hn) hn.textContent = GAME.name;
    setScreen('screen-game');
    await startGame();
  });
  $('btnReal').addEventListener('click', ()=> swipeTop('right'));
  $('btnFake').addEventListener('click', ()=> swipeTop('left'));
  $('playAgain').addEventListener('click', ()=> setScreen('screen-start'));
  GAME.deckEl=$('deck');
});

/* --------- images & handles ---------- */
function unavatarFast(handle){
  const h = String(handle||'').replace(/^@+/, '');
  const raw = `unavatar.io/twitter/${encodeURIComponent(h)}`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}&w=256&h=256&fit=cover`;
}
function robo(seed){ return `https://robohash.org/${encodeURIComponent(seed)}.png?set=set3`; }
function showError(msg){ const box=$('errorBox'); if(box){ box.style.display='block'; box.textContent=msg; } else alert(msg); }

async function tryFetchHandles(){
  const paths=['handles.json','/handles.json','./handles.json'];
  let last; for(const p of paths){
    try{
      const r=await fetch(p,{cache:'no-store'});
      if(!r.ok) throw new Error(p+' -> '+r.status);
      const d=await r.json();
      if(!d || !Array.isArray(d.handles)) throw new Error(p+' missing {"handles":[]}');
      return d.handles;
    }catch(e){ last=e; }
  }
  throw last || new Error('handles.json not found');
}

function loadWithTimeout(url,t=1800){
  return new Promise(res=>{
    const img=new Image(); let done=false;
    const fin=(ok)=>{ if(!done){ done=true; res(!!ok); } };
    const to=setTimeout(()=>fin(false),t);
    img.onload=()=>{clearTimeout(to);fin(true)};
    img.onerror=()=>{clearTimeout(to);fin(false)};
    img.decoding='async'; img.loading='eager'; img.referrerPolicy='no-referrer';
    img.src=url;
  });
}
async function preloadItems(items,t=1600,conc=6){
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
async function warmSwapReal(items,t=4000){
  for(const it of items){
    if(it.label!=='human'||!it._fellback||!it.realSrc) continue;
    const ok=await loadWithTimeout(it.realSrc,t);
    if(ok){ const el=document.querySelector(`[data-id="${it.id}"] img`); if(el) el.src=it.realSrc; }
  }
}

/* --------- repetition control (recent cache) ---------- */
const RECENT_KEY='billions_recent_handles_v1';
function loadRecent(){
  try{ return new Set(JSON.parse(localStorage.getItem(RECENT_KEY)||'[]')); }
  catch{ return new Set(); }
}
function saveRecent(set, cap=500){
  const arr=Array.from(set);
  const trimmed=arr.slice(Math.max(0, arr.length-cap));
  localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed));
}
function randInt(n){ return Math.floor(Math.random()*n); }
function pickUnique(handles, count, recentSet){
  const uniq = Array.from(new Set(handles));
  const pool = uniq.filter(h=>!recentSet.has(h));
  const take = Math.min(count, pool.length);
  const chosen=[];
  // Fisher–Yates
  for(let i=0;i<take;i++){
    const j=i+randInt(pool.length-i);
    [pool[i],pool[j]]=[pool[j],pool[i]];
    chosen.push(pool[i]);
  }
  if(chosen.length < count){
    const rest = uniq.filter(h=>!chosen.includes(h));
    while(chosen.length < count && rest.length){
      const k=randInt(rest.length);
      chosen.push(rest.splice(k,1)[0]);
    }
  }
  return chosen;
}

/* --------- pool builder (no artificial duplicates) ---------- */
async function buildPoolFromOnline(){
  const handles = await tryFetchHandles();
  if(!Array.isArray(handles)||!handles.length) throw new Error('No handles');

  const recent = loadRecent();
  const humanCount = Math.min(GAME.maxCards, Math.max(20, Math.floor(handles.length*0.2)));
  const chosenHumans = pickUnique(handles, humanCount, recent);

  chosenHumans.forEach(h=>recent.add(h));
  saveRecent(recent);

  let id=1;
  const humans = chosenHumans.map(h=>{
    const src=unavatarFast(h);
    return { id:'card-'+(id++), src, realSrc:src, label:'human', handle:h };
  });
  const bots = Array.from({length:humans.length},(_,i)=>({
    id:'card-'+(id++), src:robo('bills-bot-'+Date.now()+'-'+i), label:'bot'
  }));

  return [...humans, ...bots].sort(()=>Math.random()-0.5);
}

/* --------- game flow ---------- */
async function ensureDeck(minCount=1, batchSize=8){
  const left = GAME.deckEl.querySelectorAll('.card').length;
  if(left >= minCount) return;

  if(GAME.ptr >= (GAME.pool?.length||0)){
    try{ GAME.pool = await buildPoolFromOnline(); GAME.ptr = 0; }
    catch{}
  }

  const take=[];
  while(take.length<batchSize && GAME.ptr<GAME.pool.length){
    take.push(GAME.pool[GAME.ptr++]);
  }

  await preloadItems(take, 1500, 6);
  for(let i=take.length-1;i>=0;i--) createCard(take[i]);
  warmSwapReal(take, 5000);
}

async function startGame(){
  clearInterval(GAME.timerId);
  GAME.deckEl.innerHTML='';
  GAME.score=0; GAME.correct=0; GAME.total=0;
  GAME.time=GAME.timeLimit;
  $('score').textContent='0'; $('time').textContent=String(GAME.time);

  try{
    GAME.pool = await buildPoolFromOnline();
    GAME.ptr = 0;
  }catch(e){
    showError('Could not load handles.json or images.');
    setScreen('screen-start'); return;
  }

  await ensureDeck(1, 8);

  GAME.timerId=setInterval(()=>{
    GAME.time--; $('time').textContent=String(GAME.time);
    if(GAME.time<=0){ endGame(); }
    else{ ensureDeck(1, 6); }
  }, 1000);
}

function createCard(it){
  const card=document.createElement('div');
  card.className='card'; card.dataset.label=it.label; card.dataset.id=it.id;
  const img=document.createElement('img');
  img.alt = it.label==='human' ? 'Real Human' : 'Fake/Bot';
  img.decoding='async'; img.loading='lazy'; img.src=it.src;
  card.append(img);
  GAME.deckEl.appendChild(card);
  attachGesture(card);
}

function attachGesture(card){
  let sx=0,sy=0,dx=0,dy=0,drag=false;
  const start=(x,y)=>{drag=true;sx=x;sy=y;card.style.transition='none';};
  const move =(x,y)=>{if(!drag)return;dx=x-sx;dy=y-sy;const rot=dx/20;card.style.transform=`translate(${dx}px,${dy}px) rotate(${rot}deg)`;};
  const end  =()=>{if(!drag)return;drag=false;const th=100;
    if(dx>th) swipe(card,'right');
    else if(dx<-th) swipe(card,'left');
    else{card.style.transition='transform .18s ease';card.style.transform='';}
  };
  card.addEventListener('mousedown',e=>start(e.clientX,e.clientY));
  window.addEventListener('mousemove',e=>move(e.clientX,e.clientY));
  window.addEventListener('mouseup',end);
  card.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY);},{passive:true});
  card.addEventListener('touchmove',e=>{const t=e.touches[0];move(t.clientX,t.clientY);},{passive:true});
  card.addEventListener('touchend',end);
}

function swipeTop(dir){
  const top=GAME.deckEl.querySelector('.card:last-child');
  if(top) swipe(top,dir);
}

function swipe(card,dir){
  const dx = dir==='right' ? 800 : -800;
  card.style.transition='transform .22s ease';
  card.style.transform=`translate(${dx}px,0) rotate(${dir==='right'?20:-20}deg)`;

  const label=card.dataset.label;
  const ok=(dir==='right'&&label==='human')||(dir==='left'&&label==='bot');
  GAME.total++;
  if(ok){ GAME.score++; GAME.correct++; } else { GAME.score--; } // negatif skor mümkün
  $('score').textContent=String(GAME.score);

  setTimeout(()=>{
    card.remove();
    if(GAME.time>0 && !GAME.deckEl.querySelector('.card')){
      ensureDeck(1, 6);
    }
  }, 200);
}

function endGame(){
  clearInterval(GAME.timerId);
  const acc=GAME.total?Math.round(100*GAME.correct/GAME.total):0;
  $('finalName').textContent=GAME.name;
  $('finalScore').textContent=String(GAME.score);
  $('accuracy').textContent=acc+'%';
  if(typeof buildShareUrl==='function'){
    $('shareX').href=buildShareUrl({name:GAME.name,score:GAME.score,acc,seconds:GAME.timeLimit-GAME.time});
  }
  setScreen('screen-end');
}
