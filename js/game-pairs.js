/* Virotos Games 002 — Pairs 0.9.7. Never credit VP in the browser. */
import { API_BASE } from './data/game2048-config.js';
import { readAuthToken } from './virotos-auth.js';

const API=String(API_BASE||'').replace(/\/+$/,'');
const icons=['🎵','💎','🎁','⚡','🌙','⭐','💙','🎮'];
const byId=id=>document.getElementById(id);
const board=byId('pairsBoard');
const nodes={moves:byId('pairsMoves'),found:byId('pairsFound'),time:byId('pairsTime'),
  best:byId('pairsBest'),msg:byId('pairsMessage'),mode:byId('pairsMode'),retry:byId('pairsRetry')};
const restart=byId('pairsRestart');
const recordKey='virotos:pairs:best:v1';
let deck=[],selected=[],moves=0,found=0,startedAt=0,finished=false,locked=false;
let timer=null,flipDelay=null,run=0,session=null,trace=[],pendingFinish=null;
const formatTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
const bestRecord=()=>{try{return JSON.parse(localStorage.getItem(recordKey)||'null');}catch{return null;}};
const saveRecord=value=>{try{localStorage.setItem(recordKey,JSON.stringify(value));}catch{}};
function renderBest(){const x=bestRecord();nodes.best.textContent=x?`${x.moves} ход. / ${formatTime(x.seconds)}`:'—';}
function previewReward(n,seconds){
  const accuracy=n<=10?16:n<=14?10:n<=20?6:0;
  return {accuracy,speed:seconds<=30?4:0,total:accuracy+(seconds<=30?4:0)};
}
function updateStats(){
  nodes.moves.textContent=String(moves);nodes.found.textContent=`${found} / 8`;
  nodes.time.textContent=formatTime(startedAt?Math.floor((Date.now()-startedAt)/1000):0);
}
function shuffle(array){
  for(let i=array.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}
  return array;
}
async function call(path,token,body){
  if(!API)throw Error('Сервер VP не настроен');
  const r=await fetch(API+path,{
    method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify(body||{})
  });
  const result=await r.json().catch(()=>({error:'Некорректный ответ сервера'}));
  if(!r.ok)throw Error(result.error||'Ошибка сервера');
  return result;
}
function showMode(text){nodes.mode.textContent=text;}
function mark(button,visible,matched){
  button.dataset.open=String(visible);button.dataset.matched=String(matched);
  button.textContent=visible?button.dataset.symbol:'?';
  button.setAttribute('aria-label',matched?'Пара найдена':visible?'Открыта: '+button.dataset.symbol:'Закрытая карточка');
  button.disabled=matched;
}
async function sendResult(result){
  const currentRun=run;
  nodes.retry.hidden=true;
  try{
    const credited=await call('/api/pairs/finish',result.token,{id:result.id,picks:result.picks});
    if(run!==currentRun)return;
    pendingFinish=null;
    nodes.msg.textContent=`Все 8 пар! ${credited.moves||moves} ходов. Начислено: +${credited.vpAwarded} VP. За сегодня в «Парах»: ${credited.dailyPairsVP}/20 VP.${credited.alreadySaved?' Результат уже сохранён.':''}`;
    showMode(credited.vpAwarded>0?'Telegram подтверждён · VP начислены сервером':'Telegram подтверждён · сервер проверил результат, повторного начисления нет');
  }catch(e){
    if(run!==currentRun)return;
    pendingFinish=result;
    nodes.msg.textContent=`Партия завершена, но VP пока НЕ подтверждены: ${e.message}. Попробуй повторную проверку.`;
    nodes.retry.hidden=false;
    showMode('Начисление не подтверждено · результат можно отправить повторно');
  }
}
function finish(){
  finished=true;clearInterval(timer);timer=null;
  const seconds=Math.floor((Date.now()-startedAt)/1000);
  const record={moves,seconds},old=bestRecord();
  const isBest=!old||record.moves<old.moves||(record.moves===old.moves&&record.seconds<old.seconds);
  if(isBest)saveRecord(record);
  renderBest();
  if(!session){
    const reward=previewReward(moves,seconds);
    nodes.msg.textContent=`Все 8 пар! ${moves} ходов за ${formatTime(seconds)}.${isBest?' Новый рекорд!':''} Тренировка: возможный результат ${reward.total} VP. Баланс не изменён.`;
    return;
  }
  nodes.msg.textContent='Партия окончена. Проверяем ходы и начисление VP на сервере…';
  pendingFinish={id:session.id,token:session.token,picks:trace.slice()};
  void sendResult(pendingFinish);
}
function flip(i){
  if(locked||finished||!deck[i]||deck[i].matched||selected.includes(i))return;
  selected.push(i);mark(deck[i].button,true,false);
  if(selected.length!==2)return;
  const [a,b]=selected;
  trace.push(a,b);moves++;updateStats();
  if(deck[a].symbol===deck[b].symbol){
    deck[a].matched=deck[b].matched=true;
    mark(deck[a].button,true,true);mark(deck[b].button,true,true);
    found++;selected=[];updateStats();
    if(found===8)finish();
  }else{
    locked=true;
    const gen=run;
    flipDelay=setTimeout(()=>{
      if(run!==gen)return;
      mark(deck[a].button,false,false);mark(deck[b].button,false,false);
      selected=[];locked=false;flipDelay=null;
    },770);
  }
}
async function start(){
  const gen=++run;
  clearInterval(timer);clearTimeout(flipDelay);
  timer=null;flipDelay=null;
  moves=0;found=0;startedAt=0;finished=false;locked=true;selected=[];trace=[];session=null;pendingFinish=null;
  board.replaceChildren();nodes.time.textContent='00:00';nodes.msg.textContent='Подготавливаем новую партию…';nodes.retry.hidden=true;
  restart.disabled=true;updateStats();renderBest();
  let indices=null;
  const token=readAuthToken();
  if(token){
    try{
      const response=await call('/api/pairs/start',token,{});
      if(gen!==run)return;
      if(!Array.isArray(response.deck)||response.deck.length!==16||
         response.deck.some(n=>!Number.isInteger(n)||n<0||n>7))throw Error('Сервер прислал неверное поле');
      indices=response.deck;
      session={id:response.id,token};
      startedAt=Number(response.createdAt)||Date.now();
      showMode(`Telegram подтверждён · за сегодня: ${response.dailyPairsVP}/20 VP · отсчёт времени начат`);
    }catch(e){
      if(gen!==run)return;
      showMode(`Тренировка без VP: ${e.message}. Для входа открой магазин Virotos.`);
    }
  }else showMode('Тренировка без VP · войди через Telegram в магазине, затем начни новую партию');
  if(!indices)indices=shuffle([...Array(8).keys(),...Array(8).keys()]);
  if(!startedAt)startedAt=Date.now();
  if(gen!==run)return;
  deck=indices.map(index=>({symbol:icons[index],matched:false,button:null}));
  deck.forEach((item,i)=>{
    const button=document.createElement('button');button.type='button';button.className='pairs-card';
    button.dataset.symbol=item.symbol;mark(button,false,false);
    button.addEventListener('click',()=>flip(i));item.button=button;board.append(button);
  });
  locked=false;restart.disabled=false;
  nodes.msg.textContent='Открой две карточки и найди одинаковые символы.';
  timer=setInterval(updateStats,500);updateStats();
}
restart.addEventListener('click',()=>void start());
nodes.retry?.addEventListener('click',()=>{if(pendingFinish)void sendResult(pendingFinish);});
byId('year').textContent=String(new Date().getFullYear());
void start();
