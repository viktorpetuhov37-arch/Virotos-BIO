/* VIROTOS shared Telegram session for Shop + Arcade.
 * Secret-bearing credentials are local to this origin; never put them in URL.
 * sessionStorage is migrated once for users who logged in before the patch.
 */
export const AUTH_STORAGE_KEY = 'virotos_tg_token_v1';
const PENDING_KEY = 'virotos_tg_pending_v2';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;
const CHALLENGE_ID = /^[0-9a-f-]{36}$/;

export function readAuthToken() {
  let token = '';
  try { token = localStorage.getItem(AUTH_STORAGE_KEY) || ''; } catch {}
  if (!TOKEN_PATTERN.test(token)) {
    token = '';
    try {
      const previous = sessionStorage.getItem(AUTH_STORAGE_KEY) || '';
      if (TOKEN_PATTERN.test(previous)) {
        token = previous;
        try { localStorage.setItem(AUTH_STORAGE_KEY, token); } catch {}
      }
    } catch {}
  }
  return token;
}
export function saveAuthToken(token) {
  if (!TOKEN_PATTERN.test(String(token))) throw Error('Неверный формат сессии');
  let persisted = false;
  try { localStorage.setItem(AUTH_STORAGE_KEY, token); persisted = true; } catch {
    try { sessionStorage.setItem(AUTH_STORAGE_KEY, token); } catch {}
  }
  // Prevent a legacy tab session from resurrecting a previous account after logout.
  if (persisted) { try { sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch {} }
}
export function clearAuthToken() {
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
  try { sessionStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
}
export function readPendingAuth() {
  let p;
  try { p=JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; }
  if (!p || !CHALLENGE_ID.test(p.id) || !Number.isFinite(p.expiresAt) || p.expiresAt <= Date.now() || p.expiresAt > Date.now()+11*60000) {
    clearPendingAuth();return null;
  }
  return p;
}
export function savePendingAuth(p) {
  if (!p || !CHALLENGE_ID.test(p.id) || !Number.isFinite(Number(p.expiresAt))) return;
  try {localStorage.setItem(PENDING_KEY, JSON.stringify({id:p.id,expiresAt:Number(p.expiresAt),deepLink:String(p.deepLink || '')}));}catch{}
}
export function clearPendingAuth() {
  try { localStorage.removeItem(PENDING_KEY); } catch {}
}
