/* Virotos Games 002: client-only memory game. No VP actions or API requests. */
(() => {
  'use strict';
  const symbols = ['🎵','💎','🎁','⚡','🌙','⭐','💙','🎮'];
  const board = document.getElementById('pairsBoard');
  const movesNode = document.getElementById('pairsMoves');
  const foundNode = document.getElementById('pairsFound');
  const timeNode = document.getElementById('pairsTime');
  const bestNode = document.getElementById('pairsBest');
  const messageNode = document.getElementById('pairsMessage');
  const restart = document.getElementById('pairsRestart');
  let deck = [], selected = [], moves = 0, found = 0, startedAt = null, finished = false, locked = false, timer = null, flipDelay = null, run = 0;
  const storageKey = 'virotos:pairs:best:v1';
  const formatTime = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  function bestRecord(){try{return JSON.parse(localStorage.getItem(storageKey)||'null');}catch{return null;}}
  function saveRecord(val){try{localStorage.setItem(storageKey,JSON.stringify(val));}catch{}}
  function renderBest(){const x=bestRecord();bestNode.textContent=x?`${x.moves} ход. / ${formatTime(x.seconds)}`:'—';}
  function updateStats(){movesNode.textContent=String(moves);foundNode.textContent=`${found} / 8`;if(startedAt){timeNode.textContent=formatTime(Math.floor((Date.now()-startedAt)/1000));}}
  function shuffle(arr){for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
  function mark(button,visible,matched){button.dataset.open=String(visible);button.dataset.matched=String(matched);button.textContent=visible?button.dataset.symbol:'?';button.setAttribute('aria-label',matched?'Пара найдена':visible?'Открыта: '+button.dataset.symbol:'Закрытая карточка');button.disabled=matched;}
  function finish(){finished=true;clearInterval(timer);timer=null;const seconds=Math.floor((Date.now()-startedAt)/1000);const record={moves,seconds};const best=bestRecord();if(!best||record.moves<best.moves||(record.moves===best.moves&&record.seconds<best.seconds)){saveRecord(record);messageNode.textContent=`Победа! ${moves} попыток за ${formatTime(seconds)}. Новый рекорд!`;}else{messageNode.textContent=`Все пары найдены! ${moves} попыток, ${formatTime(seconds)}.`;}renderBest();}
  function flip(i){if(locked||finished||deck[i].matched||selected.includes(i))return;if(!startedAt){startedAt=Date.now();timer=setInterval(updateStats,1000);}selected.push(i);mark(deck[i].button,true,false);if(selected.length!==2)return;moves++;updateStats();const [a,b]=selected;if(deck[a].symbol===deck[b].symbol){deck[a].matched=deck[b].matched=true;mark(deck[a].button,true,true);mark(deck[b].button,true,true);found++;selected=[];updateStats();if(found===8)finish();}else{locked=true;const gen=run;flipDelay=setTimeout(()=>{if(run!==gen)return;mark(deck[a].button,false,false);mark(deck[b].button,false,false);selected=[];locked=false;flipDelay=null;},770);}}
  function start(){run++;clearInterval(timer);clearTimeout(flipDelay);timer=null;flipDelay=null;moves=0;found=0;startedAt=null;finished=false;locked=false;selected=[];timeNode.textContent='00:00';messageNode.textContent='Открой две карточки и найди одинаковые символы.';board.replaceChildren();deck=shuffle([...symbols,...symbols]).map(symbol=>({symbol,matched:false,button:null}));deck.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.className='pairs-card';b.dataset.symbol=item.symbol;mark(b,false,false);b.addEventListener('click',()=>flip(i));item.button=b;board.appendChild(b);});updateStats();renderBest();}
  restart.addEventListener('click',start);
  document.getElementById('year').textContent=String(new Date().getFullYear());
  start();
})();
