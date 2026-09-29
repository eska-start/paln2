// =============================================
// PDF 텍스트 추출 유틸리티
// =============================================

import pdf from "pdf-parse";

export interface PDFParseResult {
  text: string;
  pageCount: number;
  needsPassword: boolean;
  needsOCR: boolean;
  error?: string;
}

/**
 * PDF에서 텍스트를 추출합니다.
 * - 비밀번호가 필요한 경우 needsPassword: true 반환
 * - 텍스트가 충분하지 않은 경우 (스캔본) needsOCR: true 반환
 */
export async function extractTextFromPDF(
  buffer: Buffer,
  password?: string
): Promise<PDFParseResult> {
  try {
    const options: { password?: string } = {};
    if (password) {
      options.password = password;
    }

    const data = await pdf(buffer, options);
    const text = (data.text || "").trim();
    const pageCount = data.numpages || 0;

    // 페이지당 평균 50자 미만이면 스캔본으로 판단
    const needsOCR = pageCount > 0 && text.length < pageCount * 50;

    return {
      text,
      pageCount,
      needsPassword: false,
      needsOCR,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // 비밀번호 관련 에러 감지
    if (
      errorMsg.toLowerCase().includes("password") ||
      errorMsg.includes("PasswordException") ||
      errorMsg.includes("encrypted")
    ) {
      return {
        text: "",
        pageCount: 0,
        needsPassword: true,
        needsOCR: false,
      };
    }

    return {
      text: "",
      pageCount: 0,
      needsPassword: false,
      needsOCR: false,
      error: errorMsg,
    };
  }
}

/**
 * 파일이 PDF인지 확인
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

/**
 * 파일이 이미지인지 확인
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}
