// translate.js

// Function to translate text using your backend route
async function translateText(text, targetLang) {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLang }),
    });

    const data = await res.json();
    return data.translatedText;
  } catch (err) {
    console.error("Translation error:", err);
    return text; // fallback to original text
  }
}

// Function to translate all text on the page
async function translatePage(targetLang) {
  // Get all text elements on the page
  const elements = document.querySelectorAll("h1, h2, h3, p, button, a, span, label");

  for (const el of elements) {
    const originalText = el.dataset.originalText || el.textContent.trim();
    if (!originalText) continue;

    // Store original text if not stored before
    if (!el.dataset.originalText) el.dataset.originalText = originalText;

    const translatedText = await translateText(originalText, targetLang);
    el.textContent = translatedText;
  }
}
