import { track } from "../data/tracks.js";

export const music = {
    title: "Virotos Music",
    html: `
      <div class="music-player" id="musicPlayer">
        <div class="music-art" aria-hidden="true">
          <div class="music-art-moon"></div>
          <div class="music-art-lines"></div>
          <span class="music-art-label">VIROTOS / MUSIC</span>
          <span class="music-art-symbol">☂</span>
        </div>
        <div class="music-release-status">${track.releaseStatus}</div>
        <h4 class="music-title">${track.title}</h4>
        <div class="music-artist">${track.artist}</div>
        <audio id="musicAudio" preload="metadata" src="${track.audio}"></audio>
        <div class="music-seek-row">
          <label for="musicSeek" class="visually-hidden">Перемотка трека</label>
          <input id="musicSeek" class="music-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Положение воспроизведения">
          <div class="music-times"><span id="musicNow">0:00</span><span id="musicDuration">${track.durationLabel}</span></div>
        </div>
        <div class="music-controls">
          <button type="button" class="music-play" id="musicPlay" aria-label="Воспроизвести трек">▶</button>
          <div class="music-volume">
            <span aria-hidden="true">♫</span>
            <label for="musicVolume" class="visually-hidden">Громкость</label>
            <input type="range" id="musicVolume" min="0" max="1" step="0.05" value="0.85" aria-label="Громкость">
          </div>
        </div>
        <section class="lyrics-wrap" aria-label="Текст песни">
          <div class="lyrics-header">
            <strong>♫ Текст песни</strong>
            <button type="button" class="lyrics-toggle" id="lyricsToggle" aria-expanded="true" aria-controls="lyricsStage">Скрыть текст</button>
          </div>
          <div class="lyrics-stage" id="lyricsStage" aria-label="Субтитры песни"></div>
        </section>
        <p class="music-error" id="musicError" role="alert" hidden>Не удалось загрузить трек. Проверь подключение и наличие MP3.</p>
        <p class="music-footnote">Это предварительное прослушивание. Трек пока официально не выходил.</p>
      </div>`
  };
