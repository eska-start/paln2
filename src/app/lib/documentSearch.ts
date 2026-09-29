import type { DocumentRecord, InsurancePolicy, SearchResult, FamilyMember } from "./types";
import { getAllDocuments, getAllInsurance, getAllExtractedTexts, getAllFamilyMembers, getFamilyMember } from "./storage";

/**
 * 보험 관련 키워드 맵 (동의어/관련어 처리)
 */
const INSURANCE_KEYWORD_MAP: Record<string, string[]> = {
  응급실: ["응급", "응급실", "응급의료", "응급내원", "응급실내원"],
  입원: ["입원", "입원비", "입원일당", "질병입원", "상해입원"],
  수술: ["수술", "수술비", "수술급여금"],
  암: ["암", "암진단", "암치료", "유사암", "소액암", "고액암", "일반암"],
  사망: ["사망", "사망보험금", "일반사망", "재해사망"],
  실손: ["실손", "실비", "실손의료", "실손보험"],
  진단: ["진단", "진단금", "진단비"],
  통원: ["통원", "통원비", "외래"],
  골절: ["골절", "골절진단"],
  화상: ["화상", "화상진단"],
  치과: ["치과", "치아", "임플란트", "보철"],
  운전: ["운전", "교통", "교통사고", "자동차"],
  후유장해: ["후유장해", "장해", "장해급여금"],
};

/**
 * 질문에서 검색 키워드를 추출
 */
function extractKeywords(query: string): string[] {
  const keywords: string[] = [];

  // 보험 키워드 매칭
  for (const [, synonyms] of Object.entries(INSURANCE_KEYWORD_MAP)) {
    for (const syn of synonyms) {
      if (query.includes(syn)) {
        keywords.push(...synonyms);
        break;
      }
    }
  }

  // 일반 키워드 추출 (2글자 이상)
  const words = query
    .replace(/[?？！!.,。，]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  for (const word of words) {
    if (!keywords.includes(word)) {
      keywords.push(word);
    }
  }

  return [...new Set(keywords)];
}

/**
 * 텍스트에서 매칭된 부분의 주변 컨텍스트를 추출
 */
function extractSnippet(
  text: string,
  keyword: string,
  contextSize: number = 80
): string | null {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);
  if (index === -1) return null;

  const start = Math.max(0, index - contextSize);
  const end = Math.min(text.length, index + keyword.length + contextSize);
  let snippet = text.slice(start, end).replace(/\n/g, " ").trim();

  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * 질문에서 특정 가족 명시 여부 감지
 * 사용자가 현재 선택과 다른 가족을 명시적으로 언급했는지 확인 (요구사항 8)
 * 단, "내 보험", "나"는 현재 선택된 가족 프로필에서의 질문일 수 있으므로
 * 명시적으로 타 가족의 이름/호칭(아들, 딸, 배우자, 와이프, 남편 등)이 있을 때만 안전하게 전환
 */
export function detectTargetFamilyMember(
  query: string,
  currentMemberId: string
): { targetMember: FamilyMember; switched: boolean } {
  const members = getAllFamilyMembers();
  const currentMember =
    members.find((m) => m.id === currentMemberId) ||
    members[0] || {
      id: "user-001",
      name: "나",
      relationship: "본인",
      createdAt: "",
      updatedAt: "",
    };

  // 질문에서 명시된 다른 가족 탐지
  for (const member of members) {
    if (member.id === currentMember.id) continue;

    // 가족의 이름(예: "아들", "배우자", "민수")
    // 주의: 사용자가 아들/배우자 등을 선택한 상태에서 "내 보험에서 암 진단비 찾아줘"라고 묻는 것은
    // 현재 선택된 가족의 보험을 묻는 자연스러운 발화이므로, '나' 또는 '내 보험'은 다른 가족 전환 트리거로 간주하지 않고
    // 현재 선택된 가족을 유지합니다. (명시적 타 가족 전환은 '아들', '배우자' 등 다른 대상일 때만)
    const memberName = member.name.trim();
    if (memberName === "나" || member.relationship === "본인") {
      // '나'는 전환 트리거로 사용하지 않음 (현재 선택 가족 유지)
      continue;
    } else if (memberName && memberName.length > 0 && query.includes(memberName)) {
      return { targetMember: member, switched: true };
    }

    // 관계 호칭에 따른 별칭 매칭
    if (member.relationship === "자녀") {
      if (
        query.includes("아들") ||
        query.includes("딸") ||
        query.includes("자녀") ||
        query.includes("아이") ||
        query.includes("애기")
      ) {
        return { targetMember: member, switched: true };
      }
    } else if (member.relationship === "배우자") {
      if (
        query.includes("배우자") ||
        query.includes("아내") ||
        query.includes("와이프") ||
        query.includes("남편")
      ) {
        return { targetMember: member, switched: true };
      }
    }
  }

  // 타 가족 명시가 없으면 현재 선택된 가족 유지
  return { targetMember: currentMember, switched: false };
}

/**
 * 사용자 질문에 관련된 문서를 가족별로 엄격히 제한하여 검색 (요구사항 5, 10, 13)
 * familyMemberId가 일치하지 않는 데이터는 검색 단계에서 100% 원천 배제
 */
export function searchDocuments(
  query: string,
  familyMemberId: string
): SearchResult[] {
  if (!familyMemberId) return [];

  // 오직 해당 가족의 데이터만 로드 (가족 데이터 완벽 격리)
  const documents = getAllDocuments(familyMemberId);
  const insurances = getAllInsurance(familyMemberId);
  const extractedTexts = getAllExtractedTexts(familyMemberId);
  const keywords = extractKeywords(query);

  if (keywords.length === 0) return [];

  const results: SearchResult[] = [];

  for (const doc of documents) {
    // 2중 안전장치: familyMemberId 엄격 검증
    if (doc.familyMemberId !== familyMemberId) continue;
    if (doc.status !== "completed") continue;

    const text = extractedTexts.get(doc.id) || "";
    const analysisText = doc.analysisResult
      ? JSON.stringify(doc.analysisResult)
      : "";
    const searchableText = `${text} ${analysisText}`.toLowerCase();

    let score = 0;
    const snippets: string[] = [];

    for (const keyword of keywords) {
      const regex = new RegExp(
        keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      );
      const matches = searchableText.match(regex);
      if (matches) {
        score += matches.length;
        const snippet = extractSnippet(text || analysisText, keyword);
        if (snippet) snippets.push(snippet);
      }
    }

    if (score > 0) {
      // 보험 정보도 오직 해당 가족 소속인 것만 연결
      let insurance: InsurancePolicy | null = null;
      if (doc.insuranceId) {
        insurance =
          insurances.find(
            (i) => i.id === doc.insuranceId && i.familyMemberId === familyMemberId
          ) || null;
      }

      results.push({ document: doc, insurance, score, snippets });
    }
  }

  // 등록된 보험(InsurancePolicy) 자체 검색 (문서가 없거나 별도 추가된 최신 보험 검색 지원)
  const matchedInsuranceIds = new Set(
    results.map((r) => r.insurance?.id).filter(Boolean)
  );

  for (const ins of insurances) {
    if (ins.familyMemberId !== familyMemberId) continue;
    if (matchedInsuranceIds.has(ins.id)) continue;

    const insText = `${ins.company} ${ins.productName} ${ins.mainContract || ""} ${ins.riders.map((r) => `${r.name} ${r.coverageAmount || ""} ${r.benefitAmount || ""}`).join(" ")}`.toLowerCase();
    let insScore = 0;
    const insSnippets: string[] = [];

    for (const keyword of keywords) {
      if (insText.includes(keyword.toLowerCase())) {
        insScore += 2;
        insSnippets.push(`${ins.company} ${ins.productName} 등록 내역 (${keyword} 관련)`);
      }
    }

    if (insScore > 0) {
      // 문서가 아직 없는 경우에도 보험 정책 정보를 전달할 수 있도록 가상 레코드 구성
      const virtualDoc: DocumentRecord = {
        id: `virtual_${ins.id}`,
        familyMemberId: ins.familyMemberId,
        fileName: `${ins.productName} (보험등록정보)`,
        storedFileName: "",
        fileSize: 0,
        mimeType: "application/json",
        company: ins.company,
        productName: ins.productName,
        status: "completed",
        documentType: "보험증권",
        ocrUsed: false,
        extractedTextFile: null,
        pageCount: 1,
        analysisResult: null,
        errorMessage: null,
        uploadDate: ins.createdAt,
        analysisDate: ins.createdAt,
        insuranceId: ins.id,
      };

      results.push({
        document: virtualDoc,
        insurance: ins,
        score: insScore,
        snippets: insSnippets,
      });
    }
  }

  // 점수순 정렬
  return results.sort((a, b) => b.score - a.score);
}

/**
 * 검색 결과에서 AI에 전달할 컨텍스트를 생성
 * 개인정보를 제외하고 해당 가족의 보험/특약/약관 정보만 포함
 */
export function buildAIContext(
  results: SearchResult[],
  targetFamilyMemberName: string = "선택된 가족"
): string {
  if (results.length === 0) return "";

  const contextParts: string[] = [
    `[분석 대상 가족: ${targetFamilyMemberName}]`,
  ];
  const seen = new Set<string>();

  for (const result of results.slice(0, 5)) {
    const doc = result.document;
    const ins = result.insurance;

    // 보험 정보
    if (ins && !seen.has(ins.id)) {
      seen.add(ins.id);
      let info = `\n[${targetFamilyMemberName}님의 보험 정보]\n보험사: ${ins.company}\n상품명: ${ins.productName}`;
      if (ins.contractDate) info += `\n계약일: ${ins.contractDate}`;
      if (ins.insurancePeriodStart && ins.insurancePeriodEnd) {
        info += `\n보험기간: ${ins.insurancePeriodStart} ~ ${ins.insurancePeriodEnd}`;
      }
      if (ins.monthlyPremium) info += `\n월 보험료: ${ins.monthlyPremium}`;
      if (ins.mainContract) info += `\n주계약: ${ins.mainContract}`;

      if (ins.riders.length > 0) {
        info += "\n\n[특약 목록]";
        for (const rider of ins.riders) {
          info += `\n- ${rider.name}`;
          if (rider.coverageAmount) info += ` (가입금액: ${rider.coverageAmount})`;
          if (rider.benefitAmount) info += ` (보장금액: ${rider.benefitAmount})`;
          if (rider.conditions) info += `\n  보장조건: ${rider.conditions}`;
          if (rider.exclusions) info += `\n  면책조건: ${rider.exclusions}`;
          if (rider.renewable) info += `\n  갱신여부: ${rider.renewable}`;
          if (rider.sourceDocument || rider.sourcePage) {
            info += `\n  근거: ${rider.sourceDocument || doc.fileName}`;
            if (rider.sourcePage) info += ` ${rider.sourcePage}`;
          }
        }
      }
      contextParts.push(info);
    }

    // 관련 문서 스니펫
    if (result.snippets.length > 0) {
      let snippetText = `\n[${targetFamilyMemberName}님의 관련 문서: ${doc.fileName}]`;
      if (doc.documentType) snippetText += ` (${doc.documentType})`;
      for (const snippet of result.snippets.slice(0, 3)) {
        snippetText += `\n> ${snippet}`;
      }
      contextParts.push(snippetText);
    }
  }

  return contextParts.join("\n");
}
