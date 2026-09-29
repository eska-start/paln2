// =============================================
// 문서 업로드 API
// =============================================

import fs from "fs";
import path from "path";
import { ensureDirectories, saveDocument, UPLOADS_DIR } from "@/app/lib/storage";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/app/lib/types";
import type { DocumentRecord } from "@/app/lib/types";

export async function POST(request: Request) {
  try {
    ensureDirectories();

    const formData = await request.formData();
    const files = formData.getAll("files");
    const rawFamilyId = formData.get("familyMemberId");
    const familyMemberId =
      rawFamilyId && typeof rawFamilyId === "string" && rawFamilyId.trim()
        ? rawFamilyId.trim()
        : "user-001";

    if (!files || files.length === 0) {
      return Response.json(
        { error: "업로드할 파일을 선택해주세요." },
        { status: 400 }
      );
    }

    const results: {
      id: string;
      fileName: string;
      familyMemberId: string;
      status: string;
      error?: string;
    }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) {
        results.push({
          id: "",
          fileName: "unknown",
          familyMemberId,
          status: "error",
          error: "잘못된 파일 형식입니다.",
        });
        continue;
      }

      // 파일 크기 검증
      if (file.size > MAX_FILE_SIZE) {
        results.push({
          id: "",
          fileName: file.name,
          familyMemberId,
          status: "error",
          error: `파일 크기가 50MB를 초과합니다. (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
        });
        continue;
      }

      // MIME 타입 검증
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        results.push({
          id: "",
          fileName: file.name,
          familyMemberId,
          status: "error",
          error: `지원하지 않는 파일 형식입니다. (${file.type})`,
        });
        continue;
      }

      // 고유 ID 및 파일명 생성
      const id = crypto.randomUUID();
      const ext = path.extname(file.name).toLowerCase();
      const storedFileName = `${id}${ext}`;

      // 파일 저장
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(path.join(UPLOADS_DIR, storedFileName), buffer);

      // 문서 레코드 생성 (가족별 격리)
      const doc: DocumentRecord = {
        id,
        familyMemberId,
        fileName: file.name,
        storedFileName,
        mimeType: file.type,
        fileSize: file.size,
        documentType: "",
        company: "",
        productName: "",
        insuranceId: null,
        status: "pending",
        ocrUsed: false,
        extractedTextFile: null,
        pageCount: 0,
        analysisResult: null,
        errorMessage: null,
        uploadDate: new Date().toISOString(),
        analysisDate: null,
        isDeleted: false,
      };

      saveDocument(doc);

      results.push({
        id: doc.id,
        fileName: doc.fileName,
        familyMemberId: doc.familyMemberId,
        status: "pending",
      });
    }

    return Response.json({
      message: `${results.filter((r) => r.status !== "error").length}개 파일이 업로드되었습니다.`,
      documents: results,
    });
  } catch (error: unknown) {
    console.error(
      "Upload error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "파일 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
