import { API_BASE } from './data/game2048-config.js';
import { createGame, applyMove, hasMoves, highestTile } from './game2048-engine.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'virotos2048_bests_v1';
const NICK_KEY = 'virotos2048_nickname_v1';
const API = API_BASE.trim().replace(/\/+$/, '');
const directionKeys = { ArrowLeft:'L', ArrowRight:'R', ArrowUp:'U', ArrowDown:'D', a:'L', d:'R', w:'U', s:'D', A:'L', D:'R', W:'U', S:'D', 'ф':'L', 'в':'R', 'ц':'U', 'ы':'D' };
let game = null, nickname = '', sessionId = null, mode = 'local';
let trace = '', ended = false, submitting = false, won = false;
let noticeTimer;

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
function renderTop(rows, title) {
  $('leaderboardStatus').textContent = title;
  $('leaderboard').replaceChildren();
  if (!rows.length) {
    const li = document.createElement('li');
    li.className='leaderboard-empty';
    li.textContent='Пока ни одного результата. Стань первым!';
    $('leaderboard').append(li);
    return;
  }
  const medals=['🥇','🥈','🥉'];
  rows.slice(0,3).forEach((player, i) => {
    const li=document.createElement('li');
    const medal=document.createElement('span'), name=document.createElement('span'), points=document.createElement('span');
    medal.className='leaderboard-medal'; medal.textContent=medals[i];
    name.className='leaderboard-name'; name.textContent=player.nickname;
    points.className='leaderboard-points'; points.textContent=Number(player.score).toLocaleString('ru-RU');
    li.append(medal,name,points); $('leaderboard').append(li);
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
    if (!response.ok || payload.error) throw Error(payload.error || 'Ошибка сервера '+response.status);
    return payload;
  } finally {clearTimeout(timer);}
}
async function loadTop() {
  $('refreshButton').disabled=true;
  if (!API) renderTop(localTop(), 'Рекорды этого устройства · общий топ ещё не подключён');
  else {
    try {
      const data=await apiCall('/api/top');
      renderTop(data.top || [], 'Общий топ-3 всех посетителей сайта');
    } catch {
      renderTop(localTop(), 'Сервер рекордов недоступен · показаны локальные результаты');
    }
  }
  $('refreshButton').disabled=false;
}
function freshSeed() { const n=new Uint32Array(1); crypto.getRandomValues(n); return n[0]; }
function validateNickname(name) {
  const nick=name.replace(/\s+/gu,' ').trim();
  if (nick.length<2 || nick.length>18 || !/^[\p{L}\p{N}_. -]+$/u.test(nick)) {
    throw Error('Ник: 2–18 символов, буквы, цифры, пробел, точка, «_» или «-».');
  }
  return nick;
}
async function start(event) {
  event.preventDefault();
  $('startError').textContent='';
  let name;
  try { name=validateNickname($('nickname').value); }
  catch(error) { $('startError').textContent=error.message; return; }
  $('startButton').disabled=true; $('startButton').textContent='Запускаем…';
  let seed=freshSeed(), remoteId=null;
  if (API) {
    try {
      const data=await apiCall('/api/start', 'POST', {nickname:name});
      seed=data.seed >>> 0;
      remoteId=data.id;
      mode='global';
    } catch(error) {
      mode='local';
      notify('Сервер пока недоступен. Игра запущена без общего рейтинга.');
    }
  } else mode='local';
  game=createGame(seed);
  nickname=name; sessionId=remoteId;
  trace=''; ended=false; submitting=false; won=false;
  try {localStorage.setItem(NICK_KEY,name);} catch {}
  $('playerTag').textContent=name;
  $('startOverlay').hidden=true;
  $('finishButton').disabled=false;
  $('restartButton').disabled=false;
  $('finishButton').textContent='Сохранить результат';
  $('startButton').disabled=false; $('startButton').textContent='Начать игру →';
  showMessage(mode==='global'?'Готово! Поехали за рекордом.':'Локальная партия. Для общего топа подключим Cloudflare.');
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
  storeLocal(nickname,game.score);
  let message='Результат сохранён на этом устройстве.';
  if (mode==='global' && sessionId) {
    try {
      const response=await apiCall('/api/finish','POST',{id:sessionId,moves:trace});
      message=`Результат ${Number(response.score).toLocaleString('ru-RU')} добавлен в общий рейтинг!`;
      sessionId=null;
    } catch(error) {
      message='Не удалось отправить результат: '+error.message+'. Нажми «Повторить отправку».';
      $('finishButton').textContent='Повторить отправку';
      $('finishButton').disabled=false;
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
  game=null; trace=''; sessionId=null;
  $('startOverlay').hidden=false;
  $('startError').textContent='';
  $('finishButton').disabled=true; $('restartButton').disabled=true;
  $('finishButton').textContent='Сохранить результат';
  $('playerTag').textContent='Игрок не выбран';
  $('score').textContent='0';
  showMessage('Введи ник и начни новую партию.');
  $('nickname').focus();
}
function init() {
  for (let i=0;i<16;i++) { const tile=document.createElement('div'); tile.className='tile'; tile.setAttribute('role','gridcell'); tile.dataset.value='0'; $('board').append(tile); }
  $('year').textContent=new Date().getFullYear();
  try { $('nickname').value=localStorage.getItem(NICK_KEY)||''; } catch {}
  $('best').textContent=localBest().toLocaleString('ru-RU');
  $('startForm').addEventListener('submit', start);
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
  $('shareButton').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText('https://virotos.ru/2048/'); notify('Ссылка на игру скопирована!'); }
    catch {notify('Адрес игры: virotos.ru/2048/');}
  });
  void loadTop();
}
init();
