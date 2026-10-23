import { pages } from "./pages.js";
import { initMusicPlayer } from "./music/player.js";

const backdrop = document.getElementById("backdrop");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const closeButton = document.getElementById("closeModal");
const toast = document.getElementById("toast");

let previousFocus = null;
let toastTimer;

function openModal(key, trigger) {
  const page = pages[key];
  if (!page) return;
  previousFocus = trigger || document.activeElement;
  modalTitle.textContent = page.title;
  modalBody.innerHTML = page.html;
  modalBody.scrollTop = 0;
  backdrop.classList.add("open");
  document.body.style.overflow = "hidden";
  if (key === "music") initMusicPlayer();
  closeButton.focus();
}

function closeModal() {
  const audio = modalBody.querySelector("#musicAudio");
  if (audio) audio.pause();
  backdrop.classList.remove("open");
  document.body.style.overflow = "";
  // Remove audio on close so no orphan element keeps loading in background.
  modalBody.replaceChildren();
  if (previousFocus && previousFocus.isConnected) previousFocus.focus();
}

async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("Copy failed");
    }
    toast.textContent = "Скопировано в буфер обмена!";
  } catch {
    toast.textContent = "Не удалось скопировать. Попробуй ещё раз.";
  }
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"),2300);
}

for (const button of document.querySelectorAll("[data-modal]")) {
  button.addEventListener("click", () => openModal(button.dataset.modal, button));
}
closeButton.addEventListener("click", closeModal);
backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && backdrop.classList.contains("open")) closeModal();
});
modalBody.addEventListener("click", event => {
  const button = event.target.closest("[data-copy]");
  if (button) copyText(button.dataset.copy);
});
document.getElementById("year").textContent = new Date().getFullYear();
