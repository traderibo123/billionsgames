const GAME = {
  timeLimit: 60,     // seconds
  maxCards: 36,      // per run (sample from handles.json to avoid too many requests)
  deckEl: null,
  score: 0, correct: 0, total: 0, time: 60, timerId: null,
};

const $ = (id)=>document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  GAME.deckEl = $('deck');
  $('startBtn').addEventListener('click', startGame);
  $('restart').addEventListener('click', resetGame);
  $('btnReal').addEventListener('click', ()=> swipeTop('right'));
  $('btnFake').addEventListener('click', ()=> swipeTop('left'));
  $('playAgain').addEventListener('click', startGame);
});

async function startGame(){
  clearInterval(GAME.timerId);
  GAME.deckEl.innerHTML = '';
  GAME.score = 0; GAME.correct = 0; GAME.total = 0; GAME.time = GAME.timeLimit;
  $('score').textContent = '0'; $('time').textContent = String(GAME.time);
  $('result').classList.add('hidden');

  const pool = await buildPoolFromOnline();
  await preload(pool.map(x=>x.src));

  // create cards top→bottom
  for(let i = pool.length - 1; i >= 0; i--){
    createCard(pool[i]);
  }

  GAME.timerId = setInterval(()=>{
    GAME.time--;
    $('time').textContent = String(GAME.time);
    if(GAME.time <= 0) endGame();
  }, 1000);
}

function resetGame(){
  clearInterval(GAME.timerId);
  GAME.deckEl.innerHTML = '';
  $('score').textContent = '0'; $('time').textContent = String(GAME.timeLimit);
  $('result').classList.add('hidden');
}

async function buildPoolFromOnline(){
  // load handles.json
  const res = await fetch('handles.json', { cache: 'no-store' });
  const all = (await res.json()).handles || [];
  // sample a subset each run
  const shuffled = all.slice().sort(()=>Math.random()-0.5);
  const batch = shuffled.slice(0, Math.max(24, Math.min(GAME.maxCards, all.length)));

  const humans = batch.map(h => ({ src: unavatar(h), label: 'human' }));
  const bots = Array.from({length: batch.length}, (_,i) => ({ src: robo('billions-bot-'+Date.now()+'-'+i), label: 'bot' }));

  // mix & return
  return [...humans, ...bots].sort(()=>Math.random()-0.5);
}

function unavatar(handle){
  const h = String(handle||'').replace(/^@+/, '');
  // Try twitter first; fallback to platform-agnostic unavatar
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
  $('finalScore').textContent = String(GAME.score);
  $('accuracy').textContent = acc + '%';
  $('shareX').href = buildShareUrl({ score: GAME.score, acc, seconds: GAME.timeLimit - GAME.time });
  $('result').classList.remove('hidden');
}
