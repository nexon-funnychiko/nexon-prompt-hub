import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SIZE_MAP = {
  "1:1": "1024x1024",
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "4:3": "1024x1024",
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { prompt, aspectId } = req.body;
  if (!prompt) return res.status(400).json({ error: "프롬프트가 없습니다." });

  const size = SIZE_MAP[aspectId] || "1024x1024";
  const cleaned = prompt.replace(/[\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 3900);

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: cleaned,
      n: 1,
      size,
      quality: "hd",
      response_format: "url",
    });

    const imageUrl = response.data[0]?.url;
    const revisedPrompt = response.data[0]?.revised_prompt;
    res.status(200).json({ imageUrl, revisedPrompt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
