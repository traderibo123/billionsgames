const GAME = {
  timeLimit: 60,
  maxCards: 36,
  deckEl: null,
  score: 0, correct: 0, total: 0,
  time: 60, timerId: null,
  name: 'Player',
};

const $ = (id)=>document.getElementById(id);
const qs = (sel)=>document.querySelector(sel);


// --- diagnostics & error helper ---
function showError(msg){
  const box = document.getElementById('errorBox');
  if(box){ box.style.display='block'; box.textContent = msg; }
  else alert(msg);
}

async function tryFetchHandles(){
  const paths = ['handles.json', '/handles.json', './handles.json'];
  let lastErr = null;
  for(const p of paths){
    try{
      const res = await fetch(p, { cache:'no-store' });
      if(!res.ok) throw new Error(p + ' -> ' + res.status + ' ' + res.statusText);
      const data = await res.json();
      if(!data || !Array.isArray(data.handles)) throw new Error(p + ' does not contain {"handles": [...] }');
      return data.handles;
    }catch(e){
      lastErr = e;
      console.warn('handles.json load failed for', p, e);
    }
  }
  throw lastErr || new Error('All handles.json paths failed');
}


document.addEventListener('DOMContentLoaded', () => {
  const screenStart = $('screen-start');
  const screenGame = $('screen-game');
  const screenEnd  = $('screen-end');

  $('startBtn').addEventListener('click', async () => {
    const name = $('nickname').value.trim();
    GAME.name = name || 'Player';
    qs('#hudName').textContent = GAME.name;

    screenStart.classList.add('hidden');
    screenGame.classList.remove('hidden');

    await startGame();
  });

  $('diagBtn').addEventListener('click', async ()=>{
    try{
      const handles = await tryFetchHandles();
      showError('✅ handles.json reachable. Count: ' + handles.length);
    }catch(e){
      showError('❌ ' + (e && e.message ? e.message : String(e)));
    }
  });

  $('btnReal').addEventListener('click', ()=> swipeTop('right'));
  $('btnFake').addEventListener('click', ()=> swipeTop('left'));
  $('playAgain').addEventListener('click', () => {
    screenEnd.classList.add('hidden');
    $('screen-start').classList.remove('hidden');
  });

  GAME.deckEl = $('deck');
});

async function startGame(){
  clearInterval(GAME.timerId);
  GAME.deckEl.innerHTML = '';
  GAME.score = 0; GAME.correct = 0; GAME.total = 0; GAME.time = GAME.timeLimit;
  $('score').textContent = '0'; $('time').textContent = String(GAME.time);
  $('screen-end').classList.add('hidden');

  let pool = [];
  try {
    pool = await buildPoolFromOnline();
  } catch (e) {
    console.error('Failed to build pool', e);
    alert('Could not load handles.json or images. Make sure the file exists next to index.html.');
    return;
  }

  await preload(pool.map(x=>x.src));

  for(let i = pool.length - 1; i >= 0; i--){
    createCard(pool[i]);
  }

  GAME.timerId = setInterval(()=>{
    GAME.time--;
    $('time').textContent = String(GAME.time);
    if(GAME.time <= 0) endGame();
  }, 1000);
}

async function buildPoolFromOnline(){
  const all = await tryFetchHandles();
  if(!Array.isArray(all) || all.length === 0) throw new Error('No handles provided');

  const shuffled = all.slice().sort(()=>Math.random()-0.5);
  const batch = shuffled.slice(0, Math.max(24, Math.min(GAME.maxCards, all.length)));

  const humans = batch.map(h => ({ src: unavatar(h), label: 'human' }));
  const bots = Array.from({length: batch.length}, (_,i) => ({ src: robo('billions-bot-'+Date.now()+'-'+i), label: 'bot' }));

  return [...humans, ...bots].sort(()=>Math.random()-0.5);
}

function unavatar(handle){
  const h = String(handle||'').replace(/^@+/, '');
  return `https://unavatar.io/twitter/${encodeURIComponent(h)}?fallback=false`;
}
function robo(seed){
  return `https://robohash.org/${encodeURIComponent(seed)}.png?set=set3`;
}

function preload(srcs){
  return Promise.all(srcs.map(src => new Promise(res => {
    const img = new Image();
    img.onload = res; img.onerror = res;
    img.referrerPolicy = 'no-referrer';
    img.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  })));
}

function createCard(item){
  const card = document.createElement('div');
  card.className = 'card'; card.dataset.label = item.label;

  const img = document.createElement('img');
  img.alt = item.label === 'human' ? 'Real Human' : 'Fake/Bot';
  img.src = item.src;

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = 'Swipe: ← Fake | Real →';

  const hintReal = document.createElement('div');
  hintReal.className = 'hint real'; hintReal.textContent = 'REAL →';
  const hintFake = document.createElement('div');
  hintFake.className = 'hint fake'; hintFake.textContent = '← FAKE';

  card.append(img, badge, hintReal, hintFake);
  GAME.deckEl.appendChild(card);

  attachGesture(card);
}

function attachGesture(card){
  let startX=0, startY=0, curX=0, curY=0, dragging=false;

  const onStart = (x,y)=>{ dragging=true; startX=x; startY=y; card.style.transition='none'; };
  const onMove = (x,y)=>{
    if(!dragging) return;
    curX = x-startX; curY=y-startY;
    const rot = curX/20;
    card.style.transform = `translate(${curX}px, ${curY}px) rotate(${rot}deg)`;

    const hintReal = card.querySelector('.hint.real');
    const hintFake = card.querySelector('.hint.fake');
    const opacity = Math.min(Math.abs(curX)/80, 1);
    if(curX>0){ hintReal.style.opacity=opacity; hintFake.style.opacity=0; }
    else if(curX<0){ hintFake.style.opacity=opacity; hintReal.style.opacity=0; }
    else { hintReal.style.opacity=0; hintFake.style.opacity=0; }
  };
  const onEnd = ()=>{
    if(!dragging) return; dragging=false;
    const threshold = 100;
    if(curX > threshold) swipe(card, 'right');
    else if(curX < -threshold) swipe(card, 'left');
    else {
      card.style.transition='transform .18s ease'; card.style.transform='';
      card.querySelector('.hint.real').style.opacity=0;
      card.querySelector('.hint.fake').style.opacity=0;
    }
  };

  // Mouse
  card.addEventListener('mousedown', e=>onStart(e.clientX,e.clientY));
  window.addEventListener('mousemove', e=>onMove(e.clientX,e.clientY));
  window.addEventListener('mouseup', onEnd);

  // Touch
  card.addEventListener('touchstart', e=>{ const t=e.touches[0]; onStart(t.clientX,t.clientY); }, {passive:true});
  card.addEventListener('touchmove',  e=>{ const t=e.touches[0]; onMove(t.clientX,t.clientY); }, {passive:true});
  card.addEventListener('touchend', onEnd);
}

function swipeTop(direction){
  const top = GAME.deckEl.querySelector('.card:last-child');
  if(top) swipe(top, direction);
}

function swipe(card, direction){
  const dx = direction==='right' ? 800 : -800;
  card.style.transition='transform .22s ease';
  card.style.transform = `translate(${dx}px, 0) rotate(${direction==='right'?20:-20}deg)`;

  const label = card.dataset.label;
  const correct = (direction==='right' && label==='human') || (direction==='left' && label==='bot');

  GAME.total++;
  if(correct){ GAME.score++; GAME.correct++; }
  else { GAME.score = Math.max(0, GAME.score-1); }

  $('score').textContent = String(GAME.score);

  setTimeout(()=>{
    card.remove();
    if(!GAME.deckEl.querySelector('.card')) endGame();
  }, 200);
}

function endGame(){
  clearInterval(GAME.timerId);
  const acc = GAME.total ? Math.round(100*GAME.correct/GAME.total) : 0;
  $('finalName').textContent = GAME.name;
  $('finalScore').textContent = String(GAME.score);
  $('accuracy').textContent = acc + '%';
  $('shareX').href = buildShareUrl({ name: GAME.name, score: GAME.score, acc, seconds: GAME.timeLimit - GAME.time });

  $('screen-game').classList.add('hidden');
  $('screen-end').classList.remove('hidden');
}
