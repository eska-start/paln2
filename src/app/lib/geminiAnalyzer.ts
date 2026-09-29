// =============================================
// Gemini 문서 분석기
// =============================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DocumentAnalysis } from "./types";
import { sanitizeForAI } from "./piiMasker";

const ANALYSIS_PROMPT = `다음 보험 문서를 분석해주세요. 결과를 반드시 JSON 형식으로만 반환해주세요.

분석 항목:
1. documentType: 문서 종류 (보험증권 / 보험가입증명서 / 보험가입내역 / 보험약관 / 특약약관 / 보험금청구서류 / 진료관련서류 / 기타)
2. company: 보험사명
3. productName: 보험 상품명
4. contractDate: 계약일 (YYYY-MM-DD, 없으면 빈 문자열)
5. insurancePeriodStart: 보험기간 시작일 (YYYY-MM-DD)
6. insurancePeriodEnd: 보험기간 종료일 (YYYY-MM-DD)
7. monthlyPremium: 월 보험료
8. mainContract: 주계약 내용
9. riders: 특약 목록 배열
10. keyTerms: 핵심 보장 키워드 배열 (예: 암, 입원, 수술, 응급실, 실손 등)
11. ocrConfidence: 전체 인식 신뢰도 (high/medium/low, 텍스트 문서면 high)

규칙:
- 확인할 수 없는 정보는 빈 문자열로 표시하세요
- OCR로 읽힌 경우 불확실한 정보에는 "(OCR 확인 필요)" 표시를 추가하세요
- 개인정보(주민등록번호, 주소, 전화번호, 계좌번호)는 절대 추출하지 마세요
- JSON 외의 텍스트는 출력하지 마세요
- 근거 페이지를 알 수 있으면 riders의 sourcePage에 "p.XX" 형식으로 기록하세요
- 근거 페이지를 확인할 수 없으면 sourcePage를 빈 문자열로 두세요. 절대로 임의로 만들지 마세요

반환 JSON 형식:
{
  "documentType": "",
  "company": "",
  "productName": "",
  "contractDate": "",
  "insurancePeriodStart": "",
  "insurancePeriodEnd": "",
  "monthlyPremium": "",
  "mainContract": "",
  "riders": [
    {
      "name": "",
      "coverageAmount": "",
      "benefitAmount": "",
      "conditions": "",
      "exclusions": "",
      "reductionConditions": "",
      "renewable": "",
      "coveragePeriod": "",
      "sourceDocument": "",
      "sourcePage": ""
    }
  ],
  "keyTerms": [],
  "ocrConfidence": "high"
}`;

function getGenAI(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") return null;
  return new GoogleGenerativeAI(apiKey);
}

/**
 * JSON 문자열에서 코드블록 마커를 제거
 */
function cleanJSONResponse(text: string): string {
  let cleaned = text.trim();
  // ```json ... ``` 제거
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  return cleaned.trim();
}

/**
 * 텍스트 기반 문서 분석 (일반 PDF에서 텍스트 추출 성공 시)
 */
const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3.8-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
].filter(Boolean) as string[];

/**
 * 텍스트 기반 문서 분석 (일반 PDF에서 텍스트 추출 성공 시)
 */
export async function analyzeText(
  text: string,
  fileName: string
): Promise<DocumentAnalysis | null> {
  const genAI = getGenAI();
  if (!genAI) return null;

  // 개인정보 제거 후 AI에 전달
  const sanitizedText = sanitizeForAI(text);

  // 텍스트가 너무 길면 앞부분만 사용 (토큰 절약)
  const truncatedText =
    sanitizedText.length > 30000
      ? sanitizedText.slice(0, 30000) + "\n\n[... 이하 생략 ...]"
      : sanitizedText;

  const prompt = `${ANALYSIS_PROMPT}\n\n파일명: ${fileName}\n\n문서 내용:\n${truncatedText}`;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleaned = cleanJSONResponse(responseText);
      const analysis = JSON.parse(cleaned) as DocumentAnalysis;

      if (analysis.riders) {
        for (const rider of analysis.riders) {
          if (!rider.sourceDocument) {
            rider.sourceDocument = fileName;
          }
        }
      }

      return analysis;
    } catch (err) {
      console.warn(`[geminiAnalyzer] analyzeText with ${modelName} failed, trying next:`, (err as Error).message);
    }
  }

  return null;
}

/**
 * 파일 기반 문서 분석 (스캔 PDF / 이미지 → Gemini Vision OCR)
 */
export async function analyzeFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<{ analysis: DocumentAnalysis | null; extractedText: string }> {
  const genAI = getGenAI();
  if (!genAI) return { analysis: null, extractedText: "" };

  const base64Data = buffer.toString("base64");

  // OCR 프롬프트: 텍스트 추출 + 분석을 한 번에
  const ocrPrompt = `이 보험 문서 이미지/PDF를 읽고 다음 두 가지를 수행해주세요:

1. 먼저 문서의 모든 텍스트를 읽어주세요.
2. 읽은 내용을 바탕으로 아래 JSON 형식으로 분석 결과를 반환해주세요.

주의:
- OCR로 인식한 텍스트 중 확실하지 않은 부분에는 "(OCR 확인 필요)"를 표시하세요
- 개인정보(주민등록번호, 주소, 전화번호, 계좌번호)는 절대 추출하지 마세요
- 근거 페이지를 확인할 수 없으면 절대 임의로 만들지 마세요

반환 형식 (JSON만 반환, 추출된 텍스트 전에 --- 구분자 사용):

--- EXTRACTED_TEXT ---
(여기에 문서에서 읽은 전체 텍스트)
--- ANALYSIS_JSON ---
${ANALYSIS_PROMPT}`;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        { text: ocrPrompt },
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
      ]);

      const responseText = result.response.text();

      // 텍스트와 JSON 분리
      let extractedText = "";
      let jsonStr = "";

      if (responseText.includes("--- ANALYSIS_JSON ---")) {
        const parts = responseText.split("--- ANALYSIS_JSON ---");
        extractedText = parts[0]
          .replace("--- EXTRACTED_TEXT ---", "")
          .trim();
        jsonStr = parts[1].trim();
      } else if (responseText.includes("--- EXTRACTED_TEXT ---")) {
        extractedText = responseText
          .replace("--- EXTRACTED_TEXT ---", "")
          .trim();
        jsonStr = "";
      } else {
        // JSON만 반환된 경우
        jsonStr = responseText;
      }

      let analysis: DocumentAnalysis | null = null;
      if (jsonStr) {
        try {
          const cleaned = cleanJSONResponse(jsonStr);
          analysis = JSON.parse(cleaned) as DocumentAnalysis;
          if (analysis && analysis.riders) {
            for (const rider of analysis.riders) {
              if (!rider.sourceDocument) {
                rider.sourceDocument = fileName;
              }
            }
          }
          // OCR 사용 표시
          if (analysis && !analysis.ocrConfidence) {
            analysis.ocrConfidence = "medium";
          }
        } catch {
          // JSON 파싱 실패 시 텍스트 분석으로 폴백
          if (extractedText) {
            analysis = await analyzeText(extractedText, fileName);
          }
        }
      }

      // 추출 텍스트에서 개인정보 제거
      extractedText = sanitizeForAI(extractedText);

      return { analysis, extractedText };
    } catch (err) {
      console.warn(`[geminiAnalyzer] analyzeFile with ${modelName} failed, trying next:`, (err as Error).message);
    }
  }

  return { analysis: null, extractedText: "" };
}
