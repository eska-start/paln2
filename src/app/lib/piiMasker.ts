// =============================================
// 개인정보 마스킹 유틸리티
// =============================================

/**
 * 주민등록번호 마스킹
 * 900101-1234567 → 900101-1******
 */
function maskSSN(text: string): string {
  return text.replace(/(\d{6})\s*-\s*(\d)(\d{6})/g, "$1-$2******");
}

/**
 * 전화번호 마스킹
 * 010-1234-5678 → 010-1234-****
 * 02-123-4567 → 02-123-****
 */
function maskPhone(text: string): string {
  return text.replace(
    /(\d{2,3})-(\d{3,4})-(\d{4})/g,
    "$1-$2-****"
  );
}

/**
 * 주소 마스킹 (시/도 이후 마스킹)
 */
function maskAddress(text: string): string {
  return text.replace(
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(시|도)?\s+\S+/g,
    (match) => {
      const parts = match.split(/\s+/);
      if (parts.length > 1) {
        return parts[0] + " ****";
      }
      return match;
    }
  );
}

/**
 * 계좌번호 마스킹
 */
function maskAccountNumber(text: string): string {
  return text.replace(
    /(\d{3,4})-?(\d{2,6})-?(\d{2,6})-?(\d{1,4})/g,
    (match) => {
      const digits = match.replace(/-/g, "");
      if (digits.length >= 10) {
        return digits.slice(0, 3) + "-****-****-" + digits.slice(-2);
      }
      return match;
    }
  );
}

/**
 * 이메일 마스킹
 */
function maskEmail(text: string): string {
  return text.replace(
    /([a-zA-Z0-9._+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "****@$2"
  );
}

/**
 * 텍스트에서 모든 개인정보를 마스킹
 */
export function maskPII(text: string): string {
  let masked = text;
  masked = maskSSN(masked);
  masked = maskPhone(masked);
  masked = maskAddress(masked);
  masked = maskAccountNumber(masked);
  masked = maskEmail(masked);
  return masked;
}

/**
 * AI에 전달하기 전에 불필요한 개인정보를 제거
 * 보험 분석에 필요한 정보만 유지
 */
export function sanitizeForAI(text: string): string {
  let sanitized = text;

  // 주민등록번호 완전 제거
  sanitized = sanitized.replace(
    /(\d{6})\s*-\s*(\d{7})/g,
    "[주민등록번호 제거됨]"
  );

  // 계좌번호 제거
  sanitized = sanitized.replace(
    /계좌\s*[:：]?\s*\d[\d\-]{8,}/g,
    "[계좌번호 제거됨]"
  );

  // 전화번호 제거 (보험 분석에 불필요)
  sanitized = sanitized.replace(
    /(?:전화|연락처|휴대폰|핸드폰|TEL|HP)\s*[:：]?\s*\d{2,3}-\d{3,4}-\d{4}/gi,
    "[연락처 제거됨]"
  );

  // 상세 주소 제거 (시/도 정보만 유지)
  sanitized = sanitized.replace(
    /(?:주소|거주지)\s*[:：]?\s*(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s+\S+\s+\S+/g,
    "[주소 제거됨]"
  );

  return sanitized;
}

/**
 * 에러 메시지에서 개인정보 필터링
 */
export function sanitizeErrorMessage(message: string): string {
  let safe = message;
  // API 키 마스킹
  safe = safe.replace(/[A-Za-z0-9_-]{30,}/g, "[REDACTED]");
  // 주민등록번호
  safe = safe.replace(/\d{6}-?\d{7}/g, "[REDACTED]");
  // 전화번호
  safe = safe.replace(/\d{2,3}-\d{3,4}-\d{4}/g, "[REDACTED]");
  // 계좌번호
  safe = safe.replace(/\d{3,4}-\d{2,6}-\d{2,6}/g, "[REDACTED]");
  return safe;
}
