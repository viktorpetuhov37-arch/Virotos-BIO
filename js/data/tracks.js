// Информация о композиции. При новом релизе меняй только значения в этом файле.
export const track = {
  title: "Когда идёт дождь",
  artist: "Virotos",
  releaseStatus: "◌ Неизданный трек · дата релиза не объявлена",
  audio: new URL("../../music/kogda-idet-dozhd.mp3", import.meta.url).href,
  lyrics: new URL("../../music/kogda-idet-dozhd.lrc", import.meta.url).href,
  durationLabel: "2:35",
  // Паузы между вокальными частями в секундах: [начало, конец].
  instrumentalRanges: [[71, 85.8], [152.5, Infinity]],
};
