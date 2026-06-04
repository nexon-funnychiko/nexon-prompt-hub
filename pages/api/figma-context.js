import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL이 없습니다." });

  const keyMatch = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  const nodeMatch = url.match(/node-id=([^&]+)/);
  const fileKey = keyMatch?.[1];
  const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]) : null;

  if (!fileKey) return res.status(400).json({ error: "Figma URL 형식이 올바르지 않습니다." });
  if (!FIGMA_TOKEN) return res.status(500).json({ error: "FIGMA_ACCESS_TOKEN 환경변수가 없습니다." });

  try {
    const figmaRes = await fetch(
      nodeId
        ? `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`
        : `https://api.figma.com/v1/files/${fileKey}`,
      { headers: { "X-Figma-Token": FIGMA_TOKEN } }
    );
    const figmaData = await figmaRes.json();
    if (figmaData.err) throw new Error(`Figma API 오류: ${figmaData.err}`);

    const fileName = figmaData.name || "Figma 파일";

    let screenshotUrl = null;
    try {
      const targetNodeId = nodeId || "0:1";
      const imgRes = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(targetNodeId)}&format=png&scale=2`,
        { headers: { "X-Figma-Token": FIGMA_TOKEN } }
      );
      const imgData = await imgRes.json();
      screenshotUrl = imgData.images?.[targetNodeId] || Object.values(imgData.images || {})[0] || null;
    } catch (e) {
      console.warn("Image fetch failed:", e.message);
    }

    const contentBlocks = [];
    if (screenshotUrl) {
      contentBlocks.push({ type: "image", source: { type: "url", url: screenshotUrl } });
    }
    contentBlocks.push({
      type: "text",
      text: `Figma 파일명: ${fileName}
${screenshotUrl ? "위 스크린샷을 분석하고, " : ""}아래 구조 데이터를 바탕으로 이미지 생성에 활용할 스타일 가이드를 한국어로 작성해줘.

Figma 데이터: ${JSON.stringify(figmaData).slice(0, 2000)}

다음 항목을 포함해줘:
1. 전체 아트 스타일과 분위기
2. 주요 색상 팔레트
3. 캐릭터/오브젝트 디자인 특징
4. 구도와 레이아웃 특징
5. 이미지 생성 프롬프트 키워드`,
    });

    const analysisRes = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const analysisText = analysisRes.content.find((b) => b.type === "text")?.text || "";

    let screenshotBase64 = null;
    if (screenshotUrl) {
      try {
        const imgFetch = await fetch(screenshotUrl);
        const imgBuffer = await imgFetch.arrayBuffer();
        screenshotBase64 = Buffer.from(imgBuffer).toString("base64");
      } catch (e) {
        console.warn("Base64 failed:", e.message);
      }
    }

    res.status(200).json({
      title: fileName,
      context: analysisText,
      screenshotBase64,
      screenshotMediaType: "image/png",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
