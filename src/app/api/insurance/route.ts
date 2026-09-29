// =============================================
// 보험 목록 / 생성 API
// =============================================

import { getAllInsurance, saveInsurance } from "@/app/lib/storage";
import type { InsurancePolicy } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const familyMemberId = searchParams.get("familyMemberId") || undefined;
    const policies = getAllInsurance(familyMemberId);
    return Response.json({ insurance: policies });
  } catch (error: unknown) {
    console.error(
      "Insurance list error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "보험 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { company, productName, familyMemberId } = body;

    if (!company && !productName) {
      return Response.json(
        { error: "보험사 또는 상품명을 입력해주세요." },
        { status: 400 }
      );
    }

    const policy: InsurancePolicy = {
      id: crypto.randomUUID(),
      familyMemberId: familyMemberId || "user-001",
      company: company || "",
      productName: productName || "",
      contractDate: body.contractDate || "",
      insurancePeriodStart: body.insurancePeriodStart || "",
      insurancePeriodEnd: body.insurancePeriodEnd || "",
      monthlyPremium: body.monthlyPremium || "",
      mainContract: body.mainContract || "",
      riders: [],
      documentIds: [],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveInsurance(policy);

    return Response.json({
      message: "보험이 등록되었습니다.",
      insurance: policy,
    });
  } catch (error: unknown) {
    console.error(
      "Insurance create error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "보험 등록 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
