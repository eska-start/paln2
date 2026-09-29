// =============================================
// 문서 분석 API
// =============================================

import {
  getDocument,
  saveDocument,
  readUploadedFile,
  saveExtractedText,
  findInsuranceByProduct,
  saveInsurance,
} from "@/app/lib/storage";
import { extractTextFromPDF, isPDF, isImage } from "@/app/lib/pdfParser";
import { analyzeText, analyzeFile } from "@/app/lib/geminiAnalyzer";
import { sanitizeForAI } from "@/app/lib/piiMasker";
import { MAX_INLINE_SIZE } from "@/app/lib/types";
import type { NextRequest } from "next/server";
import type { InsurancePolicy } from "@/app/lib/types";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/documents/[id]/analyze">
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

    // 이미 분석 완료된 경우
    if (doc.status === "completed") {
      return Response.json({
        message: "이미 분석이 완료된 문서입니다.",
        document: doc,
      });
    }

    // 파일 읽기
    const buffer = readUploadedFile(doc.storedFileName);
    if (!buffer) {
      doc.status = "error";
      doc.errorMessage = "업로드된 파일을 찾을 수 없습니다.";
      saveDocument(doc);
      return Response.json(
        { error: "업로드된 파일을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    doc.status = "analyzing";
    saveDocument(doc);

    let extractedText = "";
    let analysis = null;

    if (isPDF(doc.mimeType)) {
      // PDF 처리
      const pdfResult = await extractTextFromPDF(buffer);

      if (pdfResult.needsPassword) {
        doc.status = "password_required";
        doc.errorMessage = "이 PDF는 비밀번호가 필요합니다.";
        saveDocument(doc);
        return Response.json({
          message: "이 PDF는 비밀번호가 필요합니다.",
          document: doc,
          needsPassword: true,
        });
      }

      if (pdfResult.error) {
        doc.status = "error";
        doc.errorMessage = `PDF 처리 오류: ${pdfResult.error}`;
        saveDocument(doc);
        return Response.json({
          message: "PDF 처리 중 오류가 발생했습니다.",
          document: doc,
        });
      }

      doc.pageCount = pdfResult.pageCount;

      if (pdfResult.needsOCR) {
        // 스캔본 → Gemini Vision OCR
        doc.ocrUsed = true;

        if (buffer.length > MAX_INLINE_SIZE) {
          doc.status = "error";
          doc.errorMessage =
            "스캔된 PDF의 크기가 너무 큽니다. (최대 20MB) 더 작은 파일로 분할해주세요.";
          saveDocument(doc);
          return Response.json({
            message: doc.errorMessage,
            document: doc,
          });
        }

        const fileResult = await analyzeFile(buffer, doc.mimeType, doc.fileName);
        analysis = fileResult.analysis;
        extractedText = fileResult.extractedText || pdfResult.text;
      } else {
        // 텍스트 기반 분석
        extractedText = pdfResult.text;
        analysis = await analyzeText(extractedText, doc.fileName);
      }
    } else if (isImage(doc.mimeType)) {
      // 이미지 → Gemini Vision OCR
      doc.ocrUsed = true;

      if (buffer.length > MAX_INLINE_SIZE) {
        doc.status = "error";
        doc.errorMessage =
          "이미지 크기가 너무 큽니다. (최대 20MB) 더 작은 이미지를 업로드해주세요.";
        saveDocument(doc);
        return Response.json({
          message: doc.errorMessage,
          document: doc,
        });
      }

      const fileResult = await analyzeFile(buffer, doc.mimeType, doc.fileName);
      analysis = fileResult.analysis;
      extractedText = fileResult.extractedText;
    } else {
      doc.status = "error";
      doc.errorMessage = "지원하지 않는 파일 형식입니다.";
      saveDocument(doc);
      return Response.json({
        message: "지원하지 않는 파일 형식입니다.",
        document: doc,
      });
    }

    // 추출 텍스트 저장
    if (extractedText) {
      const sanitizedText = sanitizeForAI(extractedText);
      doc.extractedTextFile = saveExtractedText(doc.id, sanitizedText);
    }

    // 분석 결과 저장
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
        let insurance = findInsuranceByProduct(
          analysis.company,
          analysis.productName,
          familyMemberId
        );

        // 특약에 familyMemberId 부여
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
          if (!insurance.contractDate && analysis.contractDate) {
            insurance.contractDate = analysis.contractDate;
          }
          if (!insurance.monthlyPremium && analysis.monthlyPremium) {
            insurance.monthlyPremium = analysis.monthlyPremium;
          }
          if (!insurance.mainContract && analysis.mainContract) {
            insurance.mainContract = analysis.mainContract;
          }
          if (mappedRiders && mappedRiders.length > 0) {
            const existingNames = new Set(
              insurance.riders.map((r) => r.name)
            );
            for (const rider of mappedRiders) {
              if (rider.name && !existingNames.has(rider.name)) {
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
      doc.errorMessage =
        "이 문서에서 충분한 텍스트를 추출하지 못했습니다. 원본 PDF를 다시 업로드하거나 더 선명한 이미지를 업로드해주세요.";
    }

    saveDocument(doc);

    return Response.json({
      message:
        doc.status === "completed"
          ? "문서 분석이 완료되었습니다."
          : doc.errorMessage,
      document: doc,
    });
  } catch (error: unknown) {
    console.error(
      "Analyze error:",
      error instanceof Error ? error.message : "unknown"
    );

    // 문서 상태 업데이트
    const doc = getDocument(id);
    if (doc) {
      doc.status = "error";
      doc.errorMessage = "문서 분석 중 오류가 발생했습니다.";
      saveDocument(doc);
    }

    return Response.json(
      { error: "문서 분석 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
