/* Virotos Rewards v0.4 — verified VP discount vouchers and Telegram account. */
import { API_BASE } from './data/game2048-config.js';
import { AUTH_STORAGE_KEY, readAuthToken, saveAuthToken, clearAuthToken, readPendingAuth, savePendingAuth, clearPendingAuth } from './virotos-auth.js';
(() => {
  'use strict';
  const API=String(API_BASE||'').replace(/\/+$/,'');
  const KEY=AUTH_STORAGE_KEY;
  let token=readAuthToken();
  let activePolling=false;
  const $=id=>document.getElementById(id);
  const notice=(text)=>{const el=$('rwStatus');if(el)el.textContent=text;};
  async function call(path,options={}) {
    if(!API)throw Error('Сервер пока не настроен');
    const response=await fetch(API+path,{method:options.method||'GET',headers:{...(options.method?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},...(options.method?{body:JSON.stringify(options.data||{})}:{})});
    let data;try{data=await response.json();}catch{throw Error('Сервер не ответил корректно');}
    if(!response.ok){const error=Error(data.error||'Не удалось связаться с сервером');error.status=response.status;throw error;}
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
      const title=document.createElement('strong');title.textContent=item.kind==='test'?'Проверочный код · 0 ₽':`Скидка ${item.discountPercent}% · до ${item.maxDiscountRub} ₽`;
      const subtitle=document.createElement('small');subtitle.textContent='Действует до '+formatTime(item.expiresAt)+(item.kind==='discount'?' · стоимость '+item.costVP+' VP':'');
      const code=document.createElement('code');code.textContent=item.code;
      info.append(title,subtitle,code);
      const ctrl=document.createElement('div');ctrl.className='rw-promo-controls';
      const state=document.createElement('span');state.className='shop-pill';state.textContent=Date.now()>=item.expiresAt?'Истёк':item.status==='used'?'Использован':item.status==='active'?'Активен':'Отменён';
      const copy=document.createElement('button');copy.type='button';copy.className='shop-outline-button';copy.textContent='Копировать';copy.addEventListener('click',async()=>{
        try{await navigator.clipboard.writeText(item.code);notice('Код скопирован');}catch{notice('Выдели код вручную');}
      });
      ctrl.append(state,copy);
      if(item.kind==='discount'&&item.status==='active'){
        const cancel=document.createElement('button');cancel.type='button';cancel.className='shop-outline-button';cancel.textContent='Вернуть VP';
        cancel.addEventListener('click',async()=>{
          if(!confirm('Отменить этот неиспользованный код и вернуть '+item.costVP+' VP?'))return;
          cancel.disabled=true;
          try{await call('/api/rewards/cancel-discount',{method:'POST',data:{code:item.code}});await reload();notice('Код отменён. VP возвращены.');}
          catch(e){notice(e.message);cancel.disabled=false;}
        });ctrl.append(cancel);
      }
      card.append(info,ctrl);list.append(card);
    });
  }
  async function reload() {
    if(!token){setLogged(false);renderPromo([]);document.querySelectorAll('[data-buy-discount]').forEach(b=>b.disabled=true);if($('rwBalance'))$('rwBalance').textContent='—';notice('Войди через Telegram, чтобы открыть кошелёк и промокоды.');return;}
    try {
      const profile=await call('/api/rewards/me');
      setLogged(true,profile.player);notice('Telegram подтверждён');
      if($('rwBalance'))$('rwBalance').textContent=Number(profile.balanceVP).toLocaleString('ru-RU');
      renderPromo(profile.promos||[]);
      document.querySelectorAll('[data-buy-discount]').forEach(button=>{
        const cost=Number(button.dataset.costVp);
        button.disabled=!profile.partnerReady||!Number.isFinite(cost)||Number(profile.balanceVP)<cost;
        button.title=!profile.partnerReady?'Продавец ещё не подключён':(button.disabled?'Недостаточно VP':'');
      });
      if($('rwDiscountStatus'))$('rwDiscountStatus').textContent=profile.partnerReady?'Купоны доступны для покупки за VP. Согласуй цену с продавцом перед оплатой.':'Купоны откроются после подключения Telegram продавца.';
      const referrals=$('rwReferralCount');if(referrals)referrals.textContent=String((profile.referrals||[]).length);
    }catch(e){
      if(e.status===401){token='';clearAuthToken();setLogged(false);renderPromo([]);document.querySelectorAll('[data-buy-discount]').forEach(b=>b.disabled=true);if($('rwBalance'))$('rwBalance').textContent='—';}
      notice(e.message);
    }
  }
  async function pollPendingLogin(pending){
    if(activePolling || !pending || !pending.id) return;
    activePolling=true;
    const btn=$('rwLogin');if(btn)btn.disabled=true;
    const link=$('rwBotLink');
    if(link && pending.deepLink){link.hidden=false;link.href=pending.deepLink;link.textContent='Открыть @Virotos_bot ↗';}
    notice('Открой бота для подтверждения и вернись в эту вкладку. Вход сохранится на устройстве.');
    try {
      while(Date.now()<Number(pending.expiresAt) && activePolling){
        // Poll immediately when returning to the site (no initial 1.7s delay).
        try{
          const result=await call('/api/auth/status?id='+encodeURIComponent(pending.id));
          if(result.status==='confirmed'){
            token=result.token;
            saveAuthToken(token);
            clearPendingAuth();
            if(link)link.hidden=true;
            notice('Вход сохранён на этом устройстве');
            await reload();
            return;
          }
        }catch(e){
          if(e.status===410 || e.status===409){
            clearPendingAuth();
            token=readAuthToken();
            if(token) await reload();
            else notice('Подтверждение устарело. Нажми «Войти через Telegram» ещё раз.');
            return;
          }
          // Temporary network trouble is not a logout.
        }
        if(document.visibilityState==='hidden'){
          await new Promise(r=>setTimeout(r,2500));
        }else{
          await new Promise(r=>setTimeout(r,1700));
        }
      }
      if(Date.now()>=Number(pending.expiresAt)){
        clearPendingAuth();
        notice('Подтверждение устарело. Запроси новую ссылку.');
      }
    }finally{
      activePolling=false;
      if(btn)btn.disabled=false;
    }
  }
  async function beginLogin(){
    if(activePolling)return;
    const btn=$('rwLogin');if(btn)btn.disabled=true;
    notice('Создаём ссылку входа…');
    let pending;
    try{pending=await call('/api/auth/begin',{method:'POST'});}
    catch(e){notice(e.message);if(btn)btn.disabled=false;return;}
    savePendingAuth(pending);
    void pollPendingLogin(pending);
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
  $('rwLogout')?.addEventListener('click',async()=>{
    activePolling=false;
    clearPendingAuth();
    if(token){
      try { await call('/api/auth/logout',{method:'POST'}); }
      catch(e){notice('Не удалось завершить вход на сервере: '+e.message+'. Повтори выход при соединении с интернетом.');return;}
    }
    token='';clearAuthToken();
    await reload();
  });
  window.addEventListener('storage',event=>{
    if(event.key!==KEY)return;
    token=readAuthToken();
    activePolling=false;
    void reload();
  });
  document.querySelectorAll('[data-buy-discount]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const percent=Number(button.dataset.buyDiscount),cost=Number(button.dataset.costVp);
      if(!confirm(`Купить скидку ${percent}% за ${cost} VP? Воспользоваться можно только у партнёра после согласования цены.`))return;
      button.disabled=true;
      try{
        const result=await call('/api/rewards/buy-discount',{method:'POST',data:{percent}});
        await reload();notice('Промокод создан. Открой «Мои промокоды» или отправь /promos боту.');
      }catch(e){notice(e.message);await reload();}
    });
  });
  $('rwCreateCode')?.addEventListener('click',newTestCode);
  $('rwCreateReferral')?.addEventListener('click',newReferral);
  void reload();
  if(!token){const pending=readPendingAuth();if(pending)void pollPendingLogin(pending);}
})();
