/* VIROTOS Rewards — UI demonstration only.
   All codes are local to this browser and have no cash value.
   No purchase, authentication, database write, or Telegram verification happens here.
   Replace the links below once the real partner confirms their pages. */
(() => {
  'use strict';
  const TEST_LINKS = Object.freeze({
    reviews: 'https://t.me/viktor_l1fe',  // Demo: Virotos channel; NOT Danil's reviews
    seller: 'https://t.me/Virotos',       // Demo: Virotos Telegram, NOT Danil's profile
    bot: 'https://t.me/Virotos_bot?start=rewards_demo' // Bot may only reply with existing /start text
  });
  for (const link of document.querySelectorAll('[data-rewards-target]')) {
    const url = TEST_LINKS[link.dataset.rewardsTarget];
    if (url) link.href = url;
  }
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  const toast = document.getElementById('shopToast');
  let toastTimeout;
  function announce(msg) {
    if (!toast) return;
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 2300);
  }
  const STORAGE_KEY = 'virotos-rewards-promo-demo-v1';
  function readCodes() {
    try {
      const a = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(a) ? a.filter(x => x && typeof x.code === 'string' && /^VR-DEMO-[A-Z0-9]{8}$/.test(x.code)).slice(0,3) : [];
    } catch { return []; }
  }
  function saveCodes(items) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; } catch { return false; } }
  function makeCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(8);
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
    return 'VR-DEMO-' + Array.from(bytes, b => letters[b % letters.length]).join('');
  }
  async function copy(value) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';
        document.body.appendChild(area);area.select();const success=document.execCommand('copy');area.remove();
        if (!success) throw new Error('Copy unavailable');
      }
      announce('Демо-код скопирован');
    } catch { announce('Не удалось скопировать — выдели код вручную'); }
  }
  const list = document.getElementById('demoPromoList');
  const create = document.getElementById('demoPromoCreate');
  const reset = document.getElementById('demoPromoReset');
  const input = document.getElementById('demoPromoVerifyCode');
  const verify = document.getElementById('demoPromoVerify');
  const feedback = document.getElementById('demoPromoFeedback');
  function render() {
    if (!list) return;
    const items=readCodes();list.replaceChildren();
    if (!items.length) {
      const el=document.createElement('div');el.className='shop-empty';el.textContent='Промокодов пока нет. Создай тестовый код, чтобы проверить интерфейс — это не настоящая скидка.';list.append(el);
    }
    for (const item of items) {
      const card=document.createElement('article');card.className='shop-promo';
      const head=document.createElement('div');head.className='shop-promo-head';
      const title=document.createElement('strong');title.textContent='Демо-скидка 100 ₽';
      const badge=document.createElement('span');badge.className='shop-pill';badge.textContent='ТЕСТ';head.append(title,badge);
      const code=document.createElement('div');code.className='shop-promo-code';code.textContent=item.code;
      const foot=document.createElement('div');foot.className='shop-promo-footer';
      const button=document.createElement('button');button.type='button';button.className='shop-outline-button';button.textContent='Скопировать код';button.addEventListener('click',()=>copy(item.code));
      const status=document.createElement('span');status.className='shop-promo-status';status.textContent='Только для проверки интерфейса';
      foot.append(button,status);card.append(head,code,foot);list.append(card);
    }
    if (create) create.disabled=items.length>=3;
  }
  if (create) create.addEventListener('click',()=>{
    const items=readCodes();if(items.length>=3)return;
    let code=makeCode();while(items.some(p=>p.code===code))code=makeCode();
    items.unshift({code,createdAt:Date.now()});
    if(saveCodes(items)) {render();announce('Тестовый промокод создан');}
    else announce('Браузер не разрешил локальное сохранение');
  });
  if (reset) reset.addEventListener('click',()=>{
    saveCodes([]);render();if(feedback)feedback.textContent='';announce('Тестовые коды очищены');
  });
  if (verify) verify.addEventListener('click',()=>{
    if (!input || !feedback) return;
    const code=input.value.trim().toUpperCase();
    if(!/^VR-DEMO-[A-Z0-9]{8}$/.test(code)) feedback.textContent='Неверный формат демо-кода.';
    else if(readCodes().some(x=>x.code===code)) feedback.textContent='Код найден в этом браузере. Это демопроверка, не проверка на сервере.';
    else feedback.textContent='В этом браузере такого демо-кода нет.';
  });
  render();
})();
