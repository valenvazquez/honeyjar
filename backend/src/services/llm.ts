import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

const client = new GoogleGenAI({ apiKey: config.GOOGLE_API_KEY });

export async function chat(
  systemPrompt: string,
  userMessage: string,
  history: Array<{ role: "user" | "model"; content: string }> = []
): Promise<string> {
  const contents = [
    ...history.map((m) => ({
      role: m.role as "user" | "model",
      parts: [{ text: m.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const response = await client.models.generateContent({
    model: config.GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
    },
  });

  return response.text ?? "";
}
