"use client";

import { useState } from "react";
import styles from "./PasswordModal.module.css";

interface Props {
  docId: string;
  fileName: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PasswordModal({
  docId,
  fileName,
  onSuccess,
  onClose,
}: Props) {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/documents/${docId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (res.status === 401) {
        setError("PDF 비밀번호가 올바르지 않습니다.");
        setPassword("");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "처리 실패");
      }

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "비밀번호 처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
      // 비밀번호를 메모리에서 즉시 제거
      setPassword("");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.icon}>🔒</div>
          <h3 className={styles.title}>PDF 비밀번호 입력</h3>
        </div>

        <p className={styles.description}>
          <strong>{fileName}</strong>
          <br />이 PDF는 비밀번호가 필요합니다.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PDF 비밀번호를 입력하세요"
            autoFocus
            disabled={isSubmitting}
            autoComplete="off"
          />

          {error && <div className={styles.error}>⚠️ {error}</div>}

          <div className={styles.hint}>
            비밀번호는 문서 처리에만 사용되며 저장되지 않습니다.
          </div>

          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting || !password.trim()}
            >
              {isSubmitting ? "처리 중..." : "확인"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
