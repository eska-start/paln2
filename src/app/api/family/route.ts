// =============================================
// 가족 구성원 목록 및 생성 API
// =============================================

import { getAllFamilyMembers, saveFamilyMember } from "@/app/lib/storage";
import type { FamilyMember } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const members = getAllFamilyMembers();
    return Response.json({ members });
  } catch (error: unknown) {
    console.error(
      "Family list error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "가족 목록을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, relationship, id } = body;

    if (!name || typeof name !== "string") {
      return Response.json(
        { error: "가족 구성원 이름을 입력해주세요." },
        { status: 400 }
      );
    }

    // id 지정이 없으면 자동 생성
    const memberId =
      id && typeof id === "string"
        ? id.trim()
        : `member-${crypto.randomUUID().slice(0, 8)}`;

    const member: FamilyMember = {
      id: memberId,
      name: name.trim(),
      relationship: (relationship || "기타").trim(),
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveFamilyMember(member);

    return Response.json({
      message: `${member.name}님이 가족으로 추가되었습니다.`,
      member,
    });
  } catch (error: unknown) {
    console.error(
      "Family create error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "가족 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
