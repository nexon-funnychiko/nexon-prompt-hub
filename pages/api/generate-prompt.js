import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages, context, mode, modifiers } = req.body;

  const modeContext =
    mode === "character"
      ? `현재 모드: 캐릭터 (single character, isolated subject)\n적용 옵션: ${modifiers}`
      : `현재 모드: 배경 (environment/scene, no people)\n적용 옵션: ${modifiers}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: `당신은 이미지 생성 프롬프트 전문가입니다. 사용자의 모든 요청을 이미지 생성 프롬프트로 변환합니다.

⚠ 절대 금지:
- "이미지를 만들 수 없다"는 답변 금지
- 외부 도구 추천 금지
- 반드시 아래 형식으로만 응답

${context ? `=== 학습된 컨텍스트 ===\n${context}\n===\n이 스타일을 반드시 반영하세요.` : ""}

=== 현재 생성 설정 ===
${modeContext}

응답 형식 (반드시 준수):
[설명]
한국어 2-3줄 설명

[PROMPT]
영문 이미지 생성 프롬프트 (100-180단어, 구체적, 옵션 반영, quality tags 포함)`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";
    const promptMatch = reply.match(/\[PROMPT\][\s\n]*([\s\S]+?)(?:\n\[|$)/);
    const imagePrompt = promptMatch?.[1]?.trim();
    const description = reply.replace(/\[PROMPT\][\s\S]+/, "").replace("[설명]", "").trim();

    res.status(200).json({ imagePrompt, description });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
