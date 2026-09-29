// =============================================
// PDF 비밀번호 제출 API
// 비밀번호는 메모리에서만 사용하고 절대 저장하지 않음
// =============================================

import { getDocument, saveDocument, readUploadedFile, saveExtractedText } from "@/app/lib/storage";
import { extractTextFromPDF } from "@/app/lib/pdfParser";
import { analyzeText, analyzeFile } from "@/app/lib/geminiAnalyzer";
import { sanitizeForAI } from "@/app/lib/piiMasker";
import { findInsuranceByProduct, saveInsurance, getInsurance } from "@/app/lib/storage";
import type { NextRequest } from "next/server";
import type { InsurancePolicy } from "@/app/lib/types";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/documents/[id]/password">
) {
  const { id } = await ctx.params;

  try {
    const doc = getDocument(id);
    if (!doc) {
      return Response.json(
        { error: "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return Response.json(
        { error: "비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 파일 읽기
    const buffer = readUploadedFile(doc.storedFileName);
    if (!buffer) {
      return Response.json(
        { error: "업로드된 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 비밀번호로 PDF 텍스트 추출 시도
    // ⚠️ password 변수는 이 함수 스코프에서만 사용되고 저장되지 않음
    const pdfResult = await extractTextFromPDF(buffer, password);

    if (pdfResult.needsPassword) {
      return Response.json(
        { error: "PDF 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (pdfResult.error) {
      doc.status = "error";
      doc.errorMessage = "PDF를 처리할 수 없습니다.";
      saveDocument(doc);
      return Response.json(
        { error: "PDF를 처리할 수 없습니다." },
        { status: 500 }
      );
    }

    // 텍스트 추출 성공 → 분석 진행
    doc.status = "analyzing";
    doc.pageCount = pdfResult.pageCount;
    saveDocument(doc);

    let analysis;
    let extractedText = pdfResult.text;

    if (pdfResult.needsOCR) {
      // 스캔본 → Gemini Vision
      doc.ocrUsed = true;
      const fileResult = await analyzeFile(buffer, doc.mimeType, doc.fileName);
      analysis = fileResult.analysis;
      if (fileResult.extractedText) {
        extractedText = fileResult.extractedText;
      }
    } else {
      // 텍스트 기반 분석
      analysis = await analyzeText(extractedText, doc.fileName);
    }

    // 결과 저장
    if (extractedText) {
      const sanitizedText = sanitizeForAI(extractedText);
      doc.extractedTextFile = saveExtractedText(doc.id, sanitizedText);
    }

    if (analysis) {
      doc.analysisResult = analysis;
      doc.documentType = analysis.documentType || "기타";
      doc.company = analysis.company || "";
      doc.productName = analysis.productName || "";
      doc.status = "completed";
      doc.analysisDate = new Date().toISOString();

      // 보험 자동 매칭/생성 (동일 가족 내에서만 매칭)
      if (analysis.company || analysis.productName) {
        const familyMemberId = doc.familyMemberId || "user-001";
        let insurance = findInsuranceByProduct(analysis.company, analysis.productName, familyMemberId);
        
        const mappedRiders = (analysis.riders || []).map((r) => ({
          ...r,
          familyMemberId,
        }));

        if (!insurance) {
          insurance = {
            id: crypto.randomUUID(),
            familyMemberId,
            company: analysis.company || "",
            productName: analysis.productName || "",
            contractDate: analysis.contractDate || "",
            insurancePeriodStart: analysis.insurancePeriodStart || "",
            insurancePeriodEnd: analysis.insurancePeriodEnd || "",
            monthlyPremium: analysis.monthlyPremium || "",
            mainContract: analysis.mainContract || "",
            riders: mappedRiders,
            documentIds: [doc.id],
            isDeleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as InsurancePolicy;
          saveInsurance(insurance);
        } else {
          if (!insurance.documentIds.includes(doc.id)) {
            insurance.documentIds.push(doc.id);
          }
          // 기존 정보 보완
          if (!insurance.contractDate && analysis.contractDate) {
            insurance.contractDate = analysis.contractDate;
          }
          if (mappedRiders && mappedRiders.length > 0) {
            const existingNames = new Set(insurance.riders.map((r) => r.name));
            for (const rider of mappedRiders) {
              if (!existingNames.has(rider.name)) {
                insurance.riders.push(rider);
              }
            }
          }
          insurance.updatedAt = new Date().toISOString();
          saveInsurance(insurance);
        }
        doc.insuranceId = insurance.id;
      }
    } else {
      doc.status = "error";
      doc.errorMessage = "문서 분석에 실패했습니다.";
    }

    saveDocument(doc);

    return Response.json({
      message: "비밀번호 확인 완료. 문서가 분석되었습니다.",
      document: doc,
    });
  } catch (error: unknown) {
    console.error(
      "Password processing error:",
      error instanceof Error ? error.message : "unknown"
    );
    return Response.json(
      { error: "비밀번호 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
  // ⚠️ password 변수는 함수 종료 시 GC에 의해 자동 폐기됨
}
