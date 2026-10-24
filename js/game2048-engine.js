// Одна и та же игровая математика используется в браузере и серверной проверке рекордов.
function random(game) {
  let x = game.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  game.rng = x >>> 0;
  return game.rng / 4294967296;
}
function spawn(game) {
  const empty = [];
  for (let i = 0; i < 16; i++) if (!game.board[i]) empty.push(i);
  if (!empty.length) return false;
  const location = empty[Math.floor(random(game) * empty.length)];
  game.board[location] = random(game) < 0.9 ? 2 : 4;
  return true;
}
export function createGame(seed) {
  const game = { board: Array(16).fill(0), score: 0, rng: (seed >>> 0) || 0x9e3779b9 };
  spawn(game);
  spawn(game);
  return game;
}
export function applyMove(game, direction) {
  if (!"LRUD".includes(direction) || direction.length !== 1) return false;
  const next = game.board.slice();
  let changed = false;
  for (let outer = 0; outer < 4; outer++) {
    const indices = [];
    for (let inner = 0; inner < 4; inner++) {
      const pos = direction === "L" ? outer * 4 + inner
        : direction === "R" ? outer * 4 + (3 - inner)
        : direction === "U" ? inner * 4 + outer
        : (3 - inner) * 4 + outer;
      indices.push(pos);
    }
    const compact = indices.map(i => next[i]).filter(Boolean);
    const merged = [];
    for (let i = 0; i < compact.length; i++) {
      if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
        const value = compact[i] * 2;
        merged.push(value);
        game.score += value;
        i++;
      } else merged.push(compact[i]);
    }
    while (merged.length < 4) merged.push(0);
    indices.forEach((pos, i) => {
      if (merged[i] !== game.board[pos]) changed = true;
      next[pos] = merged[i];
    });
  }
  if (!changed) return false;
  game.board = next;
  spawn(game);
  return true;
}
export function hasMoves(game) {
  for (let i = 0; i < 16; i++) {
    if (!game.board[i]) return true;
    const row = Math.floor(i / 4), col = i % 4;
    if (col < 3 && game.board[i] === game.board[i + 1]) return true;
    if (row < 3 && game.board[i] === game.board[i + 4]) return true;
  }
  return false;
}
export function highestTile(game) { return Math.max(...game.board); }
