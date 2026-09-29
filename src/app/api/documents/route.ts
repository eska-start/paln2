// =============================================
// 문서 목록 API
// =============================================

import { getAllDocuments } from "@/app/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyMemberId = searchParams.get("familyMemberId") || undefined;
    const documents = getAllDocuments(familyMemberId);
    return Response.json({ documents });
  } catch (error: unknown) {
    console.error(
      "Documents list error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "문서 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
