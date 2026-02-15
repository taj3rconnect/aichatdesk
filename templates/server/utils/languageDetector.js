/**
 * @file languageDetector — Heuristic language detection from user text
 * @description Detects the language of user messages using Unicode character set matching
 * (CJK, Arabic, Cyrillic, Korean) and Latin-alphabet common word scoring (Spanish, French,
 * German, Portuguese). Defaults to English when no strong signal is detected.
 * @module utils/languageDetector
 */

/**
 * Detect language from text using heuristic-based approach
 * @param {string} text - User message text
 * @returns {string} ISO 639-1 language code (en, es, fr, de, pt, zh, ja, ar, ru, ko)
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return 'en';
  }

  const normalized = text.toLowerCase();

  // Check for non-Latin character sets first (high confidence)
  if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
    return 'zh'; // Chinese/Japanese characters
  }
  if (/[\u0600-\u06ff]/.test(text)) {
    return 'ar'; // Arabic
  }
  if (/[\u0400-\u04ff]/.test(text)) {
    return 'ru'; // Cyrillic (Russian)
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko'; // Korean
  }

  // For Latin alphabet, use common word detection
  const languagePatterns = {
    es: ['el', 'la', 'de', 'que', 'y', 'es', 'en', 'los', 'las', 'un', 'una', 'por', 'con', 'cómo', 'está', 'hola'],
    fr: ['le', 'la', 'de', 'et', 'un', 'une', 'est', 'dans', 'pour', 'je', 'vous', 'bonjour', 'merci'],
    de: ['der', 'die', 'das', 'und', 'ist', 'in', 'den', 'ein', 'eine', 'nicht', 'ich', 'sie', 'mit'],
    pt: ['o', 'a', 'de', 'que', 'não', 'e', 'os', 'as', 'um', 'uma', 'para', 'com', 'como', 'está', 'olá']
  };

  // Count matches for each language
  const scores = {};
  for (const [lang, words] of Object.entries(languagePatterns)) {
    scores[lang] = 0;
    for (const word of words) {
      // Match whole words only (with word boundaries)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = normalized.match(regex);
      if (matches) {
        scores[lang] += matches.length;
      }
    }
  }

  // Find language with highest score
  let maxScore = 0;
  let detectedLang = 'en';

  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang;
    }
  }

  // Require at least 1 match for non-English detection
  if (maxScore === 0) {
    return 'en';
  }

  return detectedLang;
}

module.exports = { detectLanguage };
