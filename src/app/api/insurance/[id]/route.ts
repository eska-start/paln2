// =============================================
// 보험 상세 조회 / 수정 / 삭제 API
// =============================================

import { getInsurance, saveInsurance, deleteInsurance, getAllDocuments, saveDocument } from "@/app/lib/storage";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/insurance/[id]">
) {
  const { id } = await ctx.params;

  const policy = getInsurance(id);
  if (!policy) {
    return Response.json(
      { error: "보험을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 연관 문서 함께 반환
  const allDocs = getAllDocuments();
  const relatedDocs = allDocs.filter((d) => d.insuranceId === id);

  return Response.json({ insurance: policy, documents: relatedDocs });
}

export async function PUT(
  request: NextRequest,
  ctx: RouteContext<"/api/insurance/[id]">
) {
  const { id } = await ctx.params;

  const policy = getInsurance(id);
  if (!policy) {
    return Response.json(
      { error: "보험을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const body = await request.json();

  // 업데이트 가능한 필드
  if (body.company !== undefined) policy.company = body.company;
  if (body.productName !== undefined) policy.productName = body.productName;
  if (body.contractDate !== undefined) policy.contractDate = body.contractDate;
  if (body.insurancePeriodStart !== undefined)
    policy.insurancePeriodStart = body.insurancePeriodStart;
  if (body.insurancePeriodEnd !== undefined)
    policy.insurancePeriodEnd = body.insurancePeriodEnd;
  if (body.monthlyPremium !== undefined)
    policy.monthlyPremium = body.monthlyPremium;
  if (body.mainContract !== undefined) policy.mainContract = body.mainContract;

  policy.updatedAt = new Date().toISOString();
  saveInsurance(policy);

  return Response.json({
    message: "보험 정보가 수정되었습니다.",
    insurance: policy,
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/insurance/[id]">
) {
  const { id } = await ctx.params;

  // 연관 문서의 insuranceId 해제
  const allDocs = getAllDocuments();
  for (const doc of allDocs) {
    if (doc.insuranceId === id) {
      doc.insuranceId = null;
      saveDocument(doc);
    }
  }

  const success = deleteInsurance(id);
  if (!success) {
    return Response.json(
      { error: "보험을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return Response.json({ message: "보험이 삭제되었습니다." });
}
