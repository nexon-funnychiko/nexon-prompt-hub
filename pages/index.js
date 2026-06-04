import { useState, useRef, useEffect, useCallback } from "react";

const C = {
  bg: "#0b0f1a", surface: "#111827", surfaceHi: "#1a2235", border: "#1e2d45",
  accent: "#3b82f6", accentLo: "#1e3a5f", accentGlow: "#60a5fa",
  text: "#e2e8f0", textMid: "#94a3b8", textDim: "#475569",
  green: "#10b981", greenLo: "#064e3b", red: "#ef4444", redLo: "#450a0a",
  purple: "#8b5cf6", purpleLo: "#3b1d6b",
};

const CAMERA_VIEWS = {
  character: [
    { id: "front", label: "정면", icon: "👤", prompt: "front view, facing camera directly" },
    { id: "34", label: "3/4뷰", icon: "↗", prompt: "three-quarter view, 45 degree angle" },
    { id: "side", label: "측면", icon: "➡", prompt: "side view, profile shot" },
    { id: "back", label: "뒷모습", icon: "↩", prompt: "back view, from behind" },
    { id: "low", label: "로우앵글", icon: "⬆", prompt: "low angle shot, looking up" },
    { id: "high", label: "하이앵글", icon: "⬇", prompt: "high angle shot, looking down" },
  ],
  background: [
    { id: "wide", label: "와이드샷", icon: "🖼", prompt: "wide establishing shot, panoramic" },
    { id: "aerial", label: "조감뷰", icon: "🦅", prompt: "aerial view, bird's eye perspective" },
    { id: "iso", label: "아이소메트릭", icon: "◆", prompt: "isometric view, game asset style" },
    { id: "topdown", label: "탑다운", icon: "⏬", prompt: "top-down view, overhead perspective" },
    { id: "fpv", label: "1인칭", icon: "👁", prompt: "first-person POV" },
    { id: "side", label: "사이드뷰", icon: "↔", prompt: "side-scrolling view, 2D platformer" },
  ],
};

const CHAR_BG = [
  { id: "transparent", label: "투명", swatch: null, prompt: "pure white background, isolated character, no background" },
  { id: "white", label: "흰색", swatch: "#ffffff", prompt: "pure white background" },
  { id: "black", label: "검정", swatch: "#000000", prompt: "pure black background" },
  { id: "gray", label: "회색", swatch: "#737373", prompt: "neutral gray background" },
  { id: "blue", label: "파랑", swatch: "#3b82f6", prompt: "solid blue background" },
  { id: "chroma", label: "크로마", swatch: "#00ff00", prompt: "chroma key green background" },
];

const TIMES = [
  { id: "auto", label: "자동", prompt: "" },
  { id: "day", label: "낮", prompt: "bright daylight, clear sky" },
  { id: "sunset", label: "석양", prompt: "golden hour sunset, warm orange sky" },
  { id: "night", label: "밤", prompt: "nighttime, moonlit" },
  { id: "dawn", label: "새벽", prompt: "early dawn, soft morning light" },
];

const ASPECTS = [
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "4:3", label: "4:3" },
];

const SHOT_TYPES = [
  { id: "full", label: "전신", prompt: "full body shot, head to toe" },
  { id: "half", label: "반신", prompt: "half body shot, upper body" },
  { id: "portrait", label: "초상", prompt: "portrait, headshot" },
];

function buildModifiers(mode, opts) {
  const parts = [];
  const view = CAMERA_VIEWS[mode].find((v) => v.id === opts.view);
  if (view) parts.push(view.prompt);
  if (mode === "character") {
    const shot = SHOT_TYPES.find((s) => s.id === opts.shot);
    if (shot) parts.push(shot.prompt);
    const bg = CHAR_BG.find((b) => b.id === opts.bg);
    if (bg) parts.push(bg.prompt);
    parts.push("character design, single subject, isolated, detailed");
  } else {
    const time = TIMES.find((t) => t.id === opts.time);
    if (time?.prompt) parts.push(time.prompt);
    parts.push("environment art, scenic background, no characters, atmospheric");
  }
  return parts.join(", ");
}

function Spinner({ size = 16, color }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid rgba(255,255,255,0.2)`,
      borderTop: `2px solid ${color || "#fff"}`,
      borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0,
    }} />
  );
}

function Chip({ active, onClick, children, swatch }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px", borderRadius: 7,
      background: active ? C.accentLo : C.surfaceHi,
      border: `1px solid ${active ? C.accent : C.border}`,
      color: active ? C.accentGlow : C.textMid,
      fontSize: 11, fontWeight: active ? 700 : 500,
      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
    }}>
      {swatch !== undefined && (
        <span style={{
          width: 12, height: 12, borderRadius: 3, flexShrink: 0,
          background: swatch || "repeating-conic-gradient(#444 0% 25%,#222 0% 50%) 50%/6px 6px",
          border: `1px solid ${C.border}`,
        }} />
      )}
      {children}
    </button>
  );
}

function Bubble({ msg, onRetry, onShowPrompt }) {
  const isUser = msg.role === "user";
  const [imgStatus, setImgStatus] = useState("loading");

  useEffect(() => {
    if (!msg.imageUrl) return;
    setImgStatus("loading");
    const timer = setTimeout(() => setImgStatus((s) => s === "loading" ? "error" : s), 90000);
    return () => clearTimeout(timer);
  }, [msg.imageUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {msg.content && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, maxWidth: "80%" }}>
          {!isUser && (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 }}>✦</div>
          )}
          <div style={{
            background: isUser ? C.accentLo : C.surfaceHi,
            border: `1px solid ${isUser ? C.accent : C.border}`,
            borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "10px 14px", color: C.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
          }}>{msg.content}</div>
        </div>
      )}
      {msg.imageUrl && imgStatus === "loading" && (
        <div style={{ marginTop: 8, marginLeft: isUser ? 0 : 36, width: 320, height: 320, borderRadius: 12, background: C.surfaceHi, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <Spinner size={24} color={C.accentGlow} />
          <div style={{ fontSize: 12, color: C.textMid, fontWeight: 600 }}>DALL-E 3 이미지 생성 중...</div>
          <div style={{ fontSize: 10, color: C.textDim }}>HD 품질 · 최대 60초 소요</div>
        </div>
      )}
      {msg.imageUrl && imgStatus !== "error" && (
        <img src={msg.imageUrl} alt="generated"
          onLoad={() => setImgStatus("ok")}
          onError={() => setImgStatus("error")}
          style={{ marginTop: 8, marginLeft: isUser ? 0 : 36, maxWidth: 420, borderRadius: 12, border: `1px solid ${C.border}`, display: imgStatus === "ok" ? "block" : "none", cursor: "pointer" }}
          onClick={() => window.open(msg.imageUrl, "_blank")}
        />
      )}
      {msg.imageUrl && imgStatus === "ok" && (
        <div style={{ marginTop: 8, marginLeft: isUser ? 0 : 36, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {msg.tag && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: msg.tag === "캐릭터" ? C.accentLo : C.purpleLo, color: msg.tag === "캐릭터" ? C.accentGlow : C.purple, fontWeight: 700 }}>{msg.tag}</span>}
          <a href={msg.imageUrl} download="generated.png" target="_blank" rel="noreferrer" style={{ background: C.accentLo, color: C.accentGlow, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>⬇ 다운로드</a>
          {onRetry && <button onClick={() => onRetry(msg.promptUsed, msg.aspectId, msg.tag)} style={{ background: C.border, color: C.textMid, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↺ 다시 생성</button>}
          {onShowPrompt && <button onClick={() => onShowPrompt(msg.promptUsed)} style={{ background: C.border, color: C.textMid, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📋 프롬프트</button>}
        </div>
      )}
      {msg.imageUrl && imgStatus === "error" && (
        <div style={{ marginTop: 8, marginLeft: isUser ? 0 : 36, padding: "14px 16px", borderRadius: 10, background: C.redLo, border: `1px solid ${C.red}`, maxWidth: 420 }}>
          <div style={{ color: C.red, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⚠ 이미지 생성 실패</div>
          <div style={{ display: "flex", gap: 6 }}>
            {onRetry && <button onClick={() => onRetry(msg.promptUsed, msg.aspectId, msg.tag)} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>↺ 재시도</button>}
          </div>
        </div>
      )}
    </div>
  );
}
export default function App() {
  const [mode, setMode] = useState("character");
  const [opts, setOpts] = useState({ view: "34", bg: "transparent", time: "auto", aspect: "1:1", shot: "full" });
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([{
    role: "assistant",
    content: "안녕하세요! ✦\n\n왼쪽에 Figma URL을 입력하면 디자인 스타일을 학습합니다.\n학습 후 명령하면 DALL-E 3 HD 품질로 이미지를 생성합니다.\n\n📷 캐릭터 / 🏞 배경 모드를 선택하고 명령해보세요.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState("");
  const [promptModal, setPromptModal] = useState(null);
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaPhase, setFigmaPhase] = useState("idle");
  const [figmaStatus, setFigmaStatus] = useState(null);
  const [figmaPages, setFigmaPages] = useState([]);
  const [figmaActiveIdx, setFigmaActiveIdx] = useState(-1);
  const [figmaScreenshot, setFigmaScreenshot] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const setOpt = (k, v) => setOpts((p) => ({ ...p, [k]: v }));

  const loadFigma = async () => {
    const u = figmaUrl.trim();
    if (!u || !u.includes("figma.com")) {
      setFigmaStatus({ ok: false, msg: "Figma URL을 입력해주세요." });
      return;
    }
    setFigmaPhase("fetching");
    setFigmaStatus({ ok: null, msg: "Figma 디자인 가져오는 중..." });
    try {
      const res = await fetch("/api/figma-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const entry = {
        url: u, title: data.title, context: data.context,
        screenshot: data.screenshotBase64 ? `data:${data.screenshotMediaType};base64,${data.screenshotBase64}` : null,
        time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      };
      setFigmaPages((prev) => [entry, ...prev.filter((p) => p.url !== u)]);
      setFigmaActiveIdx(0);
      setContext(data.context);
      if (entry.screenshot) setFigmaScreenshot(entry.screenshot);
      setFigmaStatus({ ok: true, msg: "완료! Figma 스타일 학습됨" });
      setFigmaPhase("done");
      setFigmaUrl("");
    } catch (e) {
      setFigmaStatus({ ok: false, msg: e.message });
      setFigmaPhase("idle");
    }
  };

  const generateImage = useCallback(async (prompt, aspectId) => {
    const res = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspectId }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.imageUrl;
  }, []);

  const retryImage = useCallback(async (prompt, aspectId, tag) => {
    if (!prompt) return;
    setMessages((prev) => [...prev, { role: "assistant", content: "↺ 다시 생성합니다..." }]);
    try {
      const imageUrl = await generateImage(prompt, aspectId);
      setMessages((prev) => [...prev, { role: "assistant", content: "", imageUrl, promptUsed: prompt, aspectId, tag }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `재시도 실패: ${e.message}` }]);
    }
  }, [generateImage]);

  const send = useCallback(async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setLoading(true);
    const modifiers = buildModifiers(mode, opts);
    const tag = mode === "character" ? "캐릭터" : "배경";
    try {
      const promptRes = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })), context, mode, modifiers }),
      });
      const promptData = await promptRes.json();
      if (promptData.error) throw new Error(promptData.error);
      const { imagePrompt, description } = promptData;
      const finalPrompt = imagePrompt || `${text}, ${modifiers}, high quality, detailed`;
      setMessages((prev) => [...prev, { role: "assistant", content: description || "이미지를 생성합니다..." }]);
      const imageUrl = await generateImage(finalPrompt, opts.aspect);
      setMessages((prev) => [...prev, { role: "assistant", content: "", imageUrl, promptUsed: finalPrompt, aspectId: opts.aspect, tag }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `오류: ${e.message}` }]);
    }
    setLoading(false);
  }, [input, messages, loading, context, mode, opts, generateImage]);

  const SUGGESTIONS = mode === "character"
    ? ["판타지 전사 캐릭터", "사이버펑크 해커", "마법사 소녀", "로봇 메카닉"]
    : ["판타지 성 풍경", "사이버펑크 도시", "숲속 마을", "우주 정거장"];

  return (
    <div style={{ fontFamily: "'Pretendard Variable','Pretendard',sans-serif", background: C.bg, color: C.text, height: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0;transform:translateY(6px); } to { opacity:1;transform:none; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 4px; }
        textarea:focus, input:focus { outline: none; }
        button:hover, a:hover { opacity: 0.82; }
      `}</style>

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✦</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>Image AI Studio</div>
          <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>NEXON · DALL-E 3 + FIGMA LEARNING</div>
        </div>
        {context && (
          <div style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 20, background: C.purpleLo, border: `1px solid ${C.purple}`, fontSize: 11, color: C.purple, fontWeight: 700 }}>
            🎨 Figma 학습됨
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 280, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 2 }}>🎨 Figma 학습</div>
            <div style={{ fontSize: 11, color: C.textDim }}>디자인 스타일을 학습합니다</div>
          </div>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
            <input value={figmaUrl} onChange={(e) => { setFigmaUrl(e.target.value); setFigmaStatus(null); }}
              onKeyDown={(e) => e.key === "Enter" && figmaPhase === "idle" && loadFigma()}
              placeholder="https://figma.com/design/..."
              disabled={figmaPhase === "fetching"}
              style={{ width: "100%", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: 12, fontFamily: "inherit", marginBottom: 8 }}
            />
            <button onClick={loadFigma} disabled={figmaPhase === "fetching" || !figmaUrl.trim()}
              style={{ width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 7, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: (!figmaUrl.trim() || figmaPhase === "fetching") ? 0.5 : 1 }}>
              {figmaPhase === "fetching" ? <><Spinner size={11} />학습 중...</> : "→ 불러오기 + 학습"}
            </button>
            {figmaStatus && (
              <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, background: figmaStatus.ok === true ? C.greenLo : figmaStatus.ok === false ? C.redLo : C.accentLo, color: figmaStatus.ok === true ? C.green : figmaStatus.ok === false ? C.red : C.accentGlow }}>
                {figmaStatus.msg}
              </div>
            )}
          </div>
          {figmaScreenshot && (
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.textMid, fontWeight: 600, marginBottom: 6 }}>학습된 스크린샷</div>
              <img src={figmaScreenshot} alt="figma" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }} />
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
            {figmaPages.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: C.textDim, fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎨</div>Figma URL을 입력하세요
              </div>
            ) : figmaPages.map((p, i) => (
              <div key={i} onClick={() => { setFigmaActiveIdx(i); setContext(p.context); if (p.screenshot) setFigmaScreenshot(p.screenshot); }}
                style={{ padding: "10px", borderRadius: 8, background: figmaActiveIdx === i ? C.accentLo : C.surfaceHi, border: `1px solid ${figmaActiveIdx === i ? C.accent : C.border}`, marginBottom: 8, cursor: "pointer" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                <div style={{ fontSize: 10, color: C.textDim }}>{p.time}</div>
                {figmaActiveIdx === i && <div style={{ marginTop: 4, fontSize: 10, color: C.accentGlow, fontWeight: 700 }}>✓ 활성</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ animation: "fadeUp 0.2s ease" }}>
                <Bubble msg={msg} onRetry={msg.promptUsed ? retryImage : null} onShowPrompt={msg.promptUsed ? (p) => setPromptModal(p) : null} />
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.textDim, fontSize: 13, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>✦</div>
                <Spinner size={14} color={C.accentGlow} /> 생성 중...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div style={{ padding: "0 28px 8px", display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{ background: C.surfaceHi, color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{s}</button>
              ))}
            </div>
          )}

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, margin: "0 16px 8px", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6, borderBottom: `1px solid ${C.border}`, marginBottom: 6 }}>
              <button onClick={() => setMode("character")} style={{ padding: "5px 14px", border: `1px solid ${mode === "character" ? C.accent : C.border}`, borderRadius: 6, background: mode === "character" ? C.accent : "transparent", color: mode === "character" ? "#fff" : C.textMid, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📷 캐릭터</button>
              <button onClick={() => setMode("background")} style={{ padding: "5px 14px", border: `1px solid ${mode === "background" ? C.purple : C.border}`, borderRadius: 6, background: mode === "background" ? C.purple : "transparent", color: mode === "background" ? "#fff" : C.textMid, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🏞 배경</button>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: 1 }}>비율</span>
                {ASPECTS.map((a) => <Chip key={a.id} active={opts.aspect === a.id} onClick={() => setOpt("aspect", a.id)}>{a.label}</Chip>)}
                <button onClick={() => setExpanded(!expanded)} style={{ background: "transparent", border: "none", color: C.textMid, fontSize: 11, cursor: "pointer", marginLeft: 4 }}>{expanded ? "▴" : "▾"}</button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, width: 60, flexShrink: 0 }}>카메라 뷰</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {CAMERA_VIEWS[mode].map((v) => <Chip key={v.id} active={opts.view === v.id} onClick={() => setOpt("view", v.id)}><span>{v.icon}</span> {v.label}</Chip>)}
              </div>
            </div>
            {mode === "character" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, width: 60, flexShrink: 0 }}>배경</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {CHAR_BG.map((b) => <Chip key={b.id} active={opts.bg === b.id} onClick={() => setOpt("bg", b.id)} swatch={b.swatch}>{b.label}</Chip>)}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, width: 60, flexShrink: 0 }}>시간대</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {TIMES.map((t) => <Chip key={t.id} active={opts.time === t.id} onClick={() => setOpt("time", t.id)}>{t.label}</Chip>)}
                </div>
              </div>
            )}
            {expanded && mode === "character" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: 1, width: 60, flexShrink: 0 }}>샷 타입</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {SHOT_TYPES.map((s) => <Chip key={s.id} active={opts.shot === s.id} onClick={() => setOpt("shot", s.id)}>{s.label}</Chip>)}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "4px 16px 16px" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 12px" }}>
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={mode === "character" ? "어떤 캐릭터를 만들까요?" : "어떤 배경을 만들까요?"}
                rows={2}
                style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 14, resize: "none", lineHeight: 1.6, fontFamily: "inherit" }}
              />
              <button onClick={() => send()} disabled={loading || !input.trim()}
                style={{ width: 38, height: 38, borderRadius: 9, border: "none", background: input.trim() ? (mode === "character" ? C.accent : C.purple) : C.border, color: "#fff", cursor: input.trim() ? "pointer" : "default", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>▲</button>
            </div>
            <div style={{ marginTop: 5, fontSize: 10, color: C.textDim, textAlign: "center" }}>
              Enter 전송 · Shift+Enter 줄바꿈 · DALL-E 3 HD 품질
            </div>
          </div>
        </div>
      </div>

      {promptModal && (
        <div onClick={() => setPromptModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, maxWidth: 600, width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>📋 사용된 프롬프트</h3>
              <button onClick={() => setPromptModal(null)} style={{ background: "transparent", border: "none", color: C.textMid, fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ padding: 14, background: C.bg, borderRadius: 8, fontSize: 13, color: C.text, lineHeight: 1.7, fontFamily: "monospace", marginBottom: 12, whiteSpace: "pre-wrap" }}>{promptModal}</div>
            <button onClick={() => navigator.clipboard.writeText(promptModal)} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>복사하기</button>
          </div>
        </div>
      )}
    </div>
  );
}
