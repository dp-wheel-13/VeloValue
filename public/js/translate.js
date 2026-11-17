/* VeloValue Global Translator */
const translationCache = {};
const originalTextNodes = new WeakMap();

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

async function translatePage(targetLang) {
  const lang = String(targetLang || "en").toLowerCase();

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

  if (textsToTranslate.length === 0) return;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: textsToTranslate,
        targetLang: lang
      })
    });

    if (!res.ok) {
      throw new Error("Translation API returned HTTP " + res.status);
    }

    const data = await res.json();

    if (!data.translations || Object.keys(data.translations).length === 0) {
      throw new Error("The translation service returned no translations.");
    }

    Object.entries(data.translations).forEach(([original, translated]) => {
      translationCache[lang + "|" + original] = translated;
    });

    textNodes.forEach(({ node, original }) => {
      const translated = translationCache[lang + "|" + original];
      if (translated) node.textContent = translated;
    });

  } catch (err) {
    console.error("VeloValue translation failed:", err);
    alert("Translation failed. Please try again later.");
  }
}

function setLanguage(lang) {
  const selectedLang = String(lang || "en").toLowerCase();
  localStorage.setItem("language", selectedLang);
  document.documentElement.lang = selectedLang;
  return translatePage(selectedLang);
}

document.addEventListener("DOMContentLoaded", () => {
  const selector = document.getElementById("languageSelect");

  if (selector) {
    const savedLang = (localStorage.getItem("language") || "en").toLowerCase();
    selector.value = savedLang;

    selector.addEventListener("change", event => {
      setLanguage(event.target.value);
    });
  }

  const savedLang = (localStorage.getItem("language") || "en").toLowerCase();
  if (savedLang !== "en") translatePage(savedLang);
});

window.setLanguage = setLanguage;
