import { music } from "./sections/music.js";
import { initMusicPlayer } from "./music/player.js";

// Содержимое плеера остаётся единым модулем, и его можно использовать на разных страницах.
const content = document.getElementById("musicContent");
content.innerHTML = music.html;
initMusicPlayer();

document.getElementById("year").textContent = new Date().getFullYear();

const copyButton = document.getElementById("copyMusicLink");
const toast = document.getElementById("toast");
let toastTimeout;

copyButton.addEventListener("click", async () => {
  // Канонический адрес остаётся одинаковым при /music/, /music и /music/index.html.
  const shareUrl = new URL("./", document.location.href).href;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const area = document.createElement("textarea");
      area.value = shareUrl;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      if (!document.execCommand("copy")) throw new Error("Copy failed");
      area.remove();
    }
    toast.textContent = "Ссылка на музыку скопирована!";
  } catch {
    toast.textContent = "Не удалось скопировать. Ссылка: " + shareUrl;
  }
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
});
