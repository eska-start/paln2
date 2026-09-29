// =============================================
// 문서 상세 조회 / 삭제 API
// =============================================

import { getDocument, deleteDocument } from "@/app/lib/storage";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;

  const doc = getDocument(id);
  if (!doc) {
    return Response.json(
      { error: "문서를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return Response.json({ document: doc });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const { id } = await ctx.params;

  const success = deleteDocument(id);
  if (!success) {
    return Response.json(
      { error: "문서를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return Response.json({ message: "문서가 삭제되었습니다." });
}
