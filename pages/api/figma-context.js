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
    // 1단계: Figma 파일 구조 가져오기
    const figmaRes = await fetch(
      `https://api.figma.com/v1/files/${fileKey}`,
      { headers: { "X-Figma-Token": FIGMA_TOKEN } }
    );
    const figmaData = await figmaRes.json();
    if (figmaData.err) throw new Error(`Figma API 오류: ${figmaData.err}`);

    const fileName = figmaData.name || "Figma 파일";

    // 2단계: 프레임 목록 추출 (최대 10개)
    const frames = [];
    const extractFrames = (node, depth = 0) => {
      if (depth > 3) return;
      if ((node.type === "FRAME" || node.type === "COMPONENT" || node.type === "GROUP") && node.id) {
        frames.push({ id: node.id, name: node.name || "Frame" });
      }
      if (frames.length >= 10) return;
      if (node.children) {
        node.children.forEach(child => extractFrames(child, depth + 1));
      }
    };

    if (figmaData.document) {
      figmaData.document.children?.forEach(page => {
        page.children?.forEach(node => extractFrames(node));
      });
    }

    // nodeId가 있으면 해당 노드만
    const targetFrames = nodeId
      ? [{ id: nodeId, name: "선택된 프레임" }]
      : frames.slice(0, 6);

    if (targetFrames.length === 0) {
      targetFrames.push({ id: "0:1", name: "전체" });
    }

    // 3단계: 각 프레임 이미지 URL 가져오기 (scale=0.5 → 크기 문제 해결)
    const frameIds = targetFrames.map(f => f.id).join(",");
    const imgRes = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(frameIds)}&format=png&scale=0.5`,
      { headers: { "X-Figma-Token": FIGMA_TOKEN } }
    );
    const imgData = await imgRes.json();
    const imageUrls = imgData.images || {};

    // 4단계: 각 프레임을 Claude Vision으로 분석
    const analyses = [];
    for (const frame of targetFrames) {
      const imgUrl = imageUrls[frame.id];
      if (!imgUrl) continue;

      try {
        const contentBlocks = [
          { type: "image", source: { type: "url", url: imgUrl } },
          {
            type: "text",
            text: `이 Figma 프레임("${frame.name}")을 게임 개발 관점에서 분석해줘.

다음을 포함해서 한국어로 작성:
1. 아트 스타일 (애니메이션/사실적/픽셀아트/3D렌더링 등)
2. 색상 팔레트 (주요 색상, 분위기)
3. 캐릭터 특징 (있다면): 외형, 의상, 포즈, 표정
4. 배경 특징 (있다면): 장르, 시대, 환경, 원근감
5. AI 이미지 생성에 바로 쓸 수 있는 영문 키워드 10개

영문 키워드는 반드시 포함해줘.`
          }
        ];

        const analysisRes = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          messages: [{ role: "user", content: contentBlocks }],
        });

        const analysisText = analysisRes.content.find(b => b.type === "text")?.text || "";
        analyses.push({ frameName: frame.name, analysis: analysisText, imageUrl: imgUrl });
      } catch (e) {
        console.warn(`Frame ${frame.name} analysis failed:`, e.message);
      }
    }

    // 5단계: 텍스트 컨텐츠 추출
    const textContent = [];
    const extractText = (node, depth = 0) => {
      if (depth > 4) return;
      if (node.type === "TEXT" && node.characters) {
        textContent.push(node.characters.slice(0, 200));
      }
      if (node.children) {
        node.children.forEach(child => extractText(child, depth + 1));
      }
    };
    if (figmaData.document) {
      figmaData.document.children?.forEach(page => extractText(page));
    }

    // 6단계: 통합 컨텍스트 생성
    const combinedContext = [
      `=== Figma 파일: ${fileName} ===`,
      `총 ${analyses.length}개 프레임 분석 완료`,
      "",
      ...analyses.map((a, i) =>
        `[프레임 ${i + 1}: ${a.frameName}]\n${a.analysis}`
      ),
      textContent.length > 0
        ? `\n=== 텍스트 내용 ===\n${textContent.slice(0, 20).join("\n")}`
        : "",
    ].filter(Boolean).join("\n\n");

    // 대표 스크린샷 (첫 번째 프레임)
    let screenshotBase64 = null;
    if (analyses[0]?.imageUrl) {
      try {
        const imgFetch = await fetch(analyses[0].imageUrl);
        const imgBuffer = await imgFetch.arrayBuffer();
        screenshotBase64 = Buffer.from(imgBuffer).toString("base64");
      } catch (e) {
        console.warn("Base64 failed:", e.message);
      }
    }

    res.status(200).json({
      title: fileName,
      context: combinedContext,
      frameCount: analyses.length,
      screenshotBase64,
      screenshotMediaType: "image/png",
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
