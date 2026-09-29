"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DocumentUpload from "@/app/components/DocumentUpload";
import PasswordModal from "@/app/components/PasswordModal";
import FamilyManageModal from "@/app/components/FamilyManageModal";
import type { FamilyMember, InsurancePolicy, DocumentRecord } from "@/app/lib/types";
import styles from "./page.module.css";

export default function InsurancePage() {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>("user-001");
  const [showFamilyModal, setShowFamilyModal] = useState(false);

  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"insurance" | "documents">(
    "insurance"
  );
  const [passwordModal, setPasswordModal] = useState<{
    docId: string;
    fileName: string;
    familyMemberId?: string;
  } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInsurance, setNewInsurance] = useState({
    company: "",
    productName: "",
    monthlyPremium: "",
  });

  // 가족 목록 로드
  const fetchFamilyMembers = useCallback(async () => {
    try {
      const res = await fetch("/api/family");
      const data = await res.json();
      if (data.members && data.members.length > 0) {
        setFamilyMembers(data.members);
        if (!data.members.some((m: FamilyMember) => m.id === selectedFamilyId)) {
          setSelectedFamilyId(data.members[0].id);
        }
      }
    } catch {
      // silent
    }
  }, [selectedFamilyId]);

  // 선택된 가족의 보험 및 문서 데이터 로드 (요구사항 2, 3, 11)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [insRes, docRes] = await Promise.all([
        fetch(`/api/insurance?familyMemberId=${encodeURIComponent(selectedFamilyId)}`),
        fetch(`/api/documents?familyMemberId=${encodeURIComponent(selectedFamilyId)}`),
      ]);
      const insData = await insRes.json();
      const docData = await docRes.json();
      setPolicies(insData.insurance || []);
      setDocuments(docData.documents || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [selectedFamilyId]);

  useEffect(() => {
    fetchFamilyMembers();
  }, [fetchFamilyMembers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentMember =
    familyMembers.find((m) => m.id === selectedFamilyId) ||
    familyMembers[0] || {
      id: "user-001",
      name: "나",
      relationship: "본인",
      createdAt: "",
      updatedAt: "",
    };

  // 보험 수동 추가 (요구사항 2: familyMemberId 연결)
  const handleAddInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsurance.company && !newInsurance.productName) return;

    try {
      const res = await fetch("/api/insurance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newInsurance,
          familyMemberId: selectedFamilyId,
        }),
      });
      if (res.ok) {
        setNewInsurance({ company: "", productName: "", monthlyPremium: "" });
        setShowAddForm(false);
        fetchData();
      }
    } catch {
      // silent
    }
  };

  const handleDeleteInsurance = async (id: string) => {
    if (!confirm(`'${currentMember.name}'님의 이 보험을 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/insurance/${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      // silent
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm(`'${currentMember.name}'님의 이 문서를 삭제하시겠습니까?`)) return;
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      fetchData();
    } catch {
      // silent
    }
  };

  // 통계 계산
  const totalRiders = policies.reduce((acc, p) => acc + (p.riders?.length || 0), 0);
  const totalPremiumNumbers = policies
    .map((p) => {
      const num = parseInt((p.monthlyPremium || "").replace(/[^0-9]/g, ""), 10);
      return isNaN(num) ? 0 : num;
    })
    .reduce((a, b) => a + b, 0);

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return { text: "대기", cls: styles.badgePending };
      case "analyzing":
        return { text: "분석 중", cls: styles.badgeAnalyzing };
      case "completed":
        return { text: "완료", cls: styles.badgeCompleted };
      case "password_required":
        return { text: "비밀번호 필요", cls: styles.badgePassword };
      case "error":
        return { text: "오류", cls: styles.badgeError };
      default:
        return { text: status, cls: "" };
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🛡️</div>
            <span className={styles.logoText}>보험 AI 어시스턴트</span>
          </div>
          <nav className={styles.nav}>
            <Link href="/" className={styles.navLink}>
              💬 AI 채팅
            </Link>
            <Link
              href="/insurance"
              className={`${styles.navLink} ${styles.navLinkActive}`}
            >
              🛡️ 보험 관리
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.mainInner}>
          {/* 가족 선택 탭 및 가족 관리 (요구사항 4, 11) */}
          <section className={styles.familyNavSection}>
            <div className={styles.familyTabsHeader}>
              <div className={styles.familyTabs}>
                {familyMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`${styles.familyTab} ${
                      selectedFamilyId === member.id ? styles.familyTabActive : ""
                    }`}
                    onClick={() => setSelectedFamilyId(member.id)}
                  >
                    <span>
                      {member.relationship === "본인"
                        ? "👤"
                        : member.relationship === "배우자"
                        ? "💍"
                        : member.relationship === "자녀"
                        ? "👶"
                        : "👥"}
                    </span>
                    {member.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.familyManageBtn}
                onClick={() => setShowFamilyModal(true)}
              >
                <span>⚙️</span> 가족 관리 / 추가
              </button>
            </div>

            {/* 현재 선택된 가족 통계 바 (요구사항 4, 11) */}
            <div className={styles.familyStatsBar}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>대상 가족</span>
                <span className={styles.statValue}>
                  👤 {currentMember.name} ({currentMember.relationship})
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>가입 보험</span>
                <span className={styles.statValue}>{policies.length}건</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>보관 문서</span>
                <span className={styles.statValue}>{documents.length}개</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>보장 특약</span>
                <span className={styles.statValue}>{totalRiders}개</span>
              </div>
              {totalPremiumNumbers > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>월 총 보험료</span>
                  <span className={styles.statValue}>
                    {totalPremiumNumbers.toLocaleString()}원
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 페이지 제목 및 액션 버튼 */}
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>
              {currentMember.name}님의 보험 및 문서
            </h1>
            <div className={styles.pageActions}>
              <button
                className={styles.actionButton}
                onClick={() => setShowAddForm(!showAddForm)}
              >
                ➕ {currentMember.name} 보험 추가
              </button>
              <Link href="/" className={styles.actionButton} style={{ textDecoration: "none" }}>
                💬 AI에게 질문하기
              </Link>
            </div>
          </div>

          {/* 보험 추가 폼 */}
          {showAddForm && (
            <form className={styles.addForm} onSubmit={handleAddInsurance}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-accent-primary)", marginBottom: 8 }}>
                👤 {currentMember.name}님에게 등록될 보험 정보를 입력하세요
              </div>
              <input
                type="text"
                placeholder="보험사 (예: 삼성화재, 현대해상)"
                value={newInsurance.company}
                onChange={(e) =>
                  setNewInsurance({ ...newInsurance, company: e.target.value })
                }
                className={styles.formInput}
                required
              />
              <input
                type="text"
                placeholder="상품명 (예: 어린이보험, 종합건강보험)"
                value={newInsurance.productName}
                onChange={(e) =>
                  setNewInsurance({
                    ...newInsurance,
                    productName: e.target.value,
                  })
                }
                className={styles.formInput}
                required
              />
              <input
                type="text"
                placeholder="월 보험료 (예: 50,000원)"
                value={newInsurance.monthlyPremium}
                onChange={(e) =>
                  setNewInsurance({
                    ...newInsurance,
                    monthlyPremium: e.target.value,
                  })
                }
                className={styles.formInput}
              />
              <div className={styles.formButtons}>
                <button type="submit" className={styles.submitBtn}>
                  등록
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowAddForm(false)}
                >
                  취소
                </button>
              </div>
            </form>
          )}

          {/* 문서 업로드 (요구사항 9) */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              📄 {currentMember.name} 문서 업로드
            </h2>
            <DocumentUpload
              currentFamilyMemberId={selectedFamilyId}
              familyMembers={familyMembers}
              onUploadComplete={fetchData}
              onPasswordNeeded={(docId, fileName) =>
                setPasswordModal({ docId, fileName })
              }
            />
          </section>

          {/* 탭 */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "insurance" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("insurance")}
            >
              🛡️ {currentMember.name} 보험 목록 ({policies.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === "documents" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("documents")}
            >
              📋 {currentMember.name} 문서 목록 ({documents.length})
            </button>
          </div>

          {/* 보험 목록 */}
          {activeTab === "insurance" && (
            <section className={styles.section}>
              {loading ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : policies.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>🛡️</div>
                  <p>{currentMember.name}님에게 등록된 보험이 없습니다.</p>
                  <p className={styles.emptyHint}>
                    상단의 문서 업로드에서 {currentMember.name}님의 보험 문서를 업로드하면 자동으로 분석 및 등록됩니다.
                  </p>
                </div>
              ) : (
                <div className={styles.cardGrid}>
                  {policies.map((policy) => (
                    <div key={policy.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <span className={styles.cardCompany}>
                          {policy.company || "보험사 미확인"}
                        </span>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteInsurance(policy.id)}
                          title="삭제"
                        >
                          ✕
                        </button>
                      </div>
                      <h3 className={styles.cardTitle}>
                        {policy.productName || "상품명 미확인"}
                      </h3>
                      <div className={styles.cardMeta}>
                        {policy.contractDate && (
                          <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>계약일</span>
                            <span>{policy.contractDate}</span>
                          </div>
                        )}
                        {(policy.insurancePeriodStart ||
                          policy.insurancePeriodEnd) && (
                          <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>보험기간</span>
                            <span>
                              {policy.insurancePeriodStart} ~{" "}
                              {policy.insurancePeriodEnd}
                            </span>
                          </div>
                        )}
                        {policy.monthlyPremium && (
                          <div className={styles.metaItem}>
                            <span className={styles.metaLabel}>월 보험료</span>
                            <span>{policy.monthlyPremium}</span>
                          </div>
                        )}
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>특약</span>
                          <span>{policy.riders?.length || 0}개</span>
                        </div>
                        <div className={styles.metaItem}>
                          <span className={styles.metaLabel}>문서</span>
                          <span>{policy.documentIds?.length || 0}개</span>
                        </div>
                      </div>

                      {/* 특약 미리보기 목록 */}
                      {policy.riders && policy.riders.length > 0 && (
                        <div style={{ marginTop: 12, borderTop: "1px solid var(--color-border-primary)", paddingTop: 8 }}>
                          <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: 4 }}>
                            주요 특약 ({policy.riders.length}개):
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {policy.riders.slice(0, 4).map((rider, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                  background: "var(--color-bg-secondary)",
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                {rider.name}
                              </span>
                            ))}
                            {policy.riders.length > 4 && (
                              <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                                +{policy.riders.length - 4}개 더보기
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <Link
                        href={`/insurance/${policy.id}`}
                        className={styles.cardLink}
                        style={{ marginTop: 12 }}
                      >
                        상세 보기 →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 문서 목록 */}
          {activeTab === "documents" && (
            <section className={styles.section}>
              {loading ? (
                <div className={styles.empty}>불러오는 중...</div>
              ) : documents.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📄</div>
                  <p>{currentMember.name}님에게 등록된 문서가 없습니다.</p>
                </div>
              ) : (
                <div className={styles.docTable}>
                  {documents.map((doc) => {
                    const { text, cls } = statusLabel(doc.status);
                    return (
                      <div key={doc.id} className={styles.docRow}>
                        <div className={styles.docRowMain}>
                          <span className={styles.docRowIcon}>
                            {doc.fileName.endsWith(".pdf") ? "📋" : "🖼️"}
                          </span>
                          <div className={styles.docRowInfo}>
                            <div className={styles.docRowName}>
                              {doc.fileName}
                            </div>
                            <div className={styles.docRowSub}>
                              {doc.documentType && (
                                <span>{doc.documentType}</span>
                              )}
                              {doc.company && <span>{doc.company}</span>}
                              {doc.productName && <span>{doc.productName}</span>}
                              {doc.ocrUsed && (
                                <span className={styles.ocrBadge}>
                                  OCR 사용
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={styles.docRowActions}>
                          <span className={`${styles.badge} ${cls}`}>
                            {text}
                          </span>
                          {doc.status === "password_required" && (
                            <button
                              className={styles.passwordBtn}
                              onClick={() =>
                                setPasswordModal({
                                  docId: doc.id,
                                  fileName: doc.fileName,
                                  familyMemberId: doc.familyMemberId,
                                })
                              }
                            >
                              🔑 비밀번호 입력
                            </button>
                          )}
                          <button
                            className={styles.deleteBtn}
                            onClick={() => handleDeleteDocument(doc.id)}
                            title="삭제"
                          >
                            ✕
                          </button>
                        </div>
                        {doc.errorMessage && (
                          <div className={styles.docRowError}>
                            {doc.errorMessage}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {/* 비밀번호 모달 */}
      {passwordModal && (
        <PasswordModal
          docId={passwordModal.docId}
          fileName={passwordModal.fileName}
          onSuccess={() => {
            setPasswordModal(null);
            fetchData();
          }}
          onClose={() => setPasswordModal(null)}
        />
      )}

      {/* 가족 관리 모달 */}
      {showFamilyModal && (
        <FamilyManageModal
          members={familyMembers}
          onClose={() => setShowFamilyModal(false)}
          onUpdated={() => {
            fetchFamilyMembers();
            fetchData();
          }}
        />
      )}
    </div>
  );
}
