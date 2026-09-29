// =============================================
// 가족 구성원 상세/수정/삭제 API
// =============================================

import {
  getFamilyMember,
  saveFamilyMember,
  deleteFamilyMember,
  getAllDocuments,
  getAllInsurance,
} from "@/app/lib/storage";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/family/[id]">
) {
  const { id } = await ctx.params;
  const member = getFamilyMember(id);

  if (!member || member.isDeleted) {
    return Response.json(
      { error: "가족 구성원을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const docs = getAllDocuments(id);
  const insurances = getAllInsurance(id);

  return Response.json({
    member,
    insuranceCount: insurances.length,
    documentCount: docs.length,
  });
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/family/[id]">
) {
  const { id } = await ctx.params;
  const member = getFamilyMember(id);

  if (!member || member.isDeleted) {
    return Response.json(
      { error: "가족 구성원을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const body = await request.json();
  if (body.name !== undefined) member.name = String(body.name).trim();
  if (body.relationship !== undefined)
    member.relationship = String(body.relationship).trim();

  saveFamilyMember(member);

  return Response.json({
    message: "가족 정보가 수정되었습니다.",
    member,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/family/[id]">
) {
  const { id } = await ctx.params;
  const member = getFamilyMember(id);

  if (!member || member.isDeleted) {
    return Response.json(
      { error: "가족 구성원을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 기본 본인(user-001)은 삭제 방지
  if (member.id === "user-001") {
    return Response.json(
      { error: "기본 구성원('나')은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  // Soft delete 적용 (요구사항 15: 실수 방지 및 복구 용이성)
  deleteFamilyMember(id, true);

  return Response.json({
    message: `${member.name} 구성원 및 관련 데이터가 비활성화(삭제)되었습니다.`,
  });
}
