// =============================================
// 보험 AI 질의응답 공통 서비스 레이어
// 웹 /api/chat 및 카카오톡 /api/kakao/chat 모두 이 서비스를 공통 호출
// =============================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchDocuments, buildAIContext, detectTargetFamilyMember } from "./documentSearch";
import { getFamilyMember, getAllFamilyMembers } from "./storage";
import type { FamilyMember } from "./types";

const BASE_SYSTEM_INSTRUCTION = `당신은 가족별 보험 관리 AI 어시스턴트입니다.

역할:
- 사용자의 보험 관련 질문에 친절하고 정확하게 답변합니다.
- 특정 가족 구성원의 보험 데이터를 엄격히 분리하여 분석합니다.
- 보험 용어를 쉽게 설명합니다.
- 일반적인 보험 지식을 바탕으로 도움을 줍니다.

중요 규칙:
- 절대로 다른 가족의 보험 데이터를 혼동하거나 섞어서 답변하지 마세요.
- 절대로 근거 없이 "무조건 지급됩니다", "100% 받을 수 있습니다" 같은 확정적 표현을 사용하지 마세요.
- 구체적인 보장 여부는 반드시 약관과 가입 내용을 확인해야 한다고 안내하세요.
- 답변 시 확실한 정보와 추가 확인이 필요한 정보를 구분하세요.
- 한국어로 답변하세요.
- 주민등록번호, 주소, 전화번호 등 개인정보는 절대로 답변에 노출하지 마세요.

답변 형식 필수 규칙:
1. 답변 최상단 첫 줄에는 반드시 대상 가족을 대괄호로 표시하세요.
   예: [아들 보험 분석] 또는 [나 보험 분석] 또는 [배우자 보험 분석]
2. 이어서 대상 가족에 대한 확인 문장을 작성하세요.
   예: "아들님의 가입 보험을 기준으로 확인했습니다."
3. 사용자가 현재 선택과 다른 가족을 명시하여 분석 대상이 전환된 경우, 대상 전환 안내를 첫머리에 명시하세요.
   예: "(질문에서 아들님을 지정하셔서 아들님의 가입 보험 데이터를 기준으로 분석했습니다.)"

확신도 표시 규칙:
사용자의 보험 문서 데이터가 제공된 경우:
- [확실]: 약관 내용과 가입 특약이 명확하게 확인되는 경우
- [조건부]: 특정 조건을 만족해야 지급되는 경우
- [확인 필요]: 현재 문서만으로 지급 여부를 판단할 수 없는 경우

답변에 반드시 포함할 항목 (문서 데이터가 있을 때):
- 대상 가족 이름
- 보험사 및 상품명
- 관련 특약 및 보장 내용
- 지급 조건 및 면책/감액 조건
- 필요한 추가 확인사항 및 청구서류
- 근거 문서 및 근거 페이지 (확인 가능한 경우에만)

근거 페이지를 확인할 수 없는 경우 임의로 만들지 마세요.`;

const KAKAO_ADDITIONAL_INSTRUCTION = `
[카카오톡 전용 지침]
- 카카오톡 메시지 특성에 맞게 답변을 800자 이내로 명확하고 간결하게 요약하세요.
- 번호 매기기(1., 2.)와 글머리 기호(*)를 적절히 활용하여 스마트폰 화면에서 한눈에 읽기 쉽게 작성하세요.
- 마지막 줄에는 "※ 더 자세한 내용은 웹 보험관리 화면에서 확인하실 수 있습니다."를 덧붙이세요.
`;

export interface ChatHistoryItem {
  role: string;
  content: string;
}

export interface InsuranceChatOptions {
  message: string;
  history?: ChatHistoryItem[];
  familyMemberId?: string;
  isKakao?: boolean;
}

export interface InsuranceChatResult {
  reply: string;
  targetMember: FamilyMember;
  switched: boolean;
  hasDocumentContext: boolean;
  matchedDocuments: number;
}

/**
 * 가족별 격리 검색 및 Gemini 분석을 수행하는 공통 서비스 함수
 */
export async function executeInsuranceChat(
  options: InsuranceChatOptions
): Promise<InsuranceChatResult> {
  const { message, history = [], familyMemberId, isKakao = false } = options;

  // 1. 현재 선택된 가족 확인 (기본: user-001)
  const currentMemberId = familyMemberId || "user-001";

  // 2. 질문 내 타 가족 명시 탐지 (요구사항 6)
  const { targetMember, switched } = detectTargetFamilyMember(
    message,
    currentMemberId
  );

  // 3. 가족별 데이터 완전 격리 검색 (요구사항 5, 기존 엔진 재사용)
  // 오직 targetMember.id에 해당하는 문서 및 보험 데이터만 검색
  const searchResults = searchDocuments(message, targetMember.id);
  const documentContext = buildAIContext(searchResults, targetMember.name);

  // 4. 시스템 프롬프트 구성
  let familyContext = `\n\n=== 현재 분석 대상 가족 정보 ===\n- 분석 대상: ${targetMember.name} (관계: ${targetMember.relationship}, ID: ${targetMember.id})\n`;
  if (switched) {
    familyContext += `- 주의: 사용자가 질문에서 '${targetMember.name}'을(를) 명시하였으므로, 현재 선택과 무관하게 오직 ${targetMember.name}님의 보험 데이터만 분석합니다.\n`;
  }
  familyContext += `- 지침: 답변 시작 시 반드시 [${targetMember.name} 보험 분석] 머리말과 함께 "${targetMember.name}님의 가입 보험을 기준으로 확인했습니다."를 포함하세요.\n`;
  familyContext += `=== 가족 정보 끝 ===`;

  let systemInstruction = BASE_SYSTEM_INSTRUCTION + familyContext;

  if (isKakao) {
    systemInstruction += KAKAO_ADDITIONAL_INSTRUCTION;
  }

  if (documentContext) {
    systemInstruction += `\n\n=== ${targetMember.name}님의 보험 문서 데이터 ===\n아래는 ${targetMember.name}님에게 등록된 보험 문서에서 검색된 내용입니다. 다른 가족의 데이터는 포함되어 있지 않습니다.\n${documentContext}\n=== 문서 데이터 끝 ===`;
  } else {
    systemInstruction += `\n\n현재 ${targetMember.name}님에게 등록된 관련 보험 문서 데이터가 없습니다. 일반적인 보험 안내를 제공하되, ${targetMember.name}님의 증권이나 약관 문서를 업로드하면 정확한 확인이 가능함을 안내해주세요.`;
  }

  // 5. Gemini API 호출
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    // API 키가 없을 때의 안전한 폴백 응답
    let fallbackText = `[${targetMember.name} 보험 분석]\n${targetMember.name}님의 가입 보험을 기준으로 확인했습니다.\n\n`;
    if (searchResults.length > 0) {
      fallbackText += `확인된 관련 보험/특약 ${searchResults.length}건이 있습니다.\n(현재 Gemini API 키 설정 대기 상태로, 기본 검색 데이터만 안내해 드립니다.)\n\n`;
      for (const res of searchResults.slice(0, 3)) {
        if (res.insurance) {
          fallbackText += `• ${res.insurance.company} - ${res.insurance.productName}\n`;
        }
      }
    } else {
      fallbackText += `현재 ${targetMember.name}님에게 등록된 관련 보험 문서를 찾을 수 없습니다. 웹 화면에서 보험증권 문서를 업로드해 주세요.`;
    }

    return {
      reply: fallbackText,
      targetMember,
      switched,
      hasDocumentContext: !!documentContext,
      matchedDocuments: searchResults.length,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction,
  });

  const chatHistory = history.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({
    history: chatHistory,
  });

  const result = await chat.sendMessage(message);
  const response = result.response;
  let text = response.text();

  // 카카오톡 길이 제한 안전 처리 (약 950자 이내)
  if (isKakao && text.length > 950) {
    text =
      text.slice(0, 920) +
      "\n...\n\n(내용이 길어 일부 생략되었습니다. 전체 내용은 웹 보험관리 화면에서 확인하세요.)";
  }

  return {
    reply: text,
    targetMember,
    switched,
    hasDocumentContext: !!documentContext,
    matchedDocuments: searchResults.length,
  };
}
