"use client";

import { useState } from "react";
import styles from "./FamilyManageModal.module.css";
import type { FamilyMember } from "@/app/lib/types";

interface Props {
  members: FamilyMember[];
  onClose: () => void;
  onUpdated: () => void;
}

export default function FamilyManageModal({
  members,
  onClose,
  onUpdated,
}: Props) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("자녀");
  const [customId, setCustomId] = useState("");
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FamilyMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim(),
          id: customId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가족 추가 실패");

      setName("");
      setCustomId("");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/family/${editingMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingMember.name,
          relationship: editingMember.relationship,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가족 수정 실패");

      setEditingMember(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (member: FamilyMember) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/family/${member.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "가족 삭제 실패");

      setDeleteTarget(null);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const getRelationshipIcon = (rel: string) => {
    switch (rel) {
      case "본인":
        return "👤";
      case "배우자":
        return "💍";
      case "자녀":
        return "👶";
      case "부모":
        return "👵";
      default:
        return "👥";
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>
            <span>👨‍👩‍👧‍👦</span> 가족 구성원 관리
          </div>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* 오류 메시지 */}
          {error && (
            <div
              style={{
                color: "var(--color-error)",
                fontSize: "0.85rem",
                marginBottom: 12,
                padding: "8px 12px",
                background: "rgba(239,68,68,0.1)",
                borderRadius: 6,
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* 삭제 확인 팝업 (요구사항 15) */}
          {deleteTarget && (
            <div className={styles.confirmDialog}>
              <div className={styles.confirmText}>
                <strong>&apos;{deleteTarget.name}&apos;</strong> 구성원을 삭제하시겠습니까?
                <br />
                해당 가족의 보험과 문서도 함께 삭제(비활성화)됩니다.
              </div>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setDeleteTarget(null)}
                  disabled={loading}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={loading}
                >
                  삭제 확인
                </button>
              </div>
            </div>
          )}

          {/* 구성원 목록 */}
          <div className={styles.memberList}>
            {members.map((member) => (
              <div key={member.id} className={styles.memberItem}>
                <div className={styles.memberInfo}>
                  <div className={styles.memberAvatar}>
                    {getRelationshipIcon(member.relationship)}
                  </div>
                  <div>
                    <div className={styles.memberName}>{member.name}</div>
                    <div className={styles.memberMeta}>
                      <span className={styles.memberBadge}>
                        {member.relationship}
                      </span>
                      <span>ID: {member.id}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.memberActions}>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => setEditingMember({ ...member })}
                    disabled={loading}
                  >
                    수정
                  </button>
                  {member.id !== "user-001" && (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => setDeleteTarget(member)}
                      disabled={loading}
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 수정 모드 */}
          {editingMember && (
            <form onSubmit={handleUpdate} className={styles.addSection} style={{ marginBottom: 16 }}>
              <div className={styles.addTitle}>
                <span>✏️</span> 가족 정보 수정 ({editingMember.name})
              </div>
              <div className={styles.formGrid}>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>이름</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={editingMember.name}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label}>관계</label>
                  <select
                    className={styles.select}
                    value={editingMember.relationship}
                    onChange={(e) =>
                      setEditingMember({
                        ...editingMember,
                        relationship: e.target.value,
                      })
                    }
                  >
                    <option value="본인">본인</option>
                    <option value="배우자">배우자</option>
                    <option value="자녀">자녀</option>
                    <option value="부모">부모</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={loading}
                >
                  수정 저장
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setEditingMember(null)}
                >
                  취소
                </button>
              </div>
            </form>
          )}

          {/* 가족 추가 폼 */}
          <form onSubmit={handleAdd} className={styles.addSection}>
            <div className={styles.addTitle}>
              <span>➕</span> 새 가족 구성원 추가
            </div>
            <div className={styles.formGrid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>이름 / 별칭</label>
                <input
                  type="text"
                  placeholder="예: 딸, 어머니, 민수"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>관계</label>
                <select
                  className={styles.select}
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                >
                  <option value="배우자">배우자</option>
                  <option value="자녀">자녀</option>
                  <option value="부모">부모</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
            <div className={styles.inputGroup} style={{ marginBottom: 8 }}>
              <label className={styles.label}>
                고유 ID (선택사항, 미입력 시 자동 생성)
              </label>
              <input
                type="text"
                placeholder="예: child-002, mother-001"
                className={styles.input}
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || !name.trim()}
            >
              + 가족 추가
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
