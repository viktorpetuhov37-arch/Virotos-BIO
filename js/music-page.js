import { music } from "./sections/music.js";
import { findTrack } from "./data/tracks.js";
import { initMusicPlayer } from "./music/player.js";

const content = document.getElementById("musicContent");
content.innerHTML = music.html;
const requestedTrack = new URLSearchParams(location.search).get("track");
const player = initMusicPlayer(findTrack(requestedTrack));
document.getElementById("year").textContent = new Date().getFullYear();

const toast = document.getElementById("toast");
let toastTimeout;

async function copy(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
      area.remove();
    }
    toast.textContent = "Ссылка скопирована!";
  } catch {
    toast.textContent = "Не удалось скопировать. Адрес: " + text;
  }
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

document.getElementById("copyMusicLink").addEventListener("click", () => copy("https://virotos.ru/music/"));
document.getElementById("shareTrack").addEventListener("click", () => {
  const id = player.getTrack().id;
  copy(`https://virotos.ru/music/?track=${encodeURIComponent(id)}`);
});
