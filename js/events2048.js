import { API_BASE } from './data/game2048-config.js';
const API=API_BASE.trim().replace(/\/+$/,'');
const $=id=>document.getElementById(id);
let events=[],selectedId='',clockDelta=0;
const stateAt=(t,now)=>t.closedAt!=null||now>=t.endsAt?'finished':now<t.startsAt?'upcoming':'active';
const formatDate=ms=>new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function remaining(ms){const n=Math.max(0,Math.ceil(ms/1000)),d=Math.floor(n/86400),h=Math.floor(n%86400/3600);return `${d?d+' д. ':''}${String(h).padStart(2,'0')}:${String(Math.floor((n%3600)/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function statusText(t){const now=Date.now()+clockDelta,s=stateAt(t,now);return s==='active'?'Идёт · осталось '+remaining(t.endsAt-now):s==='upcoming'?'Скоро · до начала '+remaining(t.startsAt-now):'Завершён · итоги зафиксированы';}
async function call(path,method='GET',data=null){
  if(!API) throw Error('У игры не указан API_BASE в настройках GitHub');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
  try{
    const res=await fetch(API+path,{method,mode:'cors',cache:'no-store',signal:ctrl.signal,
      ...(data?{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{})});
    const body=await res.json();if(!res.ok||body.error)throw Error(body.error||`Ошибка ${res.status}`);return body;
  }finally{clearTimeout(timer)}
}
function clear(node){node.replaceChildren();}
function tag(n,text,cls){const e=document.createElement(n);if(cls)e.className=cls;e.textContent=text;return e;}
function showCard(t){
  const active=selectedId===t.id,stat=stateAt(t,Date.now()+clockDelta);
  const btn=document.createElement('button');btn.type='button';btn.className='event-card'+(active?' event-card--selected':'');btn.dataset.tournament=t.id;
  const top=tag('div','', 'event-card-top');top.append(tag('strong',t.title),tag('span',stat==='active'?'🟢 Идёт':stat==='upcoming'?'🕓 Скоро':'🏁 Завершён','event-status event-status--'+stat));
  btn.append(top);
  if(t.description)btn.append(tag('p',t.description));
  const info=tag('div','', 'event-info');info.append(tag('span','Начало: '+formatDate(t.startsAt)),tag('span','Конец: '+formatDate(t.endsAt)));
  btn.append(info);
  if(t.prize)btn.append(tag('p','🎁 '+t.prize));
  btn.append(tag('p',t.requiresTelegram?'🔐 Участие с подтверждением Telegram':'🎮 Участие по игровому нику'));
  btn.append(tag('span',statusText(t),'event-card-clock'));
  btn.addEventListener('click',()=>void selectEvent(t.id));
  return btn;
}
function paintCards(){
  const parent=$('eventsList');clear(parent);
  if(!events.length){parent.append(tag('p','Турниров пока нет. Когда владелец создаст первое событие, оно появится здесь.','events-muted'));return;}
  const now=Date.now()+clockDelta;
  const sorted=[...events].sort((a,b)=>{
    const n={active:0,upcoming:1,finished:2};return n[stateAt(a,now)]-n[stateAt(b,now)] || b.startsAt-a.startsAt;
  });
  for(const t of sorted)parent.append(showCard(t));
}
function showRanking(rows){
  clear($('tournamentLeaderboard'));const el=$('tournamentLeaderboard');
  if(!rows.length){el.append(tag('li','Пока нет сохранённых результатов.','leaderboard-empty'));return;}
  rows.slice(0,3).forEach((p,i)=>{
    const li=document.createElement('li'),owner=p.nickname==='Virotos',name=tag('span',p.nickname,'leaderboard-nickname'+(owner?' leaderboard-nickname--owner':i===0?' leaderboard-nickname--gold':''));
    const box=tag('span','', 'leaderboard-name');box.append(name);
    if(owner){li.classList.add('leaderboard-row--owner');box.append(tag('span','✦ OWNER','leaderboard-owner-badge'));}
    li.append(tag('span',['🥇','🥈','🥉'][i],'leaderboard-medal'),box,tag('span',Number(p.score).toLocaleString('ru-RU'),'leaderboard-points'));
    el.append(li);
  });
}
function paintSelected(t){
  const status=stateAt(t,Date.now()+clockDelta);
  $('eventRankingHeading').textContent=t.title;
  $('selectedEventStatus').textContent=statusText(t);
  clear($('selectedEventMeta'));
  $('selectedEventMeta').append(tag('p','Старт: '+formatDate(t.startsAt)),tag('p','Дедлайн: '+formatDate(t.endsAt)));
  if(t.prize)$('selectedEventMeta').append(tag('p','🎁 Приз: '+t.prize));
  if(t.description)$('selectedEventMeta').append(tag('p',t.description));
  $('selectedEventMeta').append(tag('p',t.requiresTelegram?'🔐 Защищённый турнир: каждый результат привязан к Telegram ID.':'Рейтинг по игровым никам без подтверждения аккаунта.'));
  const link=$('playEvent');link.hidden=status!=='active';link.href='../?tournament='+encodeURIComponent(t.id);
  $('shareEvent').disabled=false;
  $('closeEvent').disabled=status==='finished';
}
async function selectEvent(id){
  selectedId=id;
  const t=events.find(e=>e.id===id);if(!t)return;
  const url=new URL(location.href);url.searchParams.set('id',id);history.replaceState(null,'',url);
  paintCards();paintSelected(t);showRanking([]);
  try{
    const data=await call(`/api/tournaments/${encodeURIComponent(id)}/top`);
    clockDelta=data.serverNow-Date.now();
    paintSelected(data.tournament);showRanking(data.top||[]);
  }catch(e){$('selectedEventStatus').textContent='Ошибка получения результатов: '+e.message;}
}
async function refresh(){
  $('refreshEvents').disabled=true;$('eventsStatus').textContent='Обновление…';
  try{
    const data=await call('/api/tournaments');events=data.tournaments||[];clockDelta=data.serverNow-Date.now();
    $('eventsStatus').textContent=events.length?'Турниров: '+events.length:'Турниров пока нет';
    let pick=events.find(t=>t.id===selectedId);
    if(!pick){const fromLink=new URLSearchParams(location.search).get('id');pick=events.find(t=>t.id===fromLink)||events.find(t=>stateAt(t,Date.now()+clockDelta)==='active')||events[0];}
    selectedId=pick?.id||'';paintCards();if(pick)await selectEvent(pick.id);
    else{showRanking([]);$('selectedEventStatus').textContent='Турниры ещё не проводились.';}
  }catch(e){$('eventsStatus').textContent='Ошибка: '+e.message;}
  finally{$('refreshEvents').disabled=false;}
}
// Значения хранятся только в поле ввода; секрет не включается в URL и localStorage.
async function createEvent(e){
  e.preventDefault();const start=new Date($('newStart').value).getTime(),end=new Date($('newEnd').value).getTime();
  const key=$('adminKey').value;$('createButton').disabled=true;
  try{
    if(!Number.isFinite(start)||!Number.isFinite(end))throw Error('Укажи начало и конец');
    const data=await call('/api/admin/tournaments','POST',{title:$('newTitle').value,description:$('newDescription').value,prize:$('newPrize').value,startsAt:start,endsAt:end,requiresTelegram:$('newRequiresTelegram').checked,adminKey:key});
    $('adminKey').value='';$('adminMessage').textContent='Турнир создан! Отправь участникам ссылку.';selectedId=data.tournament.id;await refresh();
  }catch(err){$('adminMessage').textContent='Ошибка: '+err.message;}
  finally{$('createButton').disabled=false;}
}
async function closeEvent(){
  if(!selectedId)return;
  const key=$('adminKey').value;if(!key){$('adminMessage').textContent='Введите код администратора.';return;}
  if(!confirm('Завершить выбранный турнир досрочно? Приём очков прекратится навсегда.'))return;
  $('closeEvent').disabled=true;
  try{
    await call(`/api/admin/tournaments/${encodeURIComponent(selectedId)}/close`,'POST',{adminKey:key});
    $('adminKey').value='';$('adminMessage').textContent='Турнир закрыт. Рейтинг заморожен.';await refresh();
  }catch(e){$('adminMessage').textContent='Ошибка: '+e.message;}
  finally{$('closeEvent').disabled=false;}
}
function init(){
  $('year').textContent=new Date().getFullYear();
  $('refreshEvents').addEventListener('click',()=>void refresh());
  $('toggleAdmin').addEventListener('click',()=>{const block=$('adminContent');block.hidden=!block.hidden;$('toggleAdmin').setAttribute('aria-expanded',String(!block.hidden));});
  const now=new Date(Date.now()+5*60*1000),end=new Date(now.getTime()+3*86400000);
  function localField(date){return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);}
  $('newStart').value=localField(now);$('newEnd').value=localField(end);
  $('createTournament').addEventListener('submit',e=>void createEvent(e));
  $('closeEvent').addEventListener('click',()=>void closeEvent());
  $('configureTelegramBot').addEventListener('click',async()=>{
    const adminKey=$('adminKey').value;
    if(!adminKey){$('telegramWebhookStatus').textContent='Сначала введи код администратора.';return;}
    $('configureTelegramBot').disabled=true;
    try{await call('/api/admin/telegram/webhook','POST',{adminKey});$('telegramWebhookStatus').textContent='✅ Telegram-бот привязан к серверу.';}
    catch(e){$('telegramWebhookStatus').textContent='Ошибка: '+e.message;}
    finally{$('configureTelegramBot').disabled=false;}
  });
  $('shareEvent').addEventListener('click',async()=>{
    if(!selectedId)return;
    const url=`https://virotos.ru/2048/events/?id=${encodeURIComponent(selectedId)}`;
    try{await navigator.clipboard.writeText(url);$('selectedEventStatus').textContent='Ссылка на турнир скопирована.';}
    catch{$('selectedEventStatus').textContent='Ссылка: '+url;}
  });
  setInterval(()=>{
    const t=events.find(x=>x.id===selectedId);if(t)paintSelected(t);
    document.querySelectorAll('.event-card').forEach(el=>{const ev=events.find(x=>x.id===el.dataset.tournament);if(ev){const label=el.querySelector('.event-card-clock');if(label)label.textContent=statusText(ev);}});
  },1000);
  void refresh();
}
init();
