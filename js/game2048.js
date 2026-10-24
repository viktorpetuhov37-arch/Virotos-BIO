import { API_BASE } from './data/game2048-config.js';
import { createGame, applyMove, hasMoves, highestTile } from './game2048-engine.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'virotos2048_bests_v1';
const NICK_KEY = 'virotos2048_nickname_v1';
const API = API_BASE.trim().replace(/\/+$/, '');
// Турнир выбирается прямой ссылкой /2048/?tournament=<id>.
const tournamentId = new URLSearchParams(location.search).get('tournament');
const validTournamentId = tournamentId && /^[0-9a-f-]{36}$/.test(tournamentId);
let tournamentInfo=null,serverOffset=0,tournamentClock=null;
const TG_STORAGE_KEY='virotos_tg_token_v1';
let telegramToken=''; let telegramName=''; let telegramPoll=null;
try{telegramToken=sessionStorage.getItem(TG_STORAGE_KEY)||'';}catch{}

const tournamentRoute=(action='')=>`/api/tournaments/${encodeURIComponent(tournamentId)}${action ? '/'+action : ''}`;
function timeLeft(ms) {
  if(ms<=0) return '00:00:00';
  const s=Math.ceil(ms/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600);
  return `${d?d+' дн. ':''}${String(h).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function updateTournamentCountdown() {
  if(!tournamentInfo) return;
  const now=Date.now()+serverOffset;
  const upcoming=now<tournamentInfo.startsAt;
  const finished=tournamentInfo.closedAt!==null || now>=tournamentInfo.endsAt;
  const countdown=$('eventPlayCountdown');
  countdown.textContent=finished?'Результаты зафиксированы':timeLeft((upcoming?tournamentInfo.startsAt:tournamentInfo.endsAt)-now);
  $('eventPlayStatus').textContent=finished?'Завершён · рекорды заморожены':upcoming?'Скоро начало':'Идёт сейчас · успей сохранить результат';
  if(!game) $('startButton').disabled=!!finished || !!upcoming;
  if(finished&&!game) $('startError').textContent='Турнир завершён. Новые партии не принимаются.';
}
async function setupTournament() {
  if(!tournamentId) return;
  $('eventPlayNotice').hidden=false;
  $('eventsTab').classList.add('arcade-mode--active');
  $('freeTab').classList.remove('arcade-mode--active');
  $('leaderboardHeading').textContent='Топ-3 турнира';
  $('heroSubtitle').textContent='Турнирный режим: баллы учитываются только до дедлайна.';
  $('startButton').disabled=true;
  if(!validTournamentId || !API) { $('startError').textContent='Неверная ссылка или сервер не подключён'; return; }
  try {
    const response=await apiCall(tournamentRoute());
    tournamentInfo=response.tournament;
    if(tournamentInfo.requiresTelegram){
      $('telegramAuthPanel').hidden=false;
      $('nickname').disabled=true;
      $('nickname').required=false;
      $('nicknameLabel').hidden=true;
      $('ownerCodeWrap').hidden=true;
      $('ownerCode').required=false;
      $('tgStatus').textContent='Подтверди свой аккаунт через бота, чтобы участвовать.';
      await checkTelegramSession();
    }
    serverOffset=response.serverNow-Date.now();
    $('eventPlayTitle').textContent=tournamentInfo.title;
    updateTournamentCountdown();
    tournamentClock=setInterval(updateTournamentCountdown,1000);
  } catch(error) {
    $('startError').textContent='Не удалось загрузить турнир: '+error.message;
  }
}

const directionKeys = { ArrowLeft:'L', ArrowRight:'R', ArrowUp:'U', ArrowDown:'D', a:'L', d:'R', w:'U', s:'D', A:'L', D:'R', W:'U', S:'D', 'ф':'L', 'в':'R', 'ц':'U', 'ы':'D' };
let game = null, nickname = '', sessionId = null, mode = 'local';
let trace = '', ended = false, submitting = false, won = false;
let noticeTimer;
let ownerKey = ''; // только в памяти до сохранения партии — НЕ localStorage

function storageRead() {
  try { const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function localTop() { return storageRead().sort((a,b) => b.score - a.score).slice(0,3); }
function localBest() { return Math.max(0, ...storageRead().map(r => r.score)); }
function storeLocal(name, score) {
  try {
    const data = storageRead();
    const index = data.findIndex(r => r.nickname.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (index < 0) data.push({nickname:name, score});
    else if (score > data[index].score) data[index] = {nickname:name, score};
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.sort((a,b) => b.score - a.score).slice(0,60)));
  } catch { /* режим приватного браузера без localStorage */ }
}
function notify(text) {
  $('notification').textContent = text;
  $('notification').classList.add('show');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => $('notification').classList.remove('show'), 2700);
}
function showMessage(text) { $('message').textContent = text; }
function refreshBoard() {
  const tiles = $('board').children;
  if (!game) return;
  for (let i=0; i<16; i++) {
    const value = game.board[i];
    tiles[i].textContent = value ? String(value) : '';
    tiles[i].dataset.value = String(value);
    tiles[i].dataset.super = String(value > 2048);
    tiles[i].setAttribute('aria-label', value ? String(value) : 'пусто');
  }
  $('score').textContent = game.score.toLocaleString('ru-RU');
  $('best').textContent = Math.max(localBest(), game.score).toLocaleString('ru-RU');
}
// Админский статус присваивается ТОЛЬКО каноническому Virotos в общем
// рейтинге, полученному от защищённого Worker. Локальным никам не доверяем.
function renderTop(rows, title, fromServer = false) {
  $('leaderboardStatus').textContent = title;
  $('leaderboard').replaceChildren();
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'leaderboard-empty';
    li.textContent = 'Пока ни одного результата. Стань первым!';
    $('leaderboard').append(li);
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  rows.slice(0, 3).forEach((player, i) => {
    const isOwner = fromServer && player.nickname === 'Virotos';
    const isGold = i === 0 && !isOwner; // админский стиль приоритетнее золота
    const li = document.createElement('li');
    const medal = document.createElement('span');
    const name = document.createElement('span');
    const nickname = document.createElement('span');
    const points = document.createElement('span');
    medal.className = 'leaderboard-medal';
    medal.textContent = medals[i];
    name.className = 'leaderboard-name';
    nickname.className = 'leaderboard-nickname';
    nickname.textContent = player.nickname; // без HTML — безопасно для любых ников
    if (isOwner) {
      li.classList.add('leaderboard-row--owner');
      nickname.classList.add('leaderboard-nickname--owner');
      const badge = document.createElement('span');
      badge.className = 'leaderboard-owner-badge';
      badge.textContent = '✦ OWNER';
      badge.title = 'Владелец Virotos Arcade';
      name.append(nickname, badge);
    } else {
      if (isGold) nickname.classList.add('leaderboard-nickname--gold');
      name.append(nickname);
    }
    points.className = 'leaderboard-points';
    points.textContent = Number(player.score).toLocaleString('ru-RU');
    li.append(medal, name, points);
    $('leaderboard').append(li);
  });
}
async function apiCall(path, method='GET', data=null) {
  if (!API) throw Error('Сервер рекордов пока не подключён');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try {
    const response=await fetch(API+path, {
      method, mode:'cors', signal:controller.signal, cache:'no-store',
      ...(data ? { headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(data) } : {})
    });
    const payload=await response.json();
    if (!response.ok || payload.error) {
      const error = Error(payload.error || 'Ошибка сервера ' + response.status);
      error.httpStatus = response.status;
      throw error;
    }
    return payload;
  } finally {clearTimeout(timer);}
}
async function loadTop() {
  $('refreshButton').disabled=true;
  if (tournamentId && !API) renderTop([], 'Для турнира нужен доступ к серверу.');
  else if (!API) renderTop(localTop(), 'Рекорды этого устройства · общий топ ещё не подключён');
  else {
    try {
      const data=await apiCall(tournamentId?tournamentRoute('top'):'/api/top');
      if(tournamentId) {
        tournamentInfo=data.tournament;
        serverOffset=data.serverNow-Date.now();
        updateTournamentCountdown();
      }
      renderTop(data.top || [],tournamentId?(data.frozen?'Итоги турнира · рейтинг заморожен':'Турнирный зачёт · только текущий турнир'):'Общий топ-3 всех посетителей сайта',true);
    } catch {
      renderTop([], tournamentId?'Не удалось получить турнирные результаты':'Общий рейтинг временно недоступен');
    }
  }
  $('refreshButton').disabled=false;
}
function freshSeed() { const n=new Uint32Array(1); crypto.getRandomValues(n); return n[0]; }
// Зарезервированное имя владельца Virotos. Убираем разделители и учитываем
// кириллицу, латиницу, регистр и смешанные написания.
function isReservedNickname(name) {
  const compact = String(name).normalize('NFKC').toLocaleLowerCase('ru-RU')
    .replace(/[\p{Cf}\s._-]+/gu, '');
  const lookalikes = { 'в':'v', 'и':'i', 'і':'i', 'р':'r', 'о':'o', 'т':'t', 'с':'s' };
  const folded = [...compact].map(letter => lookalikes[letter] || letter).join('');
  return folded.includes('virotos');
}

function validateNickname(name) {
  const nick=name.replace(/\s+/gu,' ').trim();
  if (nick.length<2 || nick.length>18 || !/^[\p{L}\p{N}_. -]+$/u.test(nick)) {
    throw Error('Ник: 2–18 символов, буквы, цифры, пробел, точка, «_» или «-».');
  }
  return nick;
}
function updateOwnerField() {
  const reserved = isReservedNickname($('nickname').value);
  if(tournamentInfo?.requiresTelegram)return;
  $('ownerCodeWrap').hidden = !reserved;
  $('ownerCode').required = reserved;
  $('startOverlay').classList.toggle('owner-mode', reserved);
  if (!reserved) $('ownerCode').value = '';
}
async function start(event) {
  event.preventDefault();
  $('startError').textContent='';
  let name;
  try { name=tournamentInfo?.requiresTelegram ? (telegramName||'') : validateNickname($('nickname').value);
    if(tournamentInfo?.requiresTelegram&&!telegramToken)throw Error('Сначала войди через Telegram.'); }
  catch(error) { $('startError').textContent=error.message; return; }
  $('startButton').disabled=true; $('startButton').textContent='Запускаем…';
  const reserved = !tournamentInfo?.requiresTelegram && isReservedNickname(name);
  const candidateKey = reserved ? $('ownerCode').value : '';
  if (tournamentId && (!validTournamentId || !tournamentInfo || tournamentInfo.closedAt!==null || Date.now()+serverOffset<tournamentInfo.startsAt || Date.now()+serverOffset>=tournamentInfo.endsAt)) {
    $('startError').textContent='Сейчас нельзя начать партию в этом турнире.';
    $('startButton').disabled=false; $('startButton').textContent='Начать игру →';
    return;
  }
  if (reserved && !API) {
    $('startError').textContent = 'Для защищённого ника нужен работающий сервер рекордов.';
    $('startButton').disabled=false; $('startButton').textContent='Начать игру →';
    return;
  }
  let seed=freshSeed(), remoteId=null;
  if (API) {
    try {
      const data=await apiCall(tournamentId?tournamentRoute('start'):'/api/start', 'POST', {nickname:name, ...(reserved ? {ownerKey:candidateKey} : {}), ...(tournamentInfo?.requiresTelegram?{telegramToken}:{})});
      seed=data.seed >>> 0;
      remoteId=data.id;
      if(tournamentInfo?.requiresTelegram)name=data.nickname;
      mode=tournamentId?'tournament':'global';
    } catch(error) {
      // Защищённый ник нельзя использовать в офлайн-режиме.
      // Ошибки 4xx также нельзя обходить локальной игрой.
      if (tournamentId || reserved || (error.httpStatus >= 400 && error.httpStatus < 500)) {
        $('startError').textContent=error.message || 'Не удалось проверить ник.';
        $('startButton').disabled=false; $('startButton').textContent='Начать игру →';
        return;
      }
      mode='local';
      notify('Сервер пока недоступен. Игра запущена без общего рейтинга.');
    }
  } else mode='local';
  game=createGame(seed);
  nickname=reserved ? 'Virotos' : name;
  ownerKey=reserved ? candidateKey : '';
  $('ownerCode').value = ''; // никогда не сохраняем код в браузере
  sessionId=remoteId;
  trace=''; ended=false; submitting=false; won=false;
  try {localStorage.setItem(NICK_KEY,name);} catch {}
  $('playerTag').textContent=nickname;
  $('playerTag').classList.toggle('player-tag--owner', reserved && (mode==='global'||mode==='tournament'));
  $('startOverlay').hidden=true;
  $('finishButton').disabled=false;
  $('restartButton').disabled=false;
  $('finishButton').textContent='Сохранить результат';
  $('startButton').disabled=false; $('startButton').textContent='Начать игру →';
  showMessage(mode==='tournament'?'Турнир начат. Результат нужно сохранить до окончания таймера!':mode==='global'?'Готово! Поехали за рекордом.':'Локальная партия. Для общего топа подключим Cloudflare.');
  refreshBoard();
}
function move(direction) {
  if (!game || ended || submitting) return;
  if (!applyMove(game,direction)) return;
  trace+=direction;
  refreshBoard();
  if (!won && highestTile(game)>=2048) {
    won=true;
    showMessage('🏆 2048 собрано! Можешь продолжать — очки считаются дальше.');
  } else if (!hasMoves(game)) {
    showMessage('Ходов больше нет. Сохраняем результат…');
    void finish();
  } else showMessage('Используй стрелки, WASD или свайпы.');
}
async function finish() {
  if (!game || submitting || (ended && !sessionId)) return;
  submitting=true; ended=true;
  $('finishButton').disabled=true;
  $('finishButton').textContent='Сохраняем…';
  if(!tournamentId) storeLocal(nickname,game.score);
  let message='Результат сохранён на этом устройстве.';
  if ((mode==='global'||mode==='tournament') && sessionId) {
    try {
      const response=await apiCall(mode==='tournament'?tournamentRoute('finish'):'/api/finish','POST',{id:sessionId,moves:trace, ...(ownerKey ? {ownerKey} : {}), ...(mode==='tournament' && tournamentInfo?.requiresTelegram ? {telegramToken}:{})});
      message=`Результат ${Number(response.score).toLocaleString('ru-RU')} сохранён в ${mode==='tournament'?'турнирном':'общем'} рейтинге!`;
      sessionId=null;
      ownerKey='';
    } catch(error) {
      if(mode==='tournament' && [409,410].includes(error.httpStatus)) {
        message='Турнир завершён. Новые результаты больше не принимаются. Уже сохранённые очки остаются в рейтинге.';
        sessionId=null;ownerKey='';
      } else {
        message='Не удалось отправить результат: '+error.message+'. Нажми «Повторить отправку».';
        $('finishButton').textContent='Повторить отправку';
        $('finishButton').disabled=false;
      }
    }
  }
  if (mode==='local') sessionId=null;
  submitting=false;
  if (!sessionId) { $('finishButton').textContent='Результат сохранён'; $('finishButton').disabled=true; }
  showMessage(message);
  refreshBoard(); await loadTop();
}
function newGame() {
  if (game && ((sessionId && ended) || (!ended && trace.length>0)) && !confirm('Начать заново? Несохранённый общий результат может потеряться.')) return;
  ended=true;
  game=null; trace=''; sessionId=null; ownerKey='';
  $('ownerCode').value='';
  $('startOverlay').hidden=false;
  $('startError').textContent='';
  $('finishButton').disabled=true; $('restartButton').disabled=true;
  $('finishButton').textContent='Сохранить результат';
  $('playerTag').textContent='Игрок не выбран';
  $('playerTag').classList.remove('player-tag--owner');
  $('score').textContent='0';
  showMessage('Введи ник и начни новую партию.');
  $('nickname').focus();
}

async function checkTelegramSession(){
  if(!telegramToken||!tournamentInfo?.requiresTelegram)return;
  try{
    const data=await telegramAuthCall('/api/auth/me','GET',null,telegramToken);
    telegramName=data.player; $('nickname').value=telegramName;
    $('tgStatus').textContent='✅ Подтверждён аккаунт '+telegramName;
    $('tgLoginButton').textContent='Сменить Telegram-аккаунт';
  }catch{
    telegramToken='';telegramName='';try{sessionStorage.removeItem(TG_STORAGE_KEY);}catch{}
    $('tgStatus').textContent='Войди через Telegram, чтобы начать турнир.';
  }
}
async function telegramAuthCall(path,method='GET',data=null,token=''){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
    const resp=await fetch(API+path,{method,mode:'cors',signal:controller.signal,cache:'no-store',
      headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},
      ...(data?{body:JSON.stringify(data)}:{})});
    const body=await resp.json();if(!resp.ok||body.error)throw Error(body.error||'Ошибка '+resp.status);
    return body;
  }finally{clearTimeout(timer);}
}
async function loginViaTelegram(){
  if(!API||!tournamentInfo?.requiresTelegram)return;
  $('tgLoginButton').disabled=true;
  $('tgStatus').textContent='Создаём ссылку для входа…';
  if(telegramPoll)clearInterval(telegramPoll);
  try{
    const d=await telegramAuthCall('/api/auth/begin','POST',{});
    $('tgOpenLink').href=d.deepLink;$('tgOpenLink').hidden=false;
    $('tgOpenLink').textContent='Открыть бота для подтверждения ↗';
    $('tgStatus').textContent='Открой бота, нажми Start и вернись на страницу. Вход подтвердится автоматически.';
    // Popup may be blocked. Always leave the explicit deep link visible.
    window.open(d.deepLink,'_blank','noopener,noreferrer');
    const expiry=d.expiresAt;
    telegramPoll=setInterval(async()=>{
      if(Date.now()>expiry){clearInterval(telegramPoll);telegramPoll=null;$('tgStatus').textContent='Ссылка устарела, нажми «Войти» снова.';$('tgLoginButton').disabled=false;return;}
      try{
        const s=await telegramAuthCall('/api/auth/status?id='+encodeURIComponent(d.id));
        if(s.status!=='confirmed')return;
        clearInterval(telegramPoll);telegramPoll=null;
        telegramToken=s.token;telegramName=s.player;
        try{sessionStorage.setItem(TG_STORAGE_KEY,telegramToken);}catch{}
        $('nickname').value=telegramName;
        $('tgStatus').textContent='✅ Вход подтверждён: '+telegramName;
        $('tgOpenLink').hidden=true;
        $('tgLoginButton').disabled=false;$('tgLoginButton').textContent='Сменить Telegram-аккаунт';
        $('startError').textContent='';
      }catch(e){if(/устар|использован/.test(e.message)){clearInterval(telegramPoll);telegramPoll=null;$('tgStatus').textContent=e.message;$('tgLoginButton').disabled=false;}}
    },1800);
  }catch(e){$('tgStatus').textContent='Ошибка входа: '+e.message;$('tgLoginButton').disabled=false;}
}

function init() {
  for (let i=0;i<16;i++) { const tile=document.createElement('div'); tile.className='tile'; tile.setAttribute('role','gridcell'); tile.dataset.value='0'; $('board').append(tile); }
  $('year').textContent=new Date().getFullYear();
  try { $('nickname').value=localStorage.getItem(NICK_KEY)||''; } catch {}
  $('best').textContent=localBest().toLocaleString('ru-RU');
  $('nickname').addEventListener('input', updateOwnerField);
  $('startForm').addEventListener('submit', start);
  updateOwnerField();
  $('finishButton').addEventListener('click', ()=>void finish());
  $('restartButton').addEventListener('click',newGame);
  $('refreshButton').addEventListener('click',()=>void loadTop());
  document.querySelectorAll('[data-direction]').forEach(btn => btn.addEventListener('click',()=>move(btn.dataset.direction)));
  document.addEventListener('keydown',e=>{
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.altKey || e.ctrlKey || e.metaKey) return;
    const dir=directionKeys[e.key];
    if (dir && game && !ended) {e.preventDefault();move(dir);}
  });
  let touchStart=null;
  $('board').addEventListener('pointerdown',e=> { touchStart={x:e.clientX,y:e.clientY}; });
  $('board').addEventListener('pointerup',e=>{
    if (!touchStart) return;
    const dx=e.clientX-touchStart.x, dy=e.clientY-touchStart.y;
    touchStart=null;
    if (Math.max(Math.abs(dx),Math.abs(dy))<25) return;
    move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'R':'L') : (dy>0?'D':'U'));
  });
  $('tgLoginButton').addEventListener('click',()=>void loginViaTelegram());
  $('shareButton').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText('https://virotos.ru/2048/'); notify('Ссылка на игру скопирована!'); }
    catch {notify('Адрес игры: virotos.ru/2048/');}
  });
  void loadTop();
  void setupTournament();
}
init();
