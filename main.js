/* v3_7 — three distinct screens */
const GAME = { timeLimit:60, maxCards:28, deckEl:null, score:0, correct:0, total:0, time:60, timerId:null, name:'Player' };
const $=(id)=>document.getElementById(id); const qs=(sel)=>document.querySelector(sel);

function setScreen(which){
  ['screen-start','screen-game','screen-end'].forEach(id=>{
    const el=$(id); if(!el)return;
    id===which ? el.classList.add('active') : el.classList.remove('active');
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  $('startBtn').addEventListener('click', async ()=>{
    const name=$('nickname').value.trim();
    GAME.name=name||'Player';
    qs('#hudName').textContent=GAME.name;
    setScreen('screen-game');
    await startGame();
  });
  $('diagBtn').addEventListener('click', async ()=>{
    try{const h=await tryFetchHandles();showError('✅ handles.json reachable. Count: '+h.length);}
    catch(e){showError('❌ '+(e&&e.message?e.message:String(e)));}
  });
  $('demoBtn').addEventListener('click', async ()=>{setScreen('screen-game');await startGame(true);});
  $('btnReal').addEventListener('click',()=>swipeTop('right'));
  $('btnFake').addEventListener('click',()=>swipeTop('left'));
  $('playAgain').addEventListener('click',()=>setScreen('screen-start'));
  GAME.deckEl=$('deck');
});

// --- helpers ---
function unavatarFast(handle){const h=String(handle||'').replace(/^@+/,'');const raw=`unavatar.io/twitter/${encodeURIComponent(h)}`;return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}&w=256&h=256&fit=cover`;}
function robo(seed){return `https://robohash.org/${encodeURIComponent(seed)}.png?set=set3`;}
function showError(msg){const box=$('errorBox');if(box){box.style.display='block';box.textContent=msg;}else alert(msg);}
async function tryFetchHandles(){const paths=['handles.json','/handles.json','./handles.json'];let last;for(const p of paths){try{const r=await fetch(p,{cache:'no-store'});if(!r.ok)throw new Error(p+' -> '+r.status);const d=await r.json();if(!d||!Array.isArray(d.handles))throw new Error(p+' missing {"handles":[]}');return d.handles;}catch(e){last=e;}}throw last||new Error('handles.json not found');}

function loadWithTimeout(url,t=2000){return new Promise(res=>{const img=new Image();let done=false;const fin=(ok)=>{if(!done){done=true;res(!!ok);}};const to=setTimeout(()=>fin(false),t);img.onload=()=>{clearTimeout(to);fin(true)};img.onerror=()=>{clearTimeout(to);fin(false)};img.decoding='async';img.loading='eager';img.referrerPolicy='no-referrer';img.src=url;});}
async function preloadItems(items,t=2000,conc=6){let i=0;async function worker(){while(i<items.length){const k=i++;const it=items[k];const ok=await loadWithTimeout(it.src,t);if(!ok&&it.label==='human'){it._fellback=true;it.src=robo('fallback-'+Math.random());await loadWithTimeout(it.src,1500);}}}await Promise.all(Array.from({length:Math.min(conc,Math.max(1,items.length))},worker));}
async function warmSwapReal(items,t=4000){for(const it of items){if(it.label!=='human'||!it._fellback||!it.realSrc)continue;const ok=await loadWithTimeout(it.realSrc,t);if(ok){const el=document.querySelector(`[data-id="${it.id}"] img`);if(el)el.src=it.realSrc;}}}

async function startGame(demo=false){
  clearInterval(GAME.timerId);GAME.deckEl.innerHTML='';GAME.score=0;GAME.correct=0;GAME.total=0;GAME.time=GAME.timeLimit;
  $('score').textContent='0';$('time').textContent=String(GAME.time);
  let pool=[];try{pool=demo?buildDemoPool():await buildPoolFromOnline();}catch(e){showError('Could not load handles.json or images.');setScreen('screen-start');return;}
  const STAGE=8;const stage1=pool.slice(0,STAGE);const stage2=pool.slice(STAGE);
  await preloadItems(stage1,1700,6);for(let i=stage1.length-1;i>=0;i--)createCard(stage1[i]);
  preloadItems(stage2,2100,6).then(()=>{for(let i=stage2.length-1;i>=0;i--)createCard(stage2[i]);warmSwapReal(pool,5000);});
  GAME.timerId=setInterval(()=>{GAME.time--;$('time').textContent=String(GAME.time);if(GAME.time<=0)endGame();},1000);
}

function buildDemoPool(){let id=1;const bots=Array.from({length:12},(_,i)=>({id:'card-'+(id++),src:robo('demo-bot-'+i),label:'bot'}));const humans=Array.from({length:12},(_,i)=>({id:'card-'+(id++),src:robo('demo-human-'+i),label:'human'}));return [...humans,...bots].sort(()=>Math.random()-0.5);}
async function buildPoolFromOnline(){const all=await tryFetchHandles();if(!Array.isArray(all)||!all.length)throw new Error('No handles');const sh=all.slice().sort(()=>Math.random()-0.5);const batch=sh.slice(0,Math.max(20,Math.min(GAME.maxCards,all.length)));let id=1;const humans=batch.map(h=>{const src=unavatarFast(h);return{id:'card-'+(id++),src,realSrc:src,label:'human'};});const bots=Array.from({length:batch.length},(_,i)=>({id:'card-'+(id++),src:robo('bills-bot-'+Date.now()+'-'+i),label:'bot'}));return [...humans,...bots].sort(()=>Math.random()-0.5);}

function createCard(it){const card=document.createElement('div');card.className='card';card.dataset.label=it.label;card.dataset.id=it.id;const img=document.createElement('img');img.alt=it.label==='human'?'Real Human':'Fake/Bot';img.decoding='async';img.loading='lazy';img.src=it.src;card.append(img);GAME.deckEl.appendChild(card);attachGesture(card);}
function attachGesture(card){let sx=0,sy=0,dx=0,dy=0,drag=false;const start=(x,y)=>{drag=true;sx=x;sy=y;card.style.transition='none';};const move=(x,y)=>{if(!drag)return;dx=x-sx;dy=y-sy;const rot=dx/20;card.style.transform=`translate(${dx}px,${dy}px) rotate(${rot}deg)`;};const end=()=>{if(!drag)return;drag=false;const th=100;if(dx>th)swipe(card,'right');else if(dx<-th)swipe(card,'left');else{card.style.transition='transform .18s ease';card.style.transform='';}};card.addEventListener('mousedown',e=>start(e.clientX,e.clientY));window.addEventListener('mousemove',e=>move(e.clientX,e.clientY));window.addEventListener('mouseup',end);card.addEventListener('touchstart',e=>{const t=e.touches[0];start(t.clientX,t.clientY);},{passive:true});card.addEventListener('touchmove',e=>{const t=e.touches[0];move(t.clientX,t.clientY);},{passive:true});card.addEventListener('touchend',end);}
function swipeTop(dir){const top=GAME.deckEl.querySelector('.card:last-child');if(top)swipe(top,dir);}
function swipe(card,dir){const dx=dir==='right'?800:-800;card.style.transition='transform .22s ease';card.style.transform=`translate(${dx}px,0) rotate(${dir==='right'?20:-20}deg)`;const label=card.dataset.label;const ok=(dir==='right'&&label==='human')||(dir==='left'&&label==='bot');GAME.total++;if(ok){GAME.score++;GAME.correct++;}else{GAME.score=Math.max(0,GAME.score-1);}$('score').textContent=String(GAME.score);setTimeout(()=>{card.remove();if(!GAME.deckEl.querySelector('.card'))endGame();},200);}
function endGame(){clearInterval(GAME.timerId);const acc=GAME.total?Math.round(100*GAME.correct/GAME.total):0;$('finalName').textContent=GAME.name;$('finalScore').textContent=String(GAME.score);$('accuracy').textContent=acc+'%';if(typeof buildShareUrl==='function'){$('shareX').href=buildShareUrl({name:GAME.name,score:GAME.score,acc,seconds:GAME.timeLimit-GAME.time});}setScreen('screen-end');}
