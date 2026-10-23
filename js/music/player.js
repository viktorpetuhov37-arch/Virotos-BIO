import { track } from "../data/tracks.js";
import { parseLrc, createLyricsController } from "./lyrics.js";

const clock = value => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const whole = Math.floor(value);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

// Вызывается при открытии блока «Моя музыка».
export function initMusicPlayer() {
  const audio = document.getElementById("musicAudio");
  if (!audio) return;
  const play = document.getElementById("musicPlay");
  const seek = document.getElementById("musicSeek");
  const now = document.getElementById("musicNow");
  const duration = document.getElementById("musicDuration");
  const volume = document.getElementById("musicVolume");
  const error = document.getElementById("musicError");
  const stage = document.getElementById("lyricsStage");
  const toggle = document.getElementById("lyricsToggle");
  const lyrics = createLyricsController(stage, audio, track.instrumentalRanges);
  lyrics.showUnavailable();

  // Текст находится отдельно от кода. На GitHub Pages LRC загружается по HTTP.
  fetch(track.lyrics, {cache: "no-cache"})
    .then(response => { if (!response.ok) throw new Error("LRC недоступен"); return response.text(); })
    .then(text => {
      if (!audio.isConnected) return;
      const parsed = parseLrc(text);
      if (parsed.length) lyrics.setLines(parsed);
    })
    .catch(() => { /* Плеер продолжит работать без текста. */ });

  toggle.addEventListener("click", () => {
    stage.hidden = !stage.hidden;
    toggle.textContent = stage.hidden ? "Показать текст" : "Скрыть текст";
    toggle.setAttribute("aria-expanded", String(!stage.hidden));
    if (!stage.hidden) lyrics.sync(true);
  });

  const refresh = () => {
    now.textContent = clock(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      duration.textContent = clock(audio.duration);
      seek.value = Math.round(audio.currentTime / audio.duration * 1000) || 0;
    }
    play.textContent = audio.paused ? "▶" : "Ⅱ";
    play.setAttribute("aria-label", audio.paused ? "Воспроизвести трек" : "Поставить на паузу");
    lyrics.sync();
  };

  play.addEventListener("click", async () => {
    if (audio.paused) {
      try { error.hidden = true; await audio.play(); }
      catch { error.hidden = false; }
    } else audio.pause();
    refresh();
  });
  for (const event of ["loadedmetadata","timeupdate","play","pause","ended"]) audio.addEventListener(event,refresh);
  audio.addEventListener("error", () => { error.hidden = false; refresh(); });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = audio.duration * Number(seek.value) / 1000;
      refresh();
    }
  });
  volume.addEventListener("input", () => {audio.volume = Number(volume.value);});
  audio.volume = Number(volume.value);
  refresh();
}
