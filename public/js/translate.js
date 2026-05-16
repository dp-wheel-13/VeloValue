/* ===========================================================
   VeloValue – Optimized Global Translator
   -----------------------------------------------------------
   ✅ Deduplicates repeated text
   ✅ Skips icons, emojis, and UI symbols
   ✅ Caches translations for session
   ✅ Persists language in localStorage
   ✅ Works on page load and dynamic updates
   =========================================================== */

const translationCache = {};

// Utility: check if a string is "translatable"
function isTranslatable(text) {
  if (!text || text.trim() === "") return false;
  // skip symbols/icons/emojis
  const nonTranslatable = /^[\s\p{So}\p{Sk}]+$/u;
  return !nonTranslatable.test(text);
}

// Extract text nodes from an element
function getTextNodes(el) {
  const nodes = [];
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE && isTranslatable(node.textContent)) {
      nodes.push(node);
    }
  });
  return nodes;
}

// Translate all page text
async function translatePage(targetLang) {
  const elements = document.querySelectorAll(
    "h1, h2, h3, p, button, a, span, label, div"
  );

  const textNodes = [];
  const textsToTranslate = [];

  elements.forEach(el => {
    if (el.dataset.noTranslate !== undefined) return;

    const nodes = getTextNodes(el);
    nodes.forEach(node => {
      const original = node.dataset.originalText || node.textContent.trim();
      node.dataset.originalText = original;
      if (!translationCache[original + targetLang] && !textsToTranslate.includes(original)) {
        textsToTranslate.push(original);
      }
      textNodes.push(node);
    });
  });

  if (textsToTranslate.length === 0) return;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: textsToTranslate, targetLang })
    });

    const data = await res.json();
    const translations = data.translations || {};

    // Cache translations
    Object.entries(translations).forEach(([orig, tr]) => {
      translationCache[orig + targetLang] = tr;
    });

    // Apply translations
    textNodes.forEach(node => {
      const original = node.dataset.originalText;
      if (translationCache[original + targetLang]) {
        node.textContent = translationCache[original + targetLang];
      }
    });

  } catch (err) {
    console.error("Translation error:", err);
  }
}

// Set language (called from menu)
function setLanguage(lang) {
  localStorage.setItem("language", lang);
  translatePage(lang);
}

// Auto-load saved language
document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("language");
  if (savedLang && savedLang !== "EN") {
    translatePage(savedLang);
  }
});

// Expose globally for menu buttons
window.setLanguage = setLanguage;
