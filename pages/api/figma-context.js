import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FIGMA_MCP = "https://mcp.figma.com/mcp";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL이 없습니다." });

  const keyMatch = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  const nodeMatch = url.match(/node-id=([^&]+)/);
  const fileKey = keyMatch?.[1];
  const nodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]) : null;

  if (!fileKey) {
    return res.status(400).json({ error: "Figma URL 형식이 올바르지 않습니다." });
  }

  try {
    const contextRes = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `Use the get_design_context Figma MCP tool to extract ALL design information.
Focus on: component names, text layers, color styles, typography, design tokens, annotations, style guide.
Return ONLY valid JSON:
{
  "title": "file or frame name",
  "text": "all text content, style descriptions, color info combined",
  "colorPalette": ["#hex1", "#hex2"],
  "styleNotes": "any style guide or art direction info"
}`,
      messages: [{ role: "user", content: `Extract design context. fileKey: ${fileKey}${nodeId ? `, nodeId: ${nodeId}` : ""}` }],
      mcp_servers: [{ type: "url", url: FIGMA_MCP, name: "figma" }],
    });

    const contextText = contextRes.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const ctxMatch = contextText.match(/\{[\s\S]*\}/);
    const ctxParsed = ctxMatch ? JSON.parse(ctxMatch[0]) : { title: "Figma 파일", text: contextText };

    let screenshotBase64 = null;
    let screenshotMediaType = null;

    try {
      const ssRes = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `Use get_screenshot Figma MCP to capture a screenshot.
After capturing, describe the visual style in detail for AI image generation.
Return JSON: {"description": "detailed visual description"}`,
        messages: [{ role: "user", content: `Screenshot this Figma file. fileKey: ${fileKey}${nodeId ? `, nodeId: ${nodeId}` : ", nodeId: 0:1"}` }],
        mcp_servers: [{ type: "url", url: FIGMA_MCP, name: "figma" }],
      });

      const imgBlock = ssRes.content.find((b) => b.type === "image");
      if (imgBlock?.source?.type === "base64") {
        screenshotBase64 = imgBlock.source.data;
        screenshotMediaType = imgBlock.source.media_type;
      }
    } catch (ssErr) {
      console.warn("Screenshot failed:", ssErr.message);
    }

    const combined = [
      ctxParsed.text || "",
      ctxParsed.colorPalette?.length ? `\n색상 팔레트: ${ctxParsed.colorPalette.join(", ")}` : "",
      ctxParsed.styleNotes ? `\n스타일 노트: ${ctxParsed.styleNotes}` : "",
    ].filter(Boolean).join("\n");

    res.status(200).json({
      title: ctxParsed.title || "Figma 디자인",
      context: combined,
      screenshotBase64,
      screenshotMediaType,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
