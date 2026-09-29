// =============================================
// JSON 파일 기반 데이터 저장소
// =============================================

import fs from "fs";
import path from "path";
import type { DocumentRecord, InsurancePolicy, FamilyMember, KakaoSession } from "./types";
import { DEFAULT_FAMILY_MEMBERS } from "./types";

const IS_VERCEL = !!process.env.VERCEL;
const PROJECT_DATA_DIR = path.join(process.cwd(), "data");

const DATA_DIR = IS_VERCEL ? path.join("/tmp", "data") : PROJECT_DATA_DIR;
const EXTRACTED_DIR = path.join(DATA_DIR, "extracted");
const UPLOADS_DIR = IS_VERCEL ? path.join("/tmp", "uploads") : path.join(process.cwd(), "uploads");

const DOCUMENTS_FILE = path.join(DATA_DIR, "documents.json");
const INSURANCE_FILE = path.join(DATA_DIR, "insurance.json");
const FAMILY_FILE = path.join(DATA_DIR, "family.json");
const KAKAO_SESSIONS_FILE = path.join(DATA_DIR, "kakao_sessions.json");

/** 필요한 디렉토리를 생성 및 초기 템플릿 복사 */
export function ensureDirectories(): void {
  [DATA_DIR, EXTRACTED_DIR, UPLOADS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(`[storage] Failed to create dir ${dir}:`, err);
      }
    }
  });

  // Vercel 환경인 경우, 프로젝트 기본 data 디렉토리가 있다면 /tmp/data로 초기 복사
  if (IS_VERCEL && fs.existsSync(PROJECT_DATA_DIR)) {
    try {
      const files = ["family.json", "insurance.json", "documents.json"];
      for (const file of files) {
        const src = path.join(PROJECT_DATA_DIR, file);
        const dest = path.join(DATA_DIR, file);
        if (fs.existsSync(src) && !fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    } catch (err) {
      console.warn("[storage] Seed data copy skipped:", err);
    }
  }
}

// ======== Generic JSON helpers ========

function readJSON<T>(filePath: string, defaultValue: T): T {
  try {
    ensureDirectories();
    if (!fs.existsSync(filePath)) {
      // Vercel 환경에서 아직 /tmp에 파일이 없으면 프로젝트 디렉토리에서 읽기 시도
      if (IS_VERCEL) {
        const fallbackPath = path.join(PROJECT_DATA_DIR, path.basename(filePath));
        if (fs.existsSync(fallbackPath)) {
          const content = fs.readFileSync(fallbackPath, "utf-8");
          return JSON.parse(content) as T;
        }
      }
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (err) {
    console.error(`[storage] Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJSON<T>(filePath: string, data: T): void {
  try {
    ensureDirectories();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[storage] Error writing ${filePath}:`, err);
  }
}

// ======== Family Member Operations ========

export function getAllFamilyMembers(includeDeleted = false): FamilyMember[] {
  let members = readJSON<FamilyMember[]>(FAMILY_FILE, []);
  if (members.length === 0) {
    // 기본 가족 구성원으로 초기화
    members = [...DEFAULT_FAMILY_MEMBERS];
    writeJSON(FAMILY_FILE, members);
  }
  return includeDeleted ? members : members.filter((m) => !m.isDeleted);
}

export function getFamilyMember(id: string): FamilyMember | null {
  const members = getAllFamilyMembers(true);
  return members.find((m) => m.id === id) || null;
}

export function saveFamilyMember(member: FamilyMember): void {
  const members = getAllFamilyMembers(true);
  const index = members.findIndex((m) => m.id === member.id);
  if (index >= 0) {
    members[index] = { ...member, updatedAt: new Date().toISOString() };
  } else {
    members.push({
      ...member,
      createdAt: member.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  writeJSON(FAMILY_FILE, members);
}

export function deleteFamilyMember(id: string, soft = true): boolean {
  const members = getAllFamilyMembers(true);
  const index = members.findIndex((m) => m.id === id);
  if (index < 0) return false;

  if (soft) {
    // Soft delete
    members[index].isDeleted = true;
    members[index].updatedAt = new Date().toISOString();
    writeJSON(FAMILY_FILE, members);

    // 연관 보험 및 문서도 soft delete
    const docs = getAllDocuments(undefined, true);
    let docsChanged = false;
    for (const d of docs) {
      if (d.familyMemberId === id && !d.isDeleted) {
        d.isDeleted = true;
        docsChanged = true;
      }
    }
    if (docsChanged) writeJSON(DOCUMENTS_FILE, docs);

    const insurances = getAllInsurance(undefined, true);
    let insChanged = false;
    for (const i of insurances) {
      if (i.familyMemberId === id && !i.isDeleted) {
        i.isDeleted = true;
        i.updatedAt = new Date().toISOString();
        insChanged = true;
      }
    }
    if (insChanged) writeJSON(INSURANCE_FILE, insurances);
  } else {
    // Hard delete
    members.splice(index, 1);
    writeJSON(FAMILY_FILE, members);
  }

  return true;
}

// ======== Kakao Session Operations (요구사항 3) ========

export function getAllKakaoSessions(): KakaoSession[] {
  return readJSON<KakaoSession[]>(KAKAO_SESSIONS_FILE, []);
}

export function getKakaoSession(kakaoUserId: string): KakaoSession {
  const sessions = getAllKakaoSessions();
  const existing = sessions.find((s) => s.kakaoUserId === kakaoUserId);
  if (existing) {
    return existing;
  }

  // 초기값은 user-001 (나) (요구사항 3)
  const newSession: KakaoSession = {
    kakaoUserId,
    selectedFamilyMemberId: "user-001",
    updatedAt: new Date().toISOString(),
  };
  saveKakaoSession(newSession);
  return newSession;
}

export function saveKakaoSession(session: KakaoSession): void {
  const sessions = getAllKakaoSessions();
  const index = sessions.findIndex((s) => s.kakaoUserId === session.kakaoUserId);
  if (index >= 0) {
    sessions[index] = { ...session, updatedAt: new Date().toISOString() };
  } else {
    sessions.push({ ...session, updatedAt: new Date().toISOString() });
  }
  writeJSON(KAKAO_SESSIONS_FILE, sessions);
}

export function updateKakaoSelectedFamily(
  kakaoUserId: string,
  familyMemberId: string
): KakaoSession {
  const session = getKakaoSession(kakaoUserId);
  session.selectedFamilyMemberId = familyMemberId;
  session.updatedAt = new Date().toISOString();
  saveKakaoSession(session);
  return session;
}

// ======== Document Operations ========

export function getAllDocuments(familyMemberId?: string, includeDeleted = false): DocumentRecord[] {
  let docs = readJSON<DocumentRecord[]>(DOCUMENTS_FILE, []);
  
  // 마이그레이션 호환: familyMemberId 없는 기존 문서 보정
  docs = docs.map((d) => ({
    ...d,
    familyMemberId: d.familyMemberId || "user-001",
  }));

  if (!includeDeleted) {
    docs = docs.filter((d) => !d.isDeleted);
  }

  if (familyMemberId) {
    docs = docs.filter((d) => d.familyMemberId === familyMemberId);
  }

  return docs;
}

export function getDocument(id: string): DocumentRecord | null {
  const docs = getAllDocuments(undefined, true);
  return docs.find((d) => d.id === id) || null;
}

export function saveDocument(doc: DocumentRecord): void {
  // familyMemberId 기본값 보장
  if (!doc.familyMemberId) {
    doc.familyMemberId = "user-001";
  }
  const docs = getAllDocuments(undefined, true);
  const index = docs.findIndex((d) => d.id === doc.id);
  if (index >= 0) {
    docs[index] = doc;
  } else {
    docs.push(doc);
  }
  writeJSON(DOCUMENTS_FILE, docs);
}

export function deleteDocument(id: string, soft = false): boolean {
  const docs = getAllDocuments(undefined, true);
  const index = docs.findIndex((d) => d.id === id);
  if (index < 0) return false;

  const doc = docs[index];

  if (soft) {
    doc.isDeleted = true;
    writeJSON(DOCUMENTS_FILE, docs);
    return true;
  }

  // 업로드 파일 삭제
  const uploadPath = path.join(UPLOADS_DIR, doc.storedFileName);
  if (fs.existsSync(uploadPath)) {
    fs.unlinkSync(uploadPath);
  }

  // 추출 텍스트 파일 삭제
  if (doc.extractedTextFile) {
    const textPath = path.join(EXTRACTED_DIR, doc.extractedTextFile);
    if (fs.existsSync(textPath)) {
      fs.unlinkSync(textPath);
    }
  }

  docs.splice(index, 1);
  writeJSON(DOCUMENTS_FILE, docs);
  return true;
}

// ======== Insurance Operations ========

export function getAllInsurance(familyMemberId?: string, includeDeleted = false): InsurancePolicy[] {
  let policies = readJSON<InsurancePolicy[]>(INSURANCE_FILE, []);

  // 마이그레이션 호환: familyMemberId 없는 기존 보험 보정
  policies = policies.map((p) => ({
    ...p,
    familyMemberId: p.familyMemberId || "user-001",
  }));

  if (!includeDeleted) {
    policies = policies.filter((p) => !p.isDeleted);
  }

  if (familyMemberId) {
    policies = policies.filter((p) => p.familyMemberId === familyMemberId);
  }

  return policies;
}

export function getInsurance(id: string): InsurancePolicy | null {
  const policies = getAllInsurance(undefined, true);
  return policies.find((p) => p.id === id) || null;
}

export function saveInsurance(policy: InsurancePolicy): void {
  if (!policy.familyMemberId) {
    policy.familyMemberId = "user-001";
  }
  const policies = getAllInsurance(undefined, true);
  const index = policies.findIndex((p) => p.id === policy.id);
  if (index >= 0) {
    policies[index] = policy;
  } else {
    policies.push(policy);
  }
  writeJSON(INSURANCE_FILE, policies);
}

export function deleteInsurance(id: string, soft = false): boolean {
  const policies = getAllInsurance(undefined, true);
  const index = policies.findIndex((p) => p.id === id);
  if (index < 0) return false;

  if (soft) {
    policies[index].isDeleted = true;
    policies[index].updatedAt = new Date().toISOString();
    writeJSON(INSURANCE_FILE, policies);
    return true;
  }

  policies.splice(index, 1);
  writeJSON(INSURANCE_FILE, policies);
  return true;
}

/**
 * 보험사+상품명으로 기존 보험 찾기 (특정 가족 구성원 범위 내에서만 검색)
 */
export function findInsuranceByProduct(
  company: string,
  productName: string,
  familyMemberId?: string
): InsurancePolicy | null {
  if (!company && !productName) return null;
  const policies = getAllInsurance(familyMemberId);
  return (
    policies.find((p) => {
      const companyMatch =
        !company || p.company.includes(company) || company.includes(p.company);
      const productMatch =
        !productName ||
        p.productName.includes(productName) ||
        productName.includes(p.productName);
      return companyMatch && productMatch && (company || productName);
    }) || null
  );
}

// ======== Extracted Text Operations ========

export function saveExtractedText(docId: string, text: string): string {
  ensureDirectories();
  const fileName = `${docId}.txt`;
  fs.writeFileSync(path.join(EXTRACTED_DIR, fileName), text, "utf-8");
  return fileName;
}

export function getExtractedText(docId: string): string {
  const filePath = path.join(EXTRACTED_DIR, `${docId}.txt`);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {
    // Ignore read errors
  }
  return "";
}

export function getAllExtractedTexts(familyMemberId?: string): Map<string, string> {
  const texts = new Map<string, string>();
  const docs = getAllDocuments(familyMemberId);
  for (const doc of docs) {
    if (doc.status === "completed" && doc.extractedTextFile) {
      const text = getExtractedText(doc.id);
      if (text) {
        texts.set(doc.id, text);
      }
    }
  }
  return texts;
}

// ======== File Operations ========

export function getUploadPath(storedFileName: string): string {
  return path.join(UPLOADS_DIR, storedFileName);
}

export function readUploadedFile(storedFileName: string): Buffer | null {
  const filePath = getUploadPath(storedFileName);
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

export { UPLOADS_DIR, DATA_DIR, EXTRACTED_DIR };
