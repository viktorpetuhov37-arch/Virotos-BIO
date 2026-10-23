/** Музыкальный каталог. Новый трек добавляется одной записью в tracks. */
export const categories = [
  { id: "published", label: "Опубликовано", description: "Песни, которыми уже хочется делиться." },
  { id: "exclusive", label: "Эксклюзивы", description: "То, что пока можно услышать только здесь." },
  { id: "demo", label: "Демо", description: "Черновики, эксперименты и идеи в процессе." },
];

export const tracks = [
  {
    id: "kartina-so-tsvetami",
    title: "Картина со цветами",
    artist: "Virotos",
    category: "published",
    statusLabel: "Опубликовано",
    durationLabel: "3:28",
    art: "flowers",
    artSymbol: "✿",
    description: "История, рассказанная через рисунки, цветы и воспоминания.",
    audio: new URL("../../music/kartina-so-tsvetami.mp3", import.meta.url).href,
    lyrics: new URL("../../music/kartina-so-tsvetami.lrc", import.meta.url).href,
    // Пока приблизительные границы инструментального проигрыша — уточняются вместе с LRC.
    instrumentalRanges: [[144.4, 163.5]],
    lyricsDraft: true,
  },
  {
    id: "kogda-idet-dozhd",
    title: "Когда идёт дождь",
    artist: "Virotos",
    category: "exclusive",
    statusLabel: "Эксклюзив · не выходил",
    durationLabel: "2:35",
    art: "rain",
    artSymbol: "☂",
    description: "Песня о памяти, расстоянии и дожде.",
    audio: new URL("../../music/kogda-idet-dozhd.mp3", import.meta.url).href,
    lyrics: new URL("../../music/kogda-idet-dozhd.lrc", import.meta.url).href,
    instrumentalRanges: [[71, 85.8], [152.5, Infinity]],
    lyricsDraft: true,
  },
  {
    id: "poka-ty-ryadom",
    title: "Пока ты рядом",
    artist: "Virotos",
    category: "demo",
    statusLabel: "Демо · в работе",
    durationLabel: "2:55",
    art: "dusk",
    artSymbol: "✧",
    description: "Черновая версия. Текст песни пока не добавлен.",
    audio: new URL("../../music/poka-ty-ryadom.mp3", import.meta.url).href,
    lyrics: null,
    instrumentalRanges: [],
    lyricsDraft: false,
  },
];

export function findTrack(id) {
  return tracks.find(track => track.id === id) ?? tracks[0];
}

// Совместимость со старой версией плеера.
export const track = tracks[0];
