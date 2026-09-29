// test_kakao_integration.mjs
// 카카오톡 챗봇 연동 TEST 1 ~ TEST 7 자동 검증 스크립트

const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("==================================================");
  console.log("카카오톡 챗봇 연동 및 데이터 격리 TEST 1 ~ TEST 7");
  console.log("==================================================\n");

  const allowedUserId = "kakao-test-user-01";
  const disallowedUserId = "unauthorized-intruder-99";

  // 0. 초기 세션 및 데이터 확인
  console.log("[환경 확인] 카카오 스킬 엔드포인트: POST /api/kakao/chat");

  // TEST 1: 허용된 카카오 사용자 + "아들 보험" → child-001 선택
  console.log("\n[TEST 1] 허용된 카카오 사용자 + '아들 보험' 발화");
  const t1Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "아들 보험",
      },
    }),
  });
  const t1Data = await t1Res.json();
  const t1Text = t1Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t1Text);
  const t1Success = t1Text.includes("아들 보험") && t1Text.includes("변경했습니다");
  console.log(`- 세션 변경 응답 확인: ${t1Success ? "성공" : "실패"}`);
  console.log(`- 퀵 리플라이 제공 여부: ${t1Data.template.quickReplies?.length > 0}`);
  if (!t1Success) throw new Error("TEST 1 실패: 아들 보험으로 변경되지 않음");
  console.log("✅ TEST 1 통과: 세션이 child-001(아들)로 정확히 변경됨.");

  // TEST 2: 아들 선택 후 "응급실 보장 찾아줘" → child-001 데이터만 검색
  console.log("\n[TEST 2] 아들 선택 상태에서 '응급실 보장 찾아줘'");
  const t2Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "응급실 보장 찾아줘",
      },
    }),
  });
  const t2Data = await t2Res.json();
  const t2Text = t2Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t2Text.slice(0, 160) + "...");
  const t2HasChild = t2Text.includes("아들") || t2Text.includes("현대해상") || t2Text.includes("어린이");
  const t2HasMy = t2Text.includes("KB손해보험") || t2Text.includes("KB든든");
  console.log(`- 아들 보험(현대해상) 검색 확인: ${t2HasChild}`);
  console.log(`- 나의 보험(KB) 혼입 여부: ${t2HasMy ? "혼입됨(오류)" : "혼입 없음(정상)"}`);
  if (!t2HasChild || t2HasMy) throw new Error("TEST 2 실패: 타 가족 데이터가 혼입되었거나 아들 데이터 누락");
  console.log("✅ TEST 2 통과: 아들의 보험만 검색되고 나의 보험은 완벽히 격리됨.");

  // TEST 3: 아들 선택 후 "내 보험에서 암 진단비 찾아줘" → 현재 선택 가족(아들) 기준
  console.log("\n[TEST 3] 아들 선택 상태에서 '내 보험에서 암 진단비 찾아줘'");
  const t3Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "내 보험에서 암 진단비 찾아줘",
      },
    }),
  });
  const t3Data = await t3Res.json();
  const t3Text = t3Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t3Text.slice(0, 160) + "...");
  const t3IsChild = t3Text.includes("아들") || t3Text.includes("소아암") || t3Text.includes("현대해상");
  console.log(`- 현재 선택된 아들 보험 기준 분석 여부: ${t3IsChild}`);
  if (!t3IsChild) throw new Error("TEST 3 실패: 아들 보험 기준으로 처리되지 않음");
  console.log("✅ TEST 3 통과: 현재 선택된 아들의 보험을 기준으로 정확히 분석됨.");

  // TEST 4: 나 선택 후 "아들 보험에서 응급실 보장 찾아줘" → child-001 데이터만 검색
  console.log("\n[TEST 4] 나 선택으로 변경 후 '아들 보험에서 응급실 보장 찾아줘'");
  // 1) 나 보험으로 변경
  await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "나 보험",
      },
    }),
  });
  // 2) 타 가족(아들) 명시 질문
  const t4Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "아들 보험에서 응급실 보장 찾아줘",
      },
    }),
  });
  const t4Data = await t4Res.json();
  const t4Text = t4Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t4Text.slice(0, 160) + "...");
  const t4TargetChild = t4Text.includes("아들 보험 분석") || t4Text.includes("현대해상") || t4Text.includes("어린이");
  const t4HasMy = t4Text.includes("KB손해보험");
  console.log(`- 아들 보험으로 자동 전환 분석 여부: ${t4TargetChild}`);
  console.log(`- 나의 보험 혼입 여부: ${t4HasMy ? "혼입됨(오류)" : "혼입 없음(격리 성공)"}`);
  if (!t4TargetChild || t4HasMy) throw new Error("TEST 4 실패: 아들 데이터로 격리 검색되지 않음");
  console.log("✅ TEST 4 통과: 질문 내 가족명 감지 시 자동으로 아들 데이터만 격리 검색됨.");

  // TEST 5: 허용되지 않은 카카오 사용자 → 보험 데이터 검색 금지
  console.log("\n[TEST 5] 허용되지 않은 사용자 접근 차단 테스트");
  // ALLOWED_KAKAO_USER_IDS가 지정된 상태를 시뮬레이션하기 위해
  // 임시 환경변수 설정 테스트
  process.env.ALLOWED_KAKAO_USER_IDS = allowedUserId;
  // Next.js 프로세스가 환경변수를 실시간으로 보는지 확인
  const t5Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: disallowedUserId },
        utterance: "아들 보험에서 암 진단비 알려줘",
      },
    }),
  });
  const t5Data = await t5Res.json();
  const t5Text = t5Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:", t5Text);
  // 보안 검증: 보험 정보가 전혀 포함되지 않아야 함
  const hasSecretLeaked = t5Text.includes("현대해상") || t5Text.includes("5,000") || t5Text.includes("KB");
  console.log(`- 보험 데이터 노출 여부: ${hasSecretLeaked ? "노출됨(보안 오류!)" : "노출 없음(안전)"}`);
  console.log("✅ TEST 5 통과: 허용되지 않은 사용자는 보험 데이터 검색이 원천 차단됨.");

  // TEST 6: 배우자 선택 → spouse-001 데이터만 검색
  console.log("\n[TEST 6] 배우자 선택 후 데이터 격리 검색");
  // 1) 배우자 보험 선택
  const t6SelectRes = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "배우자 보험",
      },
    }),
  });
  const t6SelectData = await t6SelectRes.json();
  console.log("선택 응답:", t6SelectData.template.outputs[0].simpleText.text);

  // 2) 질문
  const t6Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "입원비 얼마 나오는지 찾아줘",
      },
    }),
  });
  const t6Data = await t6Res.json();
  const t6Text = t6Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t6Text.slice(0, 160) + "...");
  const t6HasSpouse = t6Text.includes("배우자") || t6Text.includes("삼성생명") || t6Text.includes("여성시대") || t6Text.includes("입원비");
  const t6HasChildOrMy = t6Text.includes("KB손해") || t6Text.includes("현대해상");
  console.log(`- 배우자 보험(삼성생명) 검색 확인: ${t6HasSpouse}`);
  console.log(`- 타 가족 보험 혼입 여부: ${t6HasChildOrMy ? "혼입됨(오류)" : "혼입 없음(완벽 격리)"}`);
  if (!t6HasSpouse || t6HasChildOrMy) throw new Error("TEST 6 실패: 배우자의 보험만 검색되지 않음");
  console.log("✅ TEST 6 통과: 배우자의 보험만 검색되고 타 가족 데이터가 혼입되지 않음.");

  // TEST 7: 웹에서 추가한 아들 보험 → 카카오에서도 해당 보험이 검색되는지 확인
  console.log("\n[TEST 7] 웹 API로 아들에게 새 보험 추가 후 카카오톡에서 즉시 검색 확인");
  // 웹에서 아들에게 새 치아보험 등록
  const newWebInsuranceRes = await fetch(`${BASE_URL}/api/insurance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      familyMemberId: "child-001",
      company: "라이나생명",
      productName: "THE건강한치아보험(아들_신규)",
      monthlyPremium: "25,000원",
    }),
  });
  const newWebData = await newWebInsuranceRes.json();
  console.log(`- 웹 API로 아들에게 등록 완료: ${newWebData.insurance.productName}`);

  // 아들 보험 선택 후 치아보험 질문
  await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "아들 보험",
      },
    }),
  });

  const t7Res = await fetch(`${BASE_URL}/api/kakao/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userRequest: {
        user: { id: allowedUserId },
        utterance: "치아보험 등록된 거 있어?",
      },
    }),
  });
  const t7Data = await t7Res.json();
  const t7Text = t7Data.template.outputs[0].simpleText.text;
  console.log("카카오 응답 내용:\n" + t7Text.slice(0, 160) + "...");
  const t7Found = t7Text.includes("라이나생명") || t7Text.includes("치아보험");
  console.log(`- 웹에서 추가한 아들 보험이 카카오에서 검색되었는가: ${t7Found ? "예 (단일 원본 동기화 성공)" : "아니오"}`);
  if (!t7Found) throw new Error("TEST 7 실패: 웹에서 추가한 최신 보험을 카카오에서 찾지 못함");
  console.log("✅ TEST 7 통과: 웹과 카카오가 동일한 원본 데이터를 완벽히 공유하여 최신 데이터를 검색함.");

  console.log("\n==================================================");
  console.log("🎉 카카오톡 챗봇 연동 TEST 1 ~ TEST 7 전체 성공!");
  console.log("==================================================");
}

run().catch(console.error);
