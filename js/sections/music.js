import { categories, tracks } from "../data/tracks.js";

const card = track => `
  <button class="track-card" type="button" data-track="${track.id}" aria-pressed="false">
    <span class="track-cover track-cover-${track.art}" aria-hidden="true"><span>${track.artSymbol}</span></span>
    <span class="track-card-text">
      <span class="track-card-name">${track.title}</span>
      <span class="track-card-meta">${track.statusLabel}</span>
    </span>
    <span class="track-card-time">${track.durationLabel}</span>
    <span class="track-card-arrow" aria-hidden="true">↗</span>
  </button>`;

const filters = [
  { id: "all", label: "Все", description: "Каждая песня — своя история." },
  ...categories,
];

export const music = {
  title: "Virotos Music",
  html: `
    <div class="music-catalog" id="musicCatalog">
      <div class="catalog-topline">
        <div>
          <p class="catalog-overline">КОЛЛЕКЦИЯ / ${String(tracks.length).padStart(2, "0")} ТРЕКА</p>
          <h2 class="catalog-title">Дискография</h2>
        </div>
        <span class="catalog-mark" aria-hidden="true">♫</span>
      </div>
      <div class="music-tabs" role="tablist" aria-label="Категории треков">
        ${filters.map(filter => `<button class="music-tab" id="tab-${filter.id}" data-category="${filter.id}" role="tab" aria-selected="${filter.id === "all"}" type="button">${filter.label}<span class="music-tab-count">${filter.id === "all" ? tracks.length : tracks.filter(track => track.category === filter.id).length}</span></button>`).join("")}
      </div>
      <p class="catalog-caption" id="catalogCaption">Каждая песня — своя история.</p>
      <div class="music-track-list" id="musicTrackList" role="tabpanel" aria-label="Список треков">
        ${tracks.map(card).join("")}
      </div>
    </div>
    <div class="music-player-shell" id="musicPlayerShell">
      <div class="music-player" id="musicPlayer">
        <div class="music-art music-art-flowers" id="musicArt" aria-hidden="true">
          <div class="music-art-moon"></div>
          <div class="music-art-lines"></div>
          <span class="music-art-label">VIROTOS / MUSIC</span>
          <span class="music-art-symbol" id="musicArtSymbol">✿</span>
        </div>
        <div class="music-release-status" id="musicStatus"></div>
        <h3 class="music-title" id="musicTitle"></h3>
        <div class="music-artist" id="musicArtist">Virotos</div>
        <p class="music-track-description" id="musicDescription"></p>
        <audio id="musicAudio" preload="metadata"></audio>
        <div class="music-seek-row">
          <label for="musicSeek" class="visually-hidden">Перемотка трека</label>
          <input id="musicSeek" class="music-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Положение воспроизведения">
          <div class="music-times"><span id="musicNow">0:00</span><span id="musicDuration">0:00</span></div>
        </div>
        <div class="music-controls">
          <button type="button" class="music-play" id="musicPlay" aria-label="Воспроизвести трек">▶</button>
          <div class="music-volume">
            <span aria-hidden="true">♫</span>
            <label for="musicVolume" class="visually-hidden">Громкость</label>
            <input type="range" id="musicVolume" min="0" max="1" step="0.05" value="0.85" aria-label="Громкость">
          </div>
        </div>
        <button type="button" class="music-share-track" id="shareTrack"><span aria-hidden="true">↗</span> Поделиться треком</button>
        <section class="lyrics-wrap" aria-label="Текст песни">
          <div class="lyrics-header">
            <strong>♫ Текст песни</strong>
            <button type="button" class="lyrics-toggle" id="lyricsToggle" aria-expanded="true" aria-controls="lyricsStage">Скрыть текст</button>
          </div>
          <div class="lyrics-stage" id="lyricsStage" aria-label="Субтитры песни"></div>
        </section>
        <p class="lyrics-note" id="lyricsNote" hidden>Таймкоды пока ориентировочные — их можно настроить в редакторе.</p>
        <p class="music-error" id="musicError" role="alert" hidden>Не удалось загрузить аудио. Проверь файл и подключение.</p>
      </div>
    </div>
  `,
};
