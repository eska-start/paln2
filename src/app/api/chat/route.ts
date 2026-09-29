import { executeInsuranceChat } from "@/app/lib/insuranceChatService";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return Response.json(
        {
          error:
            "Gemini API 키가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 설정해주세요.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, history, familyMemberId } = body;

    if (!message || typeof message !== "string") {
      return Response.json(
        { error: "메시지를 입력해주세요." },
        { status: 400 }
      );
    }

    // 공통 서비스 레이어 호출 (가족별 격리 검색 + Gemini 분석)
    const result = await executeInsuranceChat({
      message,
      history,
      familyMemberId,
      isKakao: false,
    });

    return Response.json({
      reply: result.reply,
      targetMember: {
        id: result.targetMember.id,
        name: result.targetMember.name,
        relationship: result.targetMember.relationship,
      },
      switched: result.switched,
      hasDocumentContext: result.hasDocumentContext,
      matchedDocuments: result.matchedDocuments,
    });
  } catch (error: unknown) {
    // Do not log API keys or personal info
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";

    // Filter out any potential API key leaks from error messages
    const safeMessage = errorMessage.replace(
      /[A-Za-z0-9_-]{30,}/g,
      "[REDACTED]"
    );

    console.error("Chat API error:", safeMessage);

    return Response.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
