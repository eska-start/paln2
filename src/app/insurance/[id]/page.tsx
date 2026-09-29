"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

interface RiderInfo {
  name: string;
  coverageAmount: string;
  benefitAmount: string;
  conditions: string;
  exclusions: string;
  reductionConditions: string;
  renewable: string;
  coveragePeriod: string;
  sourceDocument: string;
  sourcePage: string;
}

interface InsurancePolicy {
  id: string;
  familyMemberId?: string;
  company: string;
  productName: string;
  contractDate: string;
  insurancePeriodStart: string;
  insurancePeriodEnd: string;
  monthlyPremium: string;
  mainContract: string;
  riders: RiderInfo[];
  documentIds: string[];
}

interface DocumentRecord {
  id: string;
  familyMemberId?: string;
  fileName: string;
  documentType: string;
  status: string;
  ocrUsed: boolean;
  uploadDate: string;
  analysisDate: string | null;
}

export default function InsuranceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [policy, setPolicy] = useState<InsurancePolicy | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [familyMemberName, setFamilyMemberName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expandedRider, setExpandedRider] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [res, famRes] = await Promise.all([
        fetch(`/api/insurance/${id}`),
        fetch("/api/family"),
      ]);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      const famData = await famRes.json();
      setPolicy(data.insurance);
      setDocuments(data.documents || []);

      if (data.insurance?.familyMemberId && famData.members) {
        const mem = famData.members.find(
          (m: { id: string; name: string }) => m.id === data.insurance.familyMemberId
        );
        if (mem) setFamilyMemberName(`${mem.name} (${mem.relationship})`);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>불러오는 중...</div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <p>보험을 찾을 수 없습니다.</p>
          <Link href="/insurance" className={styles.backLink}>
            ← 보험 관리로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

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
            <Link href="/insurance" className={styles.navLink}>
              🛡️ 보험 관리
            </Link>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.mainInner}>
          <Link href="/insurance" className={styles.backLink}>
            ← 보험 관리
          </Link>

          {/* 기본 정보 */}
          <div className={styles.infoCard}>
            <div className={styles.infoHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={styles.company}>{policy.company || "보험사 미확인"}</span>
                {familyMemberName && (
                  <span
                    style={{
                      fontSize: "0.8rem",
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "var(--color-accent-primary)",
                      fontWeight: 600,
                    }}
                  >
                    👤 {familyMemberName}
                  </span>
                )}
              </div>
              <Link href={`/?q=${encodeURIComponent(`${policy.company} ${policy.productName} 보장 내용`)}`} className={styles.askAI}>
                🤖 AI에게 질문하기
              </Link>
            </div>
            <h1 className={styles.productName}>
              {policy.productName || "상품명 미확인"}
            </h1>
            <div className={styles.infoGrid}>
              {policy.contractDate && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>계약일</span>
                  <span className={styles.infoValue}>{policy.contractDate}</span>
                </div>
              )}
              {(policy.insurancePeriodStart || policy.insurancePeriodEnd) && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>보험기간</span>
                  <span className={styles.infoValue}>
                    {policy.insurancePeriodStart} ~ {policy.insurancePeriodEnd}
                  </span>
                </div>
              )}
              {policy.monthlyPremium && (
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>월 보험료</span>
                  <span className={styles.infoValue}>{policy.monthlyPremium}</span>
                </div>
              )}
            </div>
          </div>

          {/* 주계약 */}
          {policy.mainContract && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>📋 주계약</h2>
              <div className={styles.contentBox}>
                {policy.mainContract}
              </div>
            </section>
          )}

          {/* 특약 목록 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              📑 특약 목록 ({policy.riders.length}개)
            </h2>
            {policy.riders.length === 0 ? (
              <div className={styles.emptySection}>
                등록된 특약이 없습니다. 보험 약관을 업로드하면 자동으로 추출됩니다.
              </div>
            ) : (
              <div className={styles.riderList}>
                {policy.riders.map((rider, idx) => (
                  <div key={idx} className={styles.riderCard}>
                    <div
                      className={styles.riderHeader}
                      onClick={() =>
                        setExpandedRider(expandedRider === idx ? null : idx)
                      }
                    >
                      <span className={styles.riderName}>{rider.name}</span>
                      <div className={styles.riderQuick}>
                        {rider.coverageAmount && (
                          <span className={styles.riderAmount}>
                            {rider.coverageAmount}
                          </span>
                        )}
                        <span className={styles.expandIcon}>
                          {expandedRider === idx ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>
                    {expandedRider === idx && (
                      <div className={styles.riderDetail}>
                        {rider.coverageAmount && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>가입금액</span>
                            <span>{rider.coverageAmount}</span>
                          </div>
                        )}
                        {rider.benefitAmount && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>보장금액</span>
                            <span>{rider.benefitAmount}</span>
                          </div>
                        )}
                        {rider.conditions && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>보장조건</span>
                            <span>{rider.conditions}</span>
                          </div>
                        )}
                        {rider.exclusions && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>면책조건</span>
                            <span>{rider.exclusions}</span>
                          </div>
                        )}
                        {rider.reductionConditions && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>감액조건</span>
                            <span>{rider.reductionConditions}</span>
                          </div>
                        )}
                        {rider.renewable && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>갱신 여부</span>
                            <span>{rider.renewable}</span>
                          </div>
                        )}
                        {rider.coveragePeriod && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>보장기간</span>
                            <span>{rider.coveragePeriod}</span>
                          </div>
                        )}
                        {(rider.sourceDocument || rider.sourcePage) && (
                          <div className={styles.detailSource}>
                            📄 근거: {rider.sourceDocument}
                            {rider.sourcePage && ` ${rider.sourcePage}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 관련 문서 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              📁 관련 문서 ({documents.length}개)
            </h2>
            {documents.length === 0 ? (
              <div className={styles.emptySection}>
                연결된 문서가 없습니다.
              </div>
            ) : (
              <div className={styles.docList}>
                {documents.map((doc) => (
                  <div key={doc.id} className={styles.docItem}>
                    <span className={styles.docIcon}>
                      {doc.fileName.endsWith(".pdf") ? "📋" : "🖼️"}
                    </span>
                    <div className={styles.docInfo}>
                      <div className={styles.docName}>{doc.fileName}</div>
                      <div className={styles.docMeta}>
                        {doc.documentType && <span>{doc.documentType}</span>}
                        {doc.ocrUsed && <span className={styles.ocrTag}>OCR</span>}
                        {doc.analysisDate && (
                          <span>
                            분석일:{" "}
                            {new Date(doc.analysisDate).toLocaleDateString("ko-KR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
