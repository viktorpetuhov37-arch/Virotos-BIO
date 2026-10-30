/* VIROTOS 3.0 — shared visual theme. No interaction with the games/music logic. */
(() => {
  'use strict';
  const KEY = 'virotos-color-theme-v3';
  const root = document.documentElement;
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (_) { /* private mode */ }
  let theme = stored === 'light' || stored === 'dark' ? stored : 'dark';

  function apply(next, persist = false) {
    theme = next;
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = next === 'light' ? '#f2f3f0' : '#0b141b';
    if (persist) { try { localStorage.setItem(KEY, next); } catch (_) {} }
    const toggle = document.getElementById('virotos-theme-toggle');
    if (toggle) {
      const toLight = next === 'dark';
      toggle.setAttribute('aria-label', `Включить ${toLight ? 'светлую' : 'тёмную'} тему`);
      toggle.setAttribute('title', `Включить ${toLight ? 'светлую' : 'тёмную'} тему`);
      toggle.setAttribute('aria-pressed', String(next === 'light'));
      toggle.innerHTML = toLight
        ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg><span>День</span>'
        : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.6 15.8A8.8 8.8 0 0 1 8.2 3.4 8.8 8.8 0 1 0 20.6 15.8Z"/></svg><span>Ночь</span>';
    }
  }
  // Run in the <head>, before CSS to avoid a flash of the wrong palette.
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('main > header');
    if (!header || document.getElementById('virotos-theme-toggle')) return;
    const note = Array.from(header.children).find(el => !el.classList.contains('logo'));
    const controls = document.createElement('div');
    controls.className = 'virotos-header-actions';
    if (note) {
      note.classList.add('virotos-header-note');
      controls.appendChild(note);
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'virotos-theme-toggle';
    button.className = 'virotos-theme-toggle';
    button.addEventListener('click', () => apply(theme === 'dark' ? 'light' : 'dark', true));
    controls.appendChild(button);
    header.appendChild(controls);
    apply(theme);
  });
  // Another tab may change the theme — update this one too.
  window.addEventListener('storage', event => {
    if (event.key === KEY && (event.newValue === 'dark' || event.newValue === 'light')) apply(event.newValue);
  });
})();
