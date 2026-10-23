// Формат LRC: [00:18.60]Строка текста. Изменяй таймкоды только в .lrc.
export function parseLrc(source) {
  const result = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\](.*)$/);
    if (!match || !match[4].trim()) continue;
    const fraction = match[3] ? Number("0." + match[3]) : 0;
    result.push([Number(match[1])*60 + Number(match[2]) + fraction, match[4].trim()]);
  }
  return result.sort((a,b) => a[0] - b[0]);
}

export function createLyricsController(stage, audio, ranges = []) {
  let lines = [];
  let buttons = [];
  let lastIndex = -2;

  function sync(force = false) {
    const time = audio.currentTime;
    let index = -1;
    let left = 0, right = lines.length - 1;
    while (left <= right) {
      const mid = (left + right) >> 1;
      if (lines[mid][0] <= time) { index = mid; left = mid + 1; }
      else right = mid - 1;
    }
    if (ranges.some(([start, end]) => time >= start && time < end)) index = -1;
    if (index === lastIndex && !force) return;

    buttons.forEach((btn,i) => {
      btn.classList.toggle("active", i === index);
      btn.classList.toggle("past", index >= 0 && i < index);
      if (i === index) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
    if (index >= 0 && !stage.hidden) {
      const target = buttons[index];
      const top = target.offsetTop - stage.offsetTop - stage.clientHeight * .42;
      stage.scrollTo({top: Math.max(0,top), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }
    lastIndex = index;
  }

  function render() {
    stage.replaceChildren();
    buttons = lines.map(([start, text], i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lyric-line";
      button.textContent = text;
      button.setAttribute("aria-label", `Перемотать на строчку ${i+1}: ${text}`);
      button.addEventListener("click", () => { audio.currentTime = start; sync(true); });
      stage.appendChild(button);
      return button;
    });
    lastIndex = -2;
    sync(true);
  }
  function setLines(newLines) { lines = newLines; render(); }
  function showUnavailable() {
    const placeholder = document.createElement("p");
    placeholder.className = "lyrics-empty";
    placeholder.textContent = "Текст песни пока недоступен";
    stage.replaceChildren(placeholder);
  }
  return { setLines, sync, showUnavailable };
}
