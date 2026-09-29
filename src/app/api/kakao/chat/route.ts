// =============================================
// 카카오톡 i 오픈빌더 스킬 서버 엔드포인트
// POST /api/kakao/chat
// =============================================

import { NextRequest } from "next/server";
import { executeInsuranceChat } from "@/app/lib/insuranceChatService";
import {
  getKakaoSession,
  updateKakaoSelectedFamily,
  getAllFamilyMembers,
} from "@/app/lib/storage";
import type { KakaoSkillResponse, KakaoQuickReply } from "@/app/lib/types";

export const dynamic = "force-dynamic";

/**
 * 카카오 스킬 표준 응답 헬퍼
 */
function createKakaoResponse(
  text: string,
  quickReplies?: KakaoQuickReply[]
): KakaoSkillResponse {
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: text.trim(),
          },
        },
      ],
      quickReplies: quickReplies || buildDefaultQuickReplies(),
    },
  };
}

/**
 * 기본 가족 선택 퀵 리플라이 목록 생성 (요구사항 4, 7)
 */
function buildDefaultQuickReplies(): KakaoQuickReply[] {
  const members = getAllFamilyMembers();
  return members.map((m) => ({
    label: `${m.name} 보험`,
    action: "message" as const,
    messageText: `${m.name} 보험`,
  }));
}

export async function POST(request: NextRequest) {
  try {
    // 1. 스킬 API 인증 검증 (요구사항 9)
    const skillSecret = process.env.KAKAO_SKILL_SECRET;
    if (skillSecret && skillSecret.trim() !== "") {
      const headerSecret =
        request.headers.get("x-kakao-skill-secret") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

      if (headerSecret !== skillSecret.trim()) {
        return Response.json(
          createKakaoResponse("접근 권한이 없습니다. (인증 실패)"),
          { status: 401 }
        );
      }
    }

    // 2. 요청 Body 파싱 (요구사항 1)
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        createKakaoResponse("요청 형식이 올바르지 않습니다."),
        { status: 400 }
      );
    }

    const kakaoUserId = body?.userRequest?.user?.id;
    const utterance = body?.userRequest?.utterance?.trim();

    if (!kakaoUserId || typeof kakaoUserId !== "string") {
      return Response.json(
        createKakaoResponse("카카오 사용자 식별자를 확인할 수 없습니다."),
        { status: 400 }
      );
    }

    if (!utterance) {
      return Response.json(
        createKakaoResponse(
          "질문 내용을 입력해주세요. 아래 버튼을 눌러 대상 가족을 변경할 수도 있습니다."
        )
      );
    }

    // 3. 개인정보 보호 & 화이트리스트 검증 (요구사항 8)
    console.log(`[카카오 챗봇 요청] 사용자 식별키: ${kakaoUserId}, 발화: "${utterance}"`);

    const allowedUserIdsRaw = process.env.ALLOWED_KAKAO_USER_IDS;
    if (allowedUserIdsRaw && allowedUserIdsRaw.trim() !== "") {
      const allowedList = allowedUserIdsRaw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (!allowedList.includes(kakaoUserId)) {
        // 화이트리스트에 없는 사용자 차단 (사용자가 본인 키를 복사할 수 있도록 식별키 함께 안내)
        return Response.json(
          createKakaoResponse(
            `접근 권한이 없습니다.\n\n[등록 안내]\n본인의 카카오 식별키는 다음과 같습니다:\n${kakaoUserId}\n\n이 값을 환경변수(ALLOWED_KAKAO_USER_IDS)에 등록하시면 바로 이용하실 수 있습니다.`
          )
        );
      }
    } else if (process.env.NODE_ENV === "production") {
      // 운영 상태에서 화이트리스트 미설정 시 안전 차단
      return Response.json(
        createKakaoResponse(
          `접근 권한이 설정되지 않았습니다.\n\n[등록 안내]\n본인의 카카오 식별키는 다음과 같습니다:\n${kakaoUserId}\n\n이 값을 환경변수(ALLOWED_KAKAO_USER_IDS)에 등록해 주세요.`
        )
      );
    }

    // 4. 카카오 사용자별 세션 조회 (요구사항 3)
    const session = getKakaoSession(kakaoUserId);
    const familyMembers = getAllFamilyMembers();

    // 5. 가족 선택 명령 발화 확인 (요구사항 4)
    // 예: "나 보험", "내 보험", "아들 보험", "배우자 보험", "딸 보험"
    for (const member of familyMembers) {
      const matchPatterns = [
        `${member.name} 보험`,
        `${member.name}보험`,
        member.name,
      ];
      if (member.relationship === "본인") {
        matchPatterns.push("내 보험", "내보험");
      } else if (member.relationship === "자녀") {
        matchPatterns.push("자녀 보험", "아이 보험", "애기 보험");
      }

      if (matchPatterns.some((pattern) => utterance === pattern)) {
        // 세션에 선택 가족 업데이트
        updateKakaoSelectedFamily(kakaoUserId, member.id);
        const replyMsg = `현재 분석 대상을 [${member.name} 보험]으로 변경했습니다.\n\n궁금하신 보장 내용을 질문해주세요.\n(예: "응급실 보장 찾아줘", "암 진단비 얼마 나와?")`;
        return Response.json(createKakaoResponse(replyMsg));
      }
    }

    // 6. 일반 질문 처리 (기존 보험 AI 공통 서비스 직접 호출) (요구사항 2, 5, 6, 10, 11)
    const chatResult = await executeInsuranceChat({
      message: utterance,
      familyMemberId: session.selectedFamilyMemberId,
      isKakao: true,
    });

    // 7. 카카오 i 오픈빌더 표준 응답 반환 (요구사항 7)
    return Response.json(
      createKakaoResponse(chatResult.reply)
    );
  } catch (error: unknown) {
    // 내부 에러 상세나 키 노출 방지 (요구사항 12)
    console.error("Kakao chat error:", error instanceof Error ? error.message : "unknown");

    return Response.json(
      createKakaoResponse(
        "보험자료를 확인하는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요."
      )
    );
  }
}
