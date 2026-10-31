/* Virotos Rewards v0.2 — account, test codes, test referral links. */
import { API_BASE } from './data/game2048-config.js';
(() => {
  'use strict';
  const API=String(API_BASE||'').replace(/\/+$/,'');
  const KEY='virotos_tg_token_v1'; // тот же ключ, что в 2048
  let token='';try{token=sessionStorage.getItem(KEY)||'';}catch{}
  let activePolling=false;
  const $=id=>document.getElementById(id);
  const notice=(text)=>{const el=$('rwStatus');if(el)el.textContent=text;};
  async function call(path,options={}) {
    if(!API)throw Error('Сервер пока не настроен');
    const response=await fetch(API+path,{method:options.method||'GET',headers:{...(options.method?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},...(options.method?{body:'{}'}:{})});
    let data;try{data=await response.json();}catch{throw Error('Сервер не ответил корректно');}
    if(!response.ok)throw Error(data.error||'Не удалось связаться с сервером');
    return data;
  }
  function setLogged(logged,player='') {
    if($('rwLogin'))$('rwLogin').hidden=logged;
    if($('rwLogout'))$('rwLogout').hidden=!logged;
    if($('rwAccount'))$('rwAccount').textContent=logged?player:'Аккаунт не подключён';
    if($('rwCreateCode'))$('rwCreateCode').disabled=!logged;
    if($('rwCreateReferral'))$('rwCreateReferral').disabled=!logged;
  }
  const formatTime=stamp=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(Number(stamp)));
  function renderPromo(items){
    const list=$('rwPromoList');if(!list)return;
    list.replaceChildren();
    if(!items.length){const empty=document.createElement('p');empty.className='rw-empty';empty.textContent='Пока нет промокодов.';list.append(empty);return;}
    items.forEach(item=>{
      const card=document.createElement('article');card.className='rw-promo';
      const info=document.createElement('div');
      const title=document.createElement('strong');title.textContent=item.kind==='test'?'Проверочный код · 0 ₽':'Промокод';
      const subtitle=document.createElement('small');subtitle.textContent='Действует до '+formatTime(item.expiresAt);
      const code=document.createElement('code');code.textContent=item.code;
      info.append(title,subtitle,code);
      const ctrl=document.createElement('div');ctrl.className='rw-promo-controls';
      const state=document.createElement('span');state.className='shop-pill';state.textContent=Date.now()>=item.expiresAt?'Истёк':item.status==='used'?'Использован':item.status==='active'?'Активен':'Отменён';
      const copy=document.createElement('button');copy.type='button';copy.className='shop-outline-button';copy.textContent='Копировать';copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(item.code);notice('Код скопирован');}catch{notice('Выдели код вручную');}
      });
      ctrl.append(state,copy);card.append(info,ctrl);list.append(card);
    });
  }
  async function reload() {
    if(!token){setLogged(false);renderPromo([]);if($('rwBalance'))$('rwBalance').textContent='—';notice('Войди через Telegram, чтобы открыть кошелёк и промокоды.');return;}
    try {
      const profile=await call('/api/rewards/me');
      setLogged(true,profile.player);notice('Telegram подтверждён');
      if($('rwBalance'))$('rwBalance').textContent=Number(profile.balanceVP).toLocaleString('ru-RU');
      renderPromo(profile.promos||[]);
      const referrals=$('rwReferralCount');if(referrals)referrals.textContent=String((profile.referrals||[]).length);
    }catch(e){
      if(/Telegram|войти|снова/i.test(e.message)){token='';try{sessionStorage.removeItem(KEY);}catch{}setLogged(false);renderPromo([]);if($('rwBalance'))$('rwBalance').textContent='—';}
      notice(e.message);
    }
  }
  async function beginLogin(){
    if(activePolling)return;
    const btn=$('rwLogin');if(btn)btn.disabled=true;
    notice('Создаём ссылку входа…');
    let pending;
    try{pending=await call('/api/auth/begin',{method:'POST'});}catch(e){notice(e.message);if(btn)btn.disabled=false;return;}
    const link=$('rwBotLink');if(link){link.hidden=false;link.href=pending.deepLink;link.textContent='Открыть @Virotos_bot для подтверждения ↗';}
    notice('Открой бота, нажми Start и вернись сюда. Подтверждение появится автоматически.');
    activePolling=true;
    const expires=Number(pending.expiresAt);
    while(Date.now()<expires && activePolling){
      await new Promise(r=>setTimeout(r,1700));
      if(!activePolling)break;
      try{
        const result=await call('/api/auth/status?id='+encodeURIComponent(pending.id));
        if(result.status==='confirmed'){
          token=result.token;try{sessionStorage.setItem(KEY,token);}catch{}
          activePolling=false;if(link)link.hidden=true;await reload();break;
        }
      }catch(e){if(/устар|использован|expired/i.test(e.message)){notice('Ссылка устарела. Запроси новую.');break;}}
    }
    activePolling=false;if(btn)btn.disabled=false;
  }
  async function newTestCode(){
    const btn=$('rwCreateCode');if(btn)btn.disabled=true;
    try{const result=await call('/api/rewards/test-promo',{method:'POST'});notice(result.created?'Проверочный код создан на сервере. Он не даёт скидку.':'Твой тестовый код уже существует.');await reload();}catch(e){notice(e.message);}finally{if(btn)btn.disabled=false;}
  }
  async function newReferral(){
    const btn=$('rwCreateReferral');if(btn)btn.disabled=true;
    try{
      const result=await call('/api/rewards/referral-test',{method:'POST'});
      const link=$('rwReferralLink');if(link){link.href=result.botLink;link.hidden=false;link.textContent='Открыть бота с заявкой '+result.referral.slice(0,8)+' ↗';}
      notice('Тестовая заявка создана. Подтверди переход через бота.');
    }catch(e){notice(e.message);}finally{if(btn)btn.disabled=false;}
  }
  const links={reviews:'https://t.me/viktor_l1fe',seller:'https://t.me/Virotos',bot:'https://t.me/Virotos_bot?start=rewards'};
  document.querySelectorAll('[data-rewards-target]').forEach(a=>{const key=a.dataset.rewardsTarget;if(links[key])a.href=links[key];});
  const year=$('year');if(year)year.textContent=new Date().getFullYear();
  $('rwLogin')?.addEventListener('click',beginLogin);
  $('rwLogout')?.addEventListener('click',()=>{token='';activePolling=false;try{sessionStorage.removeItem(KEY);}catch{}void reload();});
  $('rwCreateCode')?.addEventListener('click',newTestCode);
  $('rwCreateReferral')?.addEventListener('click',newReferral);
  void reload();
})();
