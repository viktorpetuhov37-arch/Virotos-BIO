/* Virotos Rewards v0.4 — verified VP discount vouchers and Telegram account. */
import { API_BASE } from './data/game2048-config.js';
import { AUTH_STORAGE_KEY, readAuthToken, saveAuthToken, clearAuthToken, readPendingAuth, savePendingAuth, clearPendingAuth } from './virotos-auth.js';
(() => {
  'use strict';
  const API=String(API_BASE||'').replace(/\/+$/,'');
  const KEY=AUTH_STORAGE_KEY;
  let token=readAuthToken();
  let activePolling=false;
  let giftHistoryCursor=null;
  let giftHistoryLoaded=false;
  let giftHistoryLoading=false;
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
      const title=document.createElement('strong');title.textContent=item.kind==='test'?'Проверочный код · 0 ₽':`Скидка ${item.discountPercent}%`;
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
  // 0.6: public seller-managed catalog, independent of Telegram login.
  let catalogItems=[],catalogFilter='all',catalogSearch='',catalogPage=0,catalogTotal=0,catalogRequestSeq=0,catalogMoreLoading=false,ordersOpen=true,checkoutGift=null,checkoutPreview=null,checkoutRequestId=null;
  const fmtMoney=kop=>(Number(kop)/100).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})+' ₽';
  function invalidateCheckout(){checkoutPreview=null;const submit=$('rwCheckoutSubmit');if(submit)submit.disabled=true;}
  function chooseCatalogGift(g){
    if(!token){notice('Для оформления теста войди через Telegram.');$('rwLogin')?.focus();return;}
    checkoutGift=g;checkoutRequestId=crypto.randomUUID();invalidateCheckout();
    const section=$('rwCheckout');if(!section)return;
    $('rwCheckoutTitle').textContent=g.title;
    $('rwCheckoutPrice').textContent=Number(g.priceRub).toLocaleString('ru-RU')+' ₽';
    $('rwCheckoutPromo').value='';
    $('rwCheckoutResult').textContent='Проверь стоимость и промокод. Резерв на 24 часа, без реальной оплаты.';
    section.hidden=false;section.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  async function calculateCheckout(){
    if(!checkoutGift)return;
    const button=$('rwCheckoutCalculate');button.disabled=true;invalidateCheckout();
    $('rwCheckoutResult').textContent='Проверяем цену и промокод на сервере…';
    try{
      const result=await call('/api/rewards/gift-order-preview',{method:'POST',data:{catalogId:checkoutGift.id,promoCode:$('rwCheckoutPromo').value}});
      const q=result.quote;checkoutPreview=q;
      $('rwCheckoutPrice').textContent=Number(q.priceRub).toLocaleString('ru-RU')+' ₽';
      $('rwCheckoutResult').textContent='Скидка: '+fmtMoney(q.discountKopeks)+' · Итого: '+fmtMoney(q.totalKopeks)+
        (q.promoCode?' · '+(q.demo?'демонстрационный код':'купон закрепляется за тестовым заказом, без погашения'):'')+
        '. Резерв на 24 часа: деньги и VP не списываются.';
      $('rwCheckoutSubmit').disabled=false;
    }catch(e){$('rwCheckoutResult').textContent=e.message;notice(e.message);}
    finally{button.disabled=false;}
  }
  $('rwCheckoutPromo')?.addEventListener('input',()=>{
    invalidateCheckout();if($('rwCheckoutResult'))$('rwCheckoutResult').textContent='Нажми «Рассчитать», чтобы увидеть точную стоимость.';
  });
  $('rwCheckoutCalculate')?.addEventListener('click',()=>void calculateCheckout());
  $('rwCheckoutCancel')?.addEventListener('click',()=>{invalidateCheckout();checkoutGift=null;checkoutRequestId=null;$('rwCheckout').hidden=true;});
  $('rwCheckoutSubmit')?.addEventListener('click',async()=>{
    if(!checkoutGift||!checkoutPreview)return;
    if(String($('rwCheckoutPromo').value||'').trim().toUpperCase()!==checkoutPreview.promoCode){invalidateCheckout();return;}
    if(!confirm('Зарезервировать «'+checkoutGift.title+'» на 24 часа по цене '+fmtMoney(checkoutPreview.totalKopeks)+'? Это тест, оплаты и передачи нет.'))return;
    const button=$('rwCheckoutSubmit');button.disabled=true;
    try{
      const result=await call('/api/rewards/gift-order-test',{method:'POST',data:{catalogId:checkoutGift.id,promoCode:checkoutPreview.promoCode,
        expectedPriceRub:checkoutPreview.priceRub,expectedDiscountKopeks:checkoutPreview.discountKopeks,requestId:checkoutRequestId}});
      $('rwCheckout').hidden=true;checkoutGift=null;checkoutPreview=null;checkoutRequestId=null;
      await reload();await loadCatalog();notice('Резерв № '+result.orderId+' создан на 24 часа. Открой заказ в Telegram.');
    }catch(e){invalidateCheckout();$('rwCheckoutResult').textContent=e.message;notice(e.message);await loadCatalog();}
  });
  function renderCatalog(){
    const root=$('rwCatalogItems');if(!root)return;
    root.replaceChildren();
    const list=catalogItems;
    const count=$('rwCatalogCount');if(count)count.textContent='Показано '+list.length+' из '+catalogTotal;
    const more=$('rwCatalogMore');if(more){more.hidden=list.length>=catalogTotal;more.disabled=catalogMoreLoading;}
    if(!list.length){const p=document.createElement('p');p.className='rw-empty';p.textContent='В этой категории пока нет подарков.';root.append(p);return;}
    const statuses={available:'В наличии',reserved:'Зарезервирован',preorder:'Под заказ',unavailable:'Нет в наличии'};
    for(const g of list){
      const card=document.createElement('article');card.className='rw-catalog-card';
      const art=document.createElement('div');art.className='rw-catalog-art';
      if(g.hasPhoto){
        const image=document.createElement('img');image.loading='lazy';image.alt='Фото: '+g.title;
        image.src=API+'/api/rewards/gifts/photo/'+g.id;
        image.addEventListener('error',()=>{image.remove();art.textContent='🎁';},{once:true});art.append(image);
      }else art.textContent='🎁';
      const main=document.createElement('div');main.className='rw-catalog-info';
      const name=document.createElement('strong');name.textContent=g.title;
      const price=document.createElement('span');price.className='rw-catalog-price';price.textContent=Number(g.priceRub).toLocaleString('ru-RU')+' ₽';
      const state=document.createElement('small');state.className='rw-catalog-state rw-catalog-'+g.status;
      const units=Math.max(0,Number(g.stockAvailable||0));
      state.textContent=(statuses[g.status]||g.status)+(g.status==='available'?' · свободно: '+units+' шт.':'');
      const btn=document.createElement('button');btn.className='shop-primary-button';btn.type='button';
      const enabled=g.status==='available'&&ordersOpen&&units>0;btn.disabled=!enabled;btn.textContent=
        g.status==='available'&&!ordersOpen?'Приём на паузе':enabled?'Резерв · тест':
        g.status==='available'?'Нет свободных':g.status==='preorder'?'Уточнить наличие':'Недоступно';
      if(g.status==='preorder'){
        btn.disabled=false;btn.className='shop-outline-button';
        btn.addEventListener('click',()=>window.open('https://t.me/Virotos_bot?start=customgift_'+g.id,'_blank','noopener,noreferrer'));
      }
      if(enabled)btn.addEventListener('click',async()=>{
        chooseCatalogGift(g);
      });
      main.append(name,price,state,btn);card.append(art,main);root.append(card);
    }
  }
  async function loadCatalog(append=false){
    if(!$('rwCatalogItems')||(append&&catalogMoreLoading))return;
    const seq=++catalogRequestSeq;
    const page=append?catalogPage+1:0;
    if(append)catalogMoreLoading=true;
    try{
      const params=new URLSearchParams({paged:'1',page:String(page),status:catalogFilter,q:catalogSearch});
      const result=await call('/api/rewards/gifts/catalog?'+params.toString());
      if(seq!==catalogRequestSeq)return; // Another search/filter was started while fetching.
      const fresh=Array.isArray(result.items)?result.items:[];
      catalogItems=append?catalogItems.concat(fresh):fresh;
      catalogPage=page;catalogTotal=Number(result.total||0);ordersOpen=result.ordersOpen!==false;
      renderCatalog();
    }catch(e){if(seq===catalogRequestSeq){notice('Не удалось загрузить каталог: '+e.message);if(!append){catalogItems=[];catalogTotal=0;renderCatalog();}}}
    finally{if(append)catalogMoreLoading=false;if(seq===catalogRequestSeq)renderCatalog();}
  }
  document.querySelectorAll('[data-catalog-filter]').forEach(button=>button.addEventListener('click',()=>{
    catalogFilter=button.dataset.catalogFilter;
    document.querySelectorAll('[data-catalog-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    void loadCatalog();
  }));
  $('rwCatalogRefresh')?.addEventListener('click',()=>void loadCatalog());
  let catalogSearchTimer=0;
  $('rwCatalogSearch')?.addEventListener('input',e=>{
    catalogSearch=String(e.target.value||'').trim().slice(0,80);
    clearTimeout(catalogSearchTimer);catalogSearchTimer=setTimeout(()=>void loadCatalog(),180);
  });
  $('rwCatalogMore')?.addEventListener('click',()=>void loadCatalog(true));
  const GIFT_STAGES={new:'Ожидает продавца',accepted:'Принята продавцом',quoted:'Цена предложена',confirmed:'Цена согласована',paid:'Оплата отмечена (тест)',delivered:'Передача отмечена (тест)',cancelled:'Отменена'};
  function renderGiftOrders(orders,rootId='rwGiftOrders',append=false){
    const el=$(rootId);if(!el)return;
    if(!append)el.replaceChildren();
    if(!orders.length&&!append){const p=document.createElement('p');p.className='rw-empty';p.textContent=rootId==='rwGiftOrders'?'Активных заказов пока нет.':'В истории пока пусто.';el.append(p);return;}
    orders.forEach(o=>{
      const card=document.createElement('article');card.className='rw-gift-order';
      const top=document.createElement('div');top.className='rw-gift-order__top';
      const name=document.createElement('strong');name.textContent=o.description;
      const tag=document.createElement('span');tag.className='shop-pill';tag.textContent=GIFT_STAGES[o.status]||o.status;
      top.append(name,tag);
      const detail=document.createElement('small');detail.textContent='№ '+o.id+(o.priceRub?' · '+o.priceRub.toLocaleString('ru-RU')+' ₽':'')+
        (o.catalogFixed?' · Итого '+fmtMoney(o.totalKopeks)+(o.promoDiscountKopeks?' (−'+fmtMoney(o.promoDiscountKopeks)+')':''):'')+
        (o.reservationExpiresAt?' · Резерв до '+formatTime(o.reservationExpiresAt):' · Без резерва (старый заказ)'):'')+' · только тест';
      const actions=document.createElement('div');actions.className='rw-actions';
      const open=document.createElement('a');open.className='shop-outline-button';open.textContent='Открыть в боте ↗';open.href='https://t.me/Virotos_bot?start=order_'+o.id;open.target='_blank';open.rel='noopener noreferrer';actions.append(open);
      if(o.status==='quoted'&&!o.catalogFixed){
        const btn=document.createElement('button');btn.type='button';btn.className='shop-primary-button';btn.textContent='Подтвердить цену';
        btn.addEventListener('click',async()=>{
          if(!confirm('Подтвердить цену '+o.priceRub+' ₽ для ТЕСТОВОГО заказа? Оплата не требуется.'))return;
          btn.disabled=true;
          try{await call('/api/rewards/gift-order-confirm',{method:'POST',data:{id:o.id}});await reload();notice('Тестовая цена подтверждена.');}catch(e){notice(e.message);btn.disabled=false;}
        });actions.append(btn);
      }
      if(o.status==='quoted'&&!o.catalogFixed){
        const decline=document.createElement('button');decline.type='button';decline.className='shop-outline-button';decline.textContent='Отклонить цену';
        decline.addEventListener('click',async()=>{
          if(!confirm('Отклонить цену '+o.priceRub+' ₽? Продавец сможет предложить другую.'))return;
          decline.disabled=true;
          try{await call('/api/rewards/gift-order-decline',{method:'POST',data:{id:o.id}});await reload();notice('Цена отклонена. Ожидаем новое предложение продавца.');}
          catch(e){notice(e.message);decline.disabled=false;}
        });actions.append(decline);
      }
      if(['new','accepted','quoted','confirmed'].includes(o.status)){
        const btn=document.createElement('button');btn.type='button';btn.className='shop-outline-button';btn.textContent='Отменить заказ';
        btn.addEventListener('click',async()=>{
          if(!confirm('Отменить тестовый заказ '+o.id+'?'))return;
          btn.disabled=true;
          try{await call('/api/rewards/gift-order-cancel',{method:'POST',data:{id:o.id}});await reload();notice('Тестовый заказ отменён.');}catch(e){notice(e.message);btn.disabled=false;}
        });actions.append(btn);
      }
      card.append(top,detail,actions);el.append(card);
    });
  }
  async function loadGiftHistory(reset=false){
    const section=$('rwGiftHistoryDetails');if(!section||!section.open||giftHistoryLoading||!token)return;
    giftHistoryLoading=true;
    const more=$('rwGiftHistoryMore');if(more)more.disabled=true;
    try{
      if(reset){giftHistoryCursor=null;giftHistoryLoaded=false;}
      const path='/api/rewards/gift-history'+(giftHistoryCursor?'?cursor='+encodeURIComponent(giftHistoryCursor):'');
      const result=await call(path);
      renderGiftOrders(result.orders||[],'rwGiftHistory',giftHistoryLoaded);
      giftHistoryLoaded=true;
      giftHistoryCursor=result.nextCursor||null;
      if(more){more.hidden=!giftHistoryCursor;more.disabled=false;}
    }catch(e){notice('Не удалось загрузить историю: '+e.message);if(more)more.disabled=false;}
    finally{giftHistoryLoading=false;}
  }
    async function reload() {
    if(!token){setLogged(false);renderPromo([]);renderGiftOrders([]);giftHistoryCursor=null;giftHistoryLoaded=false;if($('rwGiftHistory'))$('rwGiftHistory').replaceChildren();if($('rwReferralState'))$('rwReferralState').textContent='Войди через Telegram, чтобы проверить заявки.';if($('rwReferralLink'))$('rwReferralLink').hidden=true;if($('rwCancelReferral'))$('rwCancelReferral').hidden=true;document.querySelectorAll('[data-buy-discount]').forEach(b=>b.disabled=true);if($('rwBalance'))$('rwBalance').textContent='—';notice('Войди через Telegram, чтобы открыть кошелёк и промокоды.');return;}
    try {
      const profile=await call('/api/rewards/me');
      setLogged(true,profile.player);notice('Telegram подтверждён');
      if($('rwBalance'))$('rwBalance').textContent=Number(profile.balanceVP).toLocaleString('ru-RU');
      renderPromo(profile.promos||[]);
      const codeOptions=$('rwCheckoutPromoOptions');
      if(codeOptions){codeOptions.replaceChildren();for(const p of profile.promos||[]){
        if(p.status==='active'&&Number(p.expiresAt)>Date.now()){
          const option=document.createElement('option');option.value=p.code;
          option.label=p.kind==='test'?'Проверочный · 0 ₽':`Скидка ${p.discountPercent}%`;
          codeOptions.append(option);
        }
      }}
      renderGiftOrders(profile.giftOrders||[]);
      if($('rwGiftHistoryDetails')?.open)await loadGiftHistory(true);
      document.querySelectorAll('[data-buy-discount]').forEach(button=>{
        const cost=Number(button.dataset.costVp);
        button.disabled=!profile.partnerReady||!Number.isFinite(cost)||Number(profile.balanceVP)<cost;
        button.title=!profile.partnerReady?'Скидки пока недоступны':(button.disabled?'Недостаточно VP':'');
      });
      if($('rwDiscountStatus'))$('rwDiscountStatus').textContent=profile.partnerReady?'Скидки доступны за VP.':'Скидки пока недоступны.';
      const referrals=profile.referrals||[];
      const referralState=$('rwReferralState'), referralLink=$('rwReferralLink');
      if(referralState){
        const last=referrals[0];
        referralState.textContent=!last?'Заявок пока нет.':
          (last.status==='awaiting_partner'?(last.accepted_at?'Принята продавцом · тестовый заказ № '+last.id:'Ожидает продавца · тестовая заявка № '+last.id):
          last.status==='test'?'Заявка № '+last.id+' создана. Подтверди переход в Telegram-боте.':
          last.status==='completed'?'Тест заявки № '+last.id+' завершён. Покупки не было.':
          last.closed_reason==='expired'?'Срок заявки № '+last.id+' истёк.':'Заявка № '+last.id+' отменена.');
        const cancelButton=$('rwCancelReferral');
        const cancellable=!!last&&(last.status==='test'||last.status==='awaiting_partner'&&!last.accepted_at);
        if(cancelButton){cancelButton.hidden=!cancellable;cancelButton.disabled=!cancellable;cancelButton.dataset.referralId=cancellable?last.id:'';}
        if(referralLink){
          if(last?.status==='test' && /^[a-f0-9]{20}$/.test(last.id)){
            referralLink.href='https://t.me/Virotos_bot?start=gift_'+last.id;
            referralLink.hidden=false;
            referralLink.textContent='Подтвердить переход через бота ↗';
          }else referralLink.hidden=true;
        }
      }
    }catch(e){
      if(e.status===401){token='';clearAuthToken();setLogged(false);renderPromo([]);renderGiftOrders([]);giftHistoryLoaded=false;giftHistoryCursor=null;if($('rwGiftHistory'))$('rwGiftHistory').replaceChildren();document.querySelectorAll('[data-buy-discount]').forEach(b=>b.disabled=true);if($('rwBalance'))$('rwBalance').textContent='—';}
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
      await reload();
      notice('Тестовая заявка создана. Открой бота для подтверждения.');
    }catch(e){notice(e.message);}finally{if(btn)btn.disabled=false;}
  }
  $('rwGiftRefresh')?.addEventListener('click',()=>void reload());
  $('rwGiftHistoryDetails')?.addEventListener('toggle',event=>{
    if(event.target.open && !giftHistoryLoaded)void loadGiftHistory(true);
  });
  $('rwGiftHistoryMore')?.addEventListener('click',()=>void loadGiftHistory());
  const links={reviews:'https://t.me/viktor_l1fe',seller:'https://t.me/Virotos_bot?start=customgift',bot:'https://t.me/Virotos_bot?start=rewards'};
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
    giftHistoryLoaded=false;giftHistoryCursor=null;
    if($('rwGiftHistory'))$('rwGiftHistory').replaceChildren();
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
  $('rwCancelReferral')?.addEventListener('click',async()=>{
    const button=$('rwCancelReferral'),refId=button?.dataset.referralId;
    if(!refId||!confirm('Отменить тестовую заявку '+refId+'?'))return;
    button.disabled=true;
    try{await call('/api/rewards/cancel-referral',{method:'POST',data:{id:refId}});await reload();notice('Заявка отменена.');}
    catch(e){notice(e.message);await reload();}
  });

  $('rwCheckReferral')?.addEventListener('click',()=>void reload());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&token)void reload();});
  void loadCatalog();
  void reload();
  if(!token){const pending=readPendingAuth();if(pending)void pollPendingLogin(pending);}
})();
