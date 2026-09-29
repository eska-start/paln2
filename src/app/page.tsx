"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import FamilyManageModal from "@/app/components/FamilyManageModal";
import type { FamilyMember } from "@/app/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Convert markdown-like text to HTML for display
function formatAIResponse(text: string): string {
  let html = text;

  // Escape HTML entities first
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Format Family Analysis Header: [아들 보험 분석] -> styled badge
  html = html.replace(
    /\[(.*?) 보험 분석\]/g,
    '<div style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(90deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2));border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:5px 14px;border-radius:8px;font-weight:700;margin-bottom:12px;font-size:0.95em;box-shadow:0 2px 8px rgba(0,0,0,0.2);">📊 $1 보험 분석</div>'
  );

  // Bold: **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Status badges
  html = html.replace(
    /\[확실\]/g,
    '<span style="display:inline-block;background:rgba(16,185,129,0.15);color:#10b981;padding:2px 10px;border-radius:6px;font-size:0.85em;font-weight:600;">✅ 확실</span>'
  );
  html = html.replace(
    /\[조건부\]/g,
    '<span style="display:inline-block;background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 10px;border-radius:6px;font-size:0.85em;font-weight:600;">⚠️ 조건부</span>'
  );
  html = html.replace(
    /\[확인 필요\]/g,
    '<span style="display:inline-block;background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 10px;border-radius:6px;font-size:0.85em;font-weight:600;">❓ 확인 필요</span>'
  );

  // Headers: ### → h3, ## → h2
  html = html.replace(/^### (.*$)/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gm, "<h2>$1</h2>");

  // Unordered list items
  html = html.replace(/^[\-\*] (.*$)/gm, "<li>$1</li>");

  // Wrap consecutive <li> with <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Numbered list items
  html = html.replace(/^\d+\. (.*$)/gm, "<li>$1</li>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Paragraphs: double newline
  html = html.replace(/\n\n/g, "</p><p>");

  // Single newline → <br>
  html = html.replace(/\n/g, "<br>");

  // Wrap in paragraph
  html = "<p>" + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p>(<h[23]>)/g, "$1");
  html = html.replace(/(<\/h[23]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<div style=.*?<\/div>)<\/p>/g, "$1");

  return html;
}

export default function Home() {
  // 가족 목록 및 현재 선택된 가족
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("user-001");
  const [showFamilyModal, setShowFamilyModal] = useState(false);

  // 가족별 대화 내역 분리 관리 (요구사항 12)
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 가족 목록 불러오기
  const loadFamilyMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/family");
      const data = await res.json();
      if (data.members && data.members.length > 0) {
        setFamilyMembers(data.members);
        // 만약 현재 선택된 ID가 유효하지 않으면 첫 번째 구성원 선택
        if (!data.members.some((m: FamilyMember) => m.id === selectedFamilyId)) {
          setSelectedFamilyId(data.members[0].id);
        }
      }
    } catch {
      // silent
    }
  }, [selectedFamilyId]);

  useEffect(() => {
    loadFamilyMembers();
  }, [loadFamilyMembers]);

  // 현재 선택된 가족 객체
  const currentMember =
    familyMembers.find((m) => m.id === selectedFamilyId) ||
    familyMembers[0] || {
      id: "user-001",
      name: "나",
      relationship: "본인",
      createdAt: "",
      updatedAt: "",
    };

  // 현재 선택된 가족의 메시지 목록 (가족별 대화 분리)
  const currentMessages = chatHistories[selectedFamilyId] || [];

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, isLoading]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    },
    []
  );

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = (messageText || input).trim();
      if (!text || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content: text };
      const updatedMessages = [...currentMessages, userMessage];

      // 현재 가족의 대화창에 사용자 메시지 추가
      setChatHistories((prev) => ({
        ...prev,
        [selectedFamilyId]: updatedMessages,
      }));

      setInput("");
      setIsLoading(true);
      setError(null);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: currentMessages, // 현재 가족의 이전 대화만 전달
            familyMemberId: selectedFamilyId, // 현재 가족 ID 전달
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "응답을 가져올 수 없습니다.");
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
        };

        // 타겟 가족이 전환된 경우(요구사항 8)
        const targetId = data.targetMember?.id || selectedFamilyId;
        if (data.switched && targetId !== selectedFamilyId) {
          // 전환된 가족으로 UI 선택을 업데이트하고 해당 가족 대화창에도 기록
          setSelectedFamilyId(targetId);
          setChatHistories((prev) => ({
            ...prev,
            [targetId]: [...(prev[targetId] || []), userMessage, assistantMessage],
          }));
        } else {
          setChatHistories((prev) => ({
            ...prev,
            [selectedFamilyId]: [...updatedMessages, assistantMessage],
          }));
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "오류가 발생했습니다.";
        setError(errorMsg);
        // 오류 발생 시 롤백
        setChatHistories((prev) => ({
          ...prev,
          [selectedFamilyId]: currentMessages,
        }));
        setInput(text);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, currentMessages, selectedFamilyId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const quickActions = [
    {
      icon: "💬",
      title: `${currentMember.name}의 보장 질문`,
      desc: `${currentMember.name}님의 보험 보장 내용을 물어보세요`,
      prompt: `${currentMember.name} 보험에서 응급실 내원 시 보장되는 항목 찾아줘`,
    },
    {
      icon: "🏥",
      title: `${currentMember.name}의 실손/진단비`,
      desc: `${currentMember.name}님의 암 진단비 및 실손 보장 내역 확인`,
      prompt: `내 보험에서 암 진단비 얼마 나오는지 찾아줘`,
    },
    {
      icon: "📋",
      title: "입원/수술 보장 확인",
      desc: `${currentMember.name}님의 입원비 및 수술비 특약 확인`,
      prompt: `내 보험 전체에서 입원비 찾아줘`,
    },
  ];

  const showWelcome = currentMessages.length === 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🛡️</div>
            <span className={styles.logoText}>보험 AI 어시스턴트</span>
          </div>

          {/* 가족 선택 드롭다운 (요구사항 4) */}
          <div className={styles.familyBar}>
            <span className={styles.familyLabel}>현재 가족:</span>
            <select
              className={styles.familySelect}
              value={selectedFamilyId}
              onChange={(e) => setSelectedFamilyId(e.target.value)}
              id="family-select"
            >
              {familyMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  👤 {member.name} ({member.relationship})
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.familyManageBtn}
              onClick={() => setShowFamilyModal(true)}
              title="가족 구성원 추가/수정/삭제"
            >
              ⚙️ 가족 관리
            </button>
          </div>

          <nav className={styles.headerNav}>
            <span className={`${styles.navTab} ${styles.navTabActive}`}>
              💬 AI 채팅
            </span>
            <Link href="/insurance" className={styles.navTab}>
              🛡️ 보험 관리
            </Link>
          </nav>
        </div>
      </header>

      {/* 현재 분석 대상 배너 (요구사항 17: UI에서 현재 가족을 항상 명확하게 표시) */}
      <div className={styles.targetBanner}>
        <div className={styles.targetBadge}>
          <span>현재 분석 대상:</span>
          <span>👤 {currentMember.name} ({currentMember.relationship})</span>
        </div>
        <div className={styles.targetHint}>
          🔒 {currentMember.name}님의 가입 보험 및 약관 데이터만 격리 검색됩니다
        </div>
      </div>

      {/* Chat Area */}
      <main className={styles.chatArea}>
        <div className={styles.chatInner}>
          {showWelcome ? (
            /* Welcome Screen */
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>🛡️</div>
              <h1 className={styles.welcomeTitle}>
                {currentMember.name}님의 보험 AI 어시스턴트
              </h1>
              <p className={styles.welcomeDesc}>
                현재 <strong>{currentMember.name} ({currentMember.relationship})</strong>님의 보험 데이터만 전용으로 분석합니다.
                <br />
                타 가족의 보험 데이터와 절대 섞이지 않으니 안심하고 질문하세요.
              </p>
              <div className={styles.quickActions}>
                {quickActions.map((action) => (
                  <button
                    key={action.title}
                    className={styles.quickAction}
                    onClick={() => sendMessage(action.prompt)}
                  >
                    <div className={styles.quickActionIcon}>{action.icon}</div>
                    <div className={styles.quickActionTitle}>{action.title}</div>
                    <div className={styles.quickActionDesc}>{action.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages */
            currentMessages.map((msg, i) => (
              <div
                key={i}
                className={`${styles.message} ${
                  msg.role === "user"
                    ? styles.messageUser
                    : styles.messageAssistant
                }`}
              >
                <div className={styles.messageAvatar}>
                  {msg.role === "user" ? "👤" : "🛡️"}
                </div>
                <div
                  className={styles.messageBubble}
                  dangerouslySetInnerHTML={
                    msg.role === "assistant"
                      ? { __html: formatAIResponse(msg.content) }
                      : undefined
                  }
                >
                  {msg.role === "user" ? msg.content : undefined}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className={styles.typingIndicator}>
              <div
                className={styles.messageAvatar}
                style={{
                  background: "var(--color-bg-tertiary)",
                  border: "1px solid var(--color-border-primary)",
                  width: 32,
                  height: 32,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                }}
              >
                🛡️
              </div>
              <div className={styles.typingBubble}>
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
                <div className={styles.typingDot} />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputInner}>
          <div className={styles.inputWrapper}>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`[${currentMember.name}] 보험에 관해 질문하세요 (예: 응급실 보장 찾아줘)`}
              rows={1}
              disabled={isLoading}
              id="chat-input"
            />
            <button
              className={styles.sendButton}
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              aria-label="메시지 보내기"
              id="send-button"
            >
              ↑
            </button>
          </div>
          <div className={styles.inputHint}>
            현재 분석 대상: 👤 {currentMember.name} | 다른 가족을 질문에서 지정하면 해당 가족 데이터로 자동 전환됩니다.
          </div>
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className={styles.errorToast} role="alert">
          ⚠️ {error}
        </div>
      )}

      {/* 가족 관리 모달 */}
      {showFamilyModal && (
        <FamilyManageModal
          members={familyMembers}
          onClose={() => setShowFamilyModal(false)}
          onUpdated={() => {
            loadFamilyMembers();
          }}
        />
      )}
    </div>
  );
}
