import { journey as journeyEvents } from "../data/journey.js";

export const journey = {
    title: "Мой путь",
    html: `
      <button class="about-story-back" data-open-section="about" type="button">← Вернуться в «Обо мне»</button>
      <p>Важные даты и повороты моей истории — не идеальная линия,
      а мой настоящий путь.</p>
      <div class="timeline">
        ${journeyEvents.map(([date, event, extra]) => `
          <div class="event">
            <strong>${date} — ${event}</strong>
            ${extra ? `<span>+ ${extra}</span>` : ""}
          </div>
        `).join("")}
      </div>`
  };
