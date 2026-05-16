require("dotenv").config();
const axios = require("axios");

async function testDeepL() {
  try {
    const res = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      new URLSearchParams({
        auth_key: process.env.DEEPL_API_KEY,
        text: "Hello world",
        target_lang: "IT",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("DeepL API works! Translation:", res.data.translations[0].text);
  } catch (err) {
    if (err.response) {
      console.error("DeepL API error:", err.response.data);
    } else {
      console.error("DeepL request failed:", err.message);
    }
  }
}

testDeepL();
