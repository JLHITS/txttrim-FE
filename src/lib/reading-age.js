const countSyllables = (word) => {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const syllables = word.match(/[aeiouy]{1,2}/g);
  return syllables ? syllables.length : 1;
};

export const calculateReadingAge = (text) => {
  if (!text.trim()) return null;

  const cleanText = text.replace(/[^\w\s.?!]/g, "");
  const words = cleanText.split(/\s+/).filter((w) => w.length > 0);
  const sentences = cleanText
    .split(/[.?!]+/)
    .filter((s) => s.trim().length > 0);

  if (words.length === 0 || sentences.length === 0) return null;

  const totalWords = words.length;
  const totalSentences = sentences.length;
  const totalSyllables = words.reduce(
    (acc, word) => acc + countSyllables(word),
    0,
  );

  const asl = totalWords / totalSentences;
  const asw = totalSyllables / totalWords;
  const grade = 0.39 * asl + 11.8 * asw - 15.59;
  const age = Math.round(grade + 5);

  if (age < 6)
    return {
      score: age,
      label: "Very Simple",
      color:
        "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    };
  if (age <= 11)
    return {
      score: age,
      label: "Perfect (NHS Standard)",
      color:
        "text-green-700 bg-green-100 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
    };
  if (age <= 14)
    return {
      score: age,
      label: "Moderate",
      color:
        "text-yellow-700 bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
    };
  return {
    score: age,
    label: "Complex",
    color:
      "text-red-700 bg-red-100 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  };
};
