# 🛡️ 보험 AI 어시스턴트

개인용 보험 관리 AI 챗봇 웹 애플리케이션입니다.

보험증권, 보험가입내역, 보험약관 PDF/이미지를 업로드하면 AI가 문서를 분석하고,
질문에 대해 보험 보장 내용을 근거와 함께 찾아 답변합니다.

## 🚀 빠른 시작

### 1. 필수 요구 사항

- **Node.js** 18.0 이상 (권장: LTS 최신 버전)
- **Gemini API 키** ([Google AI Studio](https://aistudio.google.com/apikey)에서 발급)

### 2. 설치

```bash
# 프로젝트 폴더로 이동
cd E:\plan

# 패키지 설치
npm install
```

### 3. 환경변수 설정

`.env.local` 파일을 열고 Gemini API 키를 설정합니다:

```bash
# .env.local
GEMINI_API_KEY=여기에_실제_API_키를_입력하세요
```

> ⚠️ **주의**: `.env.local` 파일은 절대로 Git에 커밋하지 마세요. (`.gitignore`에 이미 포함되어 있습니다)

### 4. 실행

```bash
npm run dev
```

브라우저에서 **http://localhost:3000** 으로 접속합니다.

## 📱 사용 방법

1. 웹 브라우저에서 `http://localhost:3000` 접속
2. 채팅창에 보험 관련 질문 입력
3. AI가 답변 제공

### 질문 예시

- "보험 용어 중 '면책기간'이 뭔가요?"
- "실손의료보험은 어떤 항목을 보장하나요?"
- "보험금 청구할 때 일반적으로 필요한 서류가 뭔가요?"

## 👨‍👩‍👧‍👦 가족별 보험 관리 기능 (신규 추가)

1. **가족 구성원 관리**: 나(본인), 배우자, 자녀(아들/딸) 등 가족 구성원 등록, 수정, 삭제(soft delete)
2. **가족별 데이터 완전 분리**: 모든 보험 계약 및 증권 문서는 반드시 특정 `familyMemberId`에 연결
3. **가족 데이터 완전 격리 AI 검색**:
   - 현재 선택된 가족의 보험/약관 데이터만 격리하여 검색
   - 다른 가족의 보험, 약관, 특약은 AI 프롬프트에 절대 전달되지 않음
4. **가족 명시 질문 자동 지원**:
   - 질문에서 타 가족("아들 보험에서...", "배우자 보험에서...")을 명시하면 안전하게 대상 가족으로 자동 전환하여 분석
5. **AI 답변 가족 이름 명시**:
   - 답변 상단에 `[아들 보험 분석] 아들님의 가입 보험을 기준으로 확인했습니다.` 형태로 대상 명시
6. **가족별 대화 컨텍스트 분리**:
   - 가족 구성원 전환 시 대화 내역이 섞이지 않도록 가족별 대화창 분리

## 🏗️ 기술 스택

| 기술 | 용도 |
|------|------|
| **Next.js 16 (App Router)** | React 풀스택 프레임워크 |
| **TypeScript** | 타입 안전성 |
| **Google Gemini 2.0 Flash** | AI 대화 생성, 비전 OCR, 보험 약관 분석 |
| **pdf-parse** | PDF 텍스트 추출 및 비밀번호 검증 |
| **CSS Modules** | 컴포넌트 스타일링 |

## 📁 프로젝트 구조

```
plan/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts              # 가족별 격리 AI 질의응답
│   │   │   ├── family/route.ts            # 가족 목록 및 추가
│   │   │   ├── family/[id]/route.ts       # 가족 수정 및 soft delete
│   │   │   ├── documents/route.ts         # 가족별 문서 목록
│   │   │   ├── documents/upload/route.ts  # 가족별 문서 업로드
│   │   │   ├── documents/[id]/analyze/    # 문서 분석 및 보험 자동 매칭
│   │   │   ├── documents/[id]/password/   # 비밀번호 PDF 처리
│   │   │   ├── insurance/route.ts         # 가족별 보험 목록 및 생성
│   │   │   └── insurance/[id]/route.ts    # 보험 상세 조회/수정/삭제
│   │   ├── components/
│   │   │   ├── DocumentUpload.tsx         # 대상 가족 지정 문서 업로드
│   │   │   ├── FamilyManageModal.tsx      # 가족 구성원 관리 모달
│   │   │   └── PasswordModal.tsx          # 비밀번호 PDF 입력 모달
│   │   ├── insurance/
│   │   │   ├── page.tsx                   # 가족별 보험 및 문서 관리 대시보드
│   │   │   └── [id]/page.tsx              # 보험 상세 정보 및 특약 확인
│   │   ├── lib/
│   │   │   ├── documentSearch.ts          # 가족별 격리 검색 및 타가족 감지
│   │   │   ├── geminiAnalyzer.ts          # Gemini 문서/Vision OCR 분석기
│   │   │   ├── pdfParser.ts               # PDF 암호 검증 및 텍스트 추출
│   │   │   ├── piiMasker.ts               # 개인정보(주민번호 등) 마스킹
│   │   │   ├── storage.ts                 # JSON 파일 저장소 (familyMemberId 관리)
│   │   │   └── types.ts                   # 공통 타입 및 인터페이스
│   │   ├── globals.css                    # 글로벌 디자인 시스템
│   │   ├── page.module.css                # 메인 챗봇 스타일
│   │   └── page.tsx                       # 메인 AI 챗봇 (가족 선택 및 격리)
│   └── types/
├── data/                                  # 로컬 데이터 (JSON 저장소)
├── uploads/                               # 업로드 문서 (Git 제외)
├── test_family_isolation.mjs              # 가족 데이터 격리 1~7 테스트 스크립트
├── .env.local                             # Gemini API 키 (Git 제외)
└── README.md
```

## 🔒 보안 및 개인정보 보호

- 모든 주민등록번호, 계좌번호, 전화번호, 주소는 분석 전 마스킹 처리 (`piiMasker.ts`)
- PDF 비밀번호는 메모리 상에서 1회성 검증 후 즉시 가비지 컬렉션 처리 (영구 저장하지 않음)
- 가족 구성원 삭제 시 하위 데이터 안전 처리 (soft delete)
- API 키는 `.env.local`로만 관리되며 클라이언트 노출 원천 차단

## 🗺️ 개발 로드맵

- [x] A. 프로젝트 생성 및 웹 UI
- [x] B. Gemini API 연결 및 챗봇
- [x] C. 문서 업로드 (PDF/이미지) 및 Gemini Vision OCR
- [x] D. 비밀번호 보호 PDF 지원
- [x] E. 보험증권 자동 분류 및 특약 구조화
- [x] F. 가족 구성원 관리 (나, 배우자, 자녀 등)
- [x] G. 가족별 보험 및 문서 데이터 완전 분리
- [x] H. AI 검색 시 familyMemberId 엄격 격리 필터링
- [x] I. 질문 내 타 가족 명시 시 자동 전환 분석
- [x] J. 가족별 대화 컨텍스트 분리 및 UI 상시 표시
- [ ] H. 카카오톡 연동 (향후)

## ⚠️ 면책 사항

이 AI 어시스턴트의 답변은 **참고용**이며, 실제 보장 여부와 보험금 지급은
반드시 해당 보험사의 약관과 보험증권을 확인해야 합니다.
AI가 제공하는 정보는 법적 효력이 없습니다.
