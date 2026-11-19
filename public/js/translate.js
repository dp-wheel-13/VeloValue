/* VeloValue Global Translator - Persistent Cache */

const translationCache = {};
const originalTextNodes = new WeakMap();

const CACHE_PREFIX = "vv_translations_v1_";

function isTranslatable(text) {
  return !!text && text.trim() !== "" &&
    !/^[\s\p{So}\p{Sk}]+$/u.test(text);
}

function getTextNodes(el) {
  return [...el.childNodes].filter(node =>
    node.nodeType === Node.TEXT_NODE &&
    isTranslatable(node.textContent)
  );
}

function loadLanguageCache(lang) {
  try {
    const saved = localStorage.getItem(CACHE_PREFIX + lang);
    if (!saved) return;

    const parsed = JSON.parse(saved);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.assign(translationCache, Object.fromEntries(
        Object.entries(parsed).map(([text, translated]) => [
          lang + "|" + text,
          translated
        ])
      ));
    }
  } catch (err) {
    console.warn("VeloValue: Could not load translation cache:", err);
  }
}

function saveLanguageCache(lang) {
  try {
    const entries = {};

    Object.entries(translationCache).forEach(([key, value]) => {
      const prefix = lang + "|";

      if (key.startsWith(prefix)) {
        entries[key.slice(prefix.length)] = value;
      }
    });

    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify(entries));
  } catch (err) {
    console.warn("VeloValue: Could not save translation cache:", err);
  }
}

async function translatePage(targetLang) {
  const lang = String(targetLang || "en").toLowerCase();

  if (!["en", "it", "de"].includes(lang)) {
    console.warn("VeloValue: Unsupported language:", lang);
    return;
  }

  const elements = document.querySelectorAll(
    "h1, h2, h3, p, button, a, span, label, div"
  );

  const textNodes = [];
  const textsToTranslate = [];

  elements.forEach(el => {
    if (
      el.closest(".language-select") ||
      el.dataset.noTranslate !== undefined
    ) return;

    getTextNodes(el).forEach(node => {
      if (!originalTextNodes.has(node)) {
        originalTextNodes.set(node, node.textContent.trim());
      }

      const original = originalTextNodes.get(node);
      textNodes.push({ node, original });

      if (
        lang !== "en" &&
        !translationCache[lang + "|" + original] &&
        !textsToTranslate.includes(original)
      ) {
        textsToTranslate.push(original);
      }
    });
  });

  if (lang === "en") {
    textNodes.forEach(({ node, original }) => {
      node.textContent = original;
    });
    return;
  }

  // Display browser-cached translations immediately.
  textNodes.forEach(({ node, original }) => {
    const translated = translationCache[lang + "|" + original];
    if (translated) node.textContent = translated;
  });

      if (textsToTranslate.length === 0) return;

  const CHUNK_SIZE = 200;
  let hasFailures = false;

  for (let i = 0; i < textsToTranslate.length; i += CHUNK_SIZE) {
    const batch = textsToTranslate.slice(i, i + CHUNK_SIZE);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texts: batch,
          targetLang: lang
        })
      });

      if (!res.ok) {
        throw new Error("Translation API returned HTTP " + res.status);
      }

      const data = await res.json();

      if (!data.translations || typeof data.translations !== "object") {
        throw new Error("Invalid translation response.");
      }

      Object.entries(data.translations).forEach(([original, translated]) => {
        if (typeof translated === "string" && translated.length > 0) {
          translationCache[lang + "|" + original] = translated;
        }
      });

      saveLanguageCache(lang);

    } catch (err) {
      hasFailures = true;
      console.error("VeloValue translation batch failed:", err);
    }
  }

  textNodes.forEach(({ node, original }) => {
    const translated = translationCache[lang + "|" + original];
    if (translated) node.textContent = translated;
  });

  if (hasFailures) {
    console.warn("VeloValue: Some translations could not be loaded; original text remains visible for those entries.");
  }
}

function setLanguage(lang) {
  const selectedLang = String(lang || "en").toLowerCase();

  if (!["en", "it", "de"].includes(selectedLang)) {
    return Promise.resolve();
  }

  localStorage.setItem("language", selectedLang);
  document.documentElement.lang = selectedLang;

  return translatePage(selectedLang);
}

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = (localStorage.getItem("language") || "en").toLowerCase();

  loadLanguageCache("it");
  loadLanguageCache("de");

  const selector = document.getElementById("languageSelect");

  if (selector) {
    selector.value = savedLang;

    selector.addEventListener("change", event => {
      setLanguage(event.target.value);
    });
  }

  document.documentElement.lang = savedLang;

  if (savedLang !== "en") {
    translatePage(savedLang);
  }
});

window.setLanguage = setLanguage;
