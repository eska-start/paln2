// =============================================
// 보험 AI 챗봇 - 공통 타입 정의
// =============================================

/** 문서 처리 상태 */
export type DocumentStatus =
  | "pending"
  | "analyzing"
  | "completed"
  | "error"
  | "password_required";

/** 문서 유형 */
export type DocumentType =
  | "보험증권"
  | "보험가입증명서"
  | "보험가입내역"
  | "보험약관"
  | "특약약관"
  | "보험금청구서류"
  | "진료관련서류"
  | "기타";

/** 가족 구성원 */
export interface FamilyMember {
  id: string; // user-001, spouse-001, child-001 등
  name: string; // 이름/별칭 (나, 배우자, 아들 등)
  relationship: string; // 본인, 배우자, 자녀, 부모, 기타
  isDeleted?: boolean; // soft delete 지원
  createdAt: string;
  updatedAt: string;
}

/** 기본 가족 구성원 목록 */
export const DEFAULT_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: "user-001",
    name: "나",
    relationship: "본인",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "spouse-001",
    name: "배우자",
    relationship: "배우자",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "child-001",
    name: "아들",
    relationship: "자녀",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

/** 특약 및 보장 정보 (InsuranceCoverage) */
export interface RiderInfo {
  id?: string;
  familyMemberId?: string;
  insuranceId?: string;
  name: string; // coverageName
  coverageAmount: string; // 가입금액
  benefitAmount: string; // 보장금액
  conditions: string; // 보장조건
  exclusions: string; // 면책조건
  reductionConditions: string; // 감액조건
  renewable: string; // 갱신 여부
  coveragePeriod: string; // 보장기간
  sourceDocument: string; // 근거 문서 (sourceDocumentId)
  sourcePage: string; // 근거 페이지
}

/** 문서 분석 결과 (Gemini가 반환) */
export interface DocumentAnalysis {
  documentType: string;
  company: string;
  productName: string;
  contractDate: string;
  insurancePeriodStart: string;
  insurancePeriodEnd: string;
  monthlyPremium: string;
  mainContract: string;
  riders: RiderInfo[];
  keyTerms: string[];
  ocrConfidence: "high" | "medium" | "low" | "";
}

/** 저장되는 문서 레코드 (Document) */
export interface DocumentRecord {
  id: string; // documentId
  familyMemberId: string; // 필수: 소속 가족 구성원 ID
  insuranceId: string | null;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  company: string;
  productName: string;
  status: DocumentStatus;
  ocrUsed: boolean;
  extractedTextFile: string | null;
  pageCount: number;
  analysisResult: DocumentAnalysis | null;
  errorMessage: string | null;
  uploadDate: string;
  analysisDate: string | null;
  isDeleted?: boolean;
}

/** 보험 계약 (Insurance) */
export interface InsurancePolicy {
  id: string;
  familyMemberId: string; // 필수: 소속 가족 구성원 ID
  company: string;
  productName: string;
  contractDate: string;
  insurancePeriodStart: string;
  insurancePeriodEnd: string;
  monthlyPremium: string;
  mainContract: string;
  riders: RiderInfo[];
  documentIds: string[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 검색 결과 */
export interface SearchResult {
  document: DocumentRecord;
  insurance: InsurancePolicy | null;
  score: number;
  snippets: string[];
}

/** 카카오 사용자별 세션 (요구사항 3) */
export interface KakaoSession {
  kakaoUserId: string;
  selectedFamilyMemberId: string;
  updatedAt: string;
}

/** 카카오 i 오픈빌더 퀵 리플라이 */
export interface KakaoQuickReply {
  label: string;
  action: "message" | "block";
  messageText: string;
}

/** 카카오 i 오픈빌더 스킬 응답 형식 (요구사항 7) */
export interface KakaoSkillResponse {
  version: "2.0";
  template: {
    outputs: Array<{
      simpleText?: {
        text: string;
      };
    }>;
    quickReplies?: KakaoQuickReply[];
  };
}

/** 허용 파일 확장자 */
export const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

/** 허용 MIME 타입 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

/** 최대 파일 크기 (50MB) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Gemini 인라인 데이터 최대 크기 (20MB) */
export const MAX_INLINE_SIZE = 20 * 1024 * 1024;
