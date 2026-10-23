import { tracks, categories, findTrack } from "../data/tracks.js";
import { parseLrc, createLyricsController } from "./lyrics.js";

const clock = value => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

export function initMusicPlayer(initialTrack = tracks[0]) {
  const $ = id => document.getElementById(id);
  const audio = $("musicAudio");
  if (!audio) return null;
  const play = $("musicPlay"), seek = $("musicSeek");
  const now = $("musicNow"), duration = $("musicDuration");
  const volume = $("musicVolume"), error = $("musicError");
  const stage = $("lyricsStage"), toggle = $("lyricsToggle");
  const note = $("lyricsNote"), art = $("musicArt");
  const controller = createLyricsController(stage, audio);
  const songCards = [...document.querySelectorAll(".track-card")];
  const categoryTabs = [...document.querySelectorAll(".music-tab")];
  let currentTrack;
  let lyricsRequest;

  function refresh() {
    now.textContent = clock(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      duration.textContent = clock(audio.duration);
      seek.value = Math.round(audio.currentTime / audio.duration * 1000) || 0;
    }
    play.textContent = audio.paused ? "▶" : "Ⅱ";
    play.setAttribute("aria-label", audio.paused ? "Воспроизвести трек" : "Поставить на паузу");
    controller.sync();
  }

  function setTrack(trackOrId, { fromClick = false } = {}) {
    const next = typeof trackOrId === "string" ? findTrack(trackOrId) : trackOrId;
    if (currentTrack?.id === next.id) return;
    if (lyricsRequest) lyricsRequest.abort();
    audio.pause();
    currentTrack = next;
    audio.src = next.audio;
    audio.load();
    seek.value = 0;
    now.textContent = "0:00";
    duration.textContent = next.durationLabel;
    error.hidden = true;
    $("musicTitle").textContent = next.title;
    $("musicArtist").textContent = next.artist;
    $("musicStatus").textContent = next.statusLabel;
    $("musicDescription").textContent = next.description;
    $("musicArtSymbol").textContent = next.artSymbol;
    art.className = `music-art music-art-${next.art}`;
    controller.setRanges(next.instrumentalRanges);
    songCards.forEach(button => {
      const active = button.dataset.track === next.id;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });

    // Выбранная песня сохраняется в адресе и доступна по прямой ссылке.
    const url = new URL(window.location.href);
    if (fromClick && url.pathname.includes("/music")) {
      url.searchParams.set("track", next.id);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    stage.hidden = false;
    toggle.hidden = !next.lyrics;
    toggle.textContent = "Скрыть текст";
    toggle.setAttribute("aria-expanded", "true");
    note.hidden = !next.lyricsDraft;
    controller.showUnavailable(next.lyrics ? "Загружаем текст песни…" : "Текст для этого демо пока не добавлен.");
    if (next.lyrics) {
      lyricsRequest = new AbortController();
      const requestedId = next.id;
      fetch(next.lyrics, { cache: "no-cache", signal: lyricsRequest.signal })
        .then(response => { if (!response.ok) throw new Error("LRC недоступен"); return response.text(); })
        .then(text => {
          if (currentTrack.id !== requestedId || !audio.isConnected) return;
          const parsed = parseLrc(text);
          parsed.length ? controller.setLines(parsed) : controller.showUnavailable();
        })
        .catch(err => { if (err.name !== "AbortError" && currentTrack.id === requestedId) controller.showUnavailable(); });
    }
    refresh();
    if (fromClick) $("musicPlayerShell").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function filterCategory(categoryId) {
    categoryTabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.category === categoryId)));
    songCards.forEach(card => { card.hidden = categoryId !== "all" && tracks.find(track => track.id === card.dataset.track)?.category !== categoryId; });
    const group = categories.find(category => category.id === categoryId);
    $("catalogCaption").textContent = group?.description || "Каждая песня — своя история.";
  }

  play.addEventListener("click", async () => {
    if (audio.paused) {
      try { error.hidden = true; await audio.play(); } catch { error.hidden = false; }
    } else audio.pause();
    refresh();
  });
  for (const event of ["loadedmetadata", "timeupdate", "play", "pause", "ended"]) audio.addEventListener(event, refresh);
  audio.addEventListener("error", () => { if (currentTrack) error.hidden = false; refresh(); });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = audio.duration * Number(seek.value) / 1000;
      refresh();
    }
  });
  volume.addEventListener("input", () => { audio.volume = Number(volume.value); });
  audio.volume = Number(volume.value);

  toggle.addEventListener("click", () => {
    stage.hidden = !stage.hidden;
    toggle.textContent = stage.hidden ? "Показать текст" : "Скрыть текст";
    toggle.setAttribute("aria-expanded", String(!stage.hidden));
    if (!stage.hidden) controller.sync(true);
  });
  songCards.forEach(card => card.addEventListener("click", () => setTrack(card.dataset.track, { fromClick: true })));
  categoryTabs.forEach(tab => tab.addEventListener("click", () => filterCategory(tab.dataset.category)));
  filterCategory("all");
  setTrack(initialTrack);

  return { setTrack, getTrack: () => currentTrack, filterCategory };
}
