const { GoogleGenAI } = require('@google/genai');

let ai = null;
try {
  if (process.env.GEMINI_API_KEY) {
     ai = new GoogleGenAI();
  }
} catch (e) {
  console.warn("GoogleGenAI init failed:", e.message);
}

async function generateAlertSummary(poleId, location, timeStr) {
  const prompt = `
An emergency alert was just triggered.
Pole: ${poleId}
Location: ${location}
Time: ${timeStr}

Please generate an emergency response summary in strict JSON format matching this schema:
{
  "Severity": "Critical" | "High" | "Medium",
  "Category": "Theft" | "Assault" | "Medical" | "Panic" | "Other",
  "RecommendedResponse": "string with recommended action",
  "OperatorSummary": "1 sentence operator summary"
}
Output only the JSON object, nothing else.`;

  if (!ai) {
    return {
      Severity: "High",
      Category: "Panic",
      RecommendedResponse: "Dispatch nearest unit to investigate.",
      OperatorSummary: `Emergency SOS triggered at ${location}. Immediate response required.`
    };
  }

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    let text = response.text;
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Generation error:", error);
    return {
      Severity: "High",
      Category: "Other",
      RecommendedResponse: "Investigate immediately.",
      OperatorSummary: `Emergency triggered at ${location}. (AI summary failed)`
    };
  }
}

module.exports = { generateAlertSummary };
