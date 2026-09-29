"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./DocumentUpload.module.css";
import type { FamilyMember } from "@/app/lib/types";

interface UploadedDoc {
  id: string;
  fileName: string;
  familyMemberId?: string;
  status: string;
  error?: string;
}

interface Props {
  currentFamilyMemberId?: string;
  familyMembers?: FamilyMember[];
  onUploadComplete?: () => void;
  onPasswordNeeded?: (docId: string, fileName: string) => void;
}

export default function DocumentUpload({
  currentFamilyMemberId,
  familyMembers: initialFamilyMembers,
  onUploadComplete,
  onPasswordNeeded,
}: Props) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(
    initialFamilyMembers || []
  );
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(
    currentFamilyMemberId || "user-001"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 가족 목록 로드 (props가 없거나 비어있는 경우)
  useEffect(() => {
    if (initialFamilyMembers && initialFamilyMembers.length > 0) {
      setFamilyMembers(initialFamilyMembers);
    } else {
      fetch("/api/family")
        .then((res) => res.json())
        .then((data) => {
          if (data.members) setFamilyMembers(data.members);
        })
        .catch(() => {});
    }
  }, [initialFamilyMembers]);

  // 외부 선택 변경 동기화
  useEffect(() => {
    if (currentFamilyMemberId) {
      setSelectedFamilyId(currentFamilyMemberId);
    }
  }, [currentFamilyMemberId]);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsUploading(true);

      const formData = new FormData();
      for (const file of fileArray) {
        formData.append("files", file);
      }
      // 요구사항 9: 대상 가족 ID 전송
      formData.append("familyMemberId", selectedFamilyId);

      try {
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const docs: UploadedDoc[] = data.documents || [];
        setUploadedDocs((prev) => [...prev, ...docs]);

        // 업로드 성공한 문서들을 자동 분석
        const pendingDocs = docs.filter((d) => d.status === "pending" && d.id);
        for (const doc of pendingDocs) {
          analyzeDocument(doc.id, doc.fileName);
        }
      } catch (err) {
        console.error(
          "Upload failed:",
          err instanceof Error ? err.message : "unknown"
        );
      } finally {
        setIsUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onUploadComplete, onPasswordNeeded, selectedFamilyId]
  );

  const analyzeDocument = async (docId: string, fileName: string) => {
    setAnalyzingIds((prev) => new Set(prev).add(docId));
    updateDocStatus(docId, "analyzing");

    try {
      const res = await fetch(`/api/documents/${docId}/analyze`, {
        method: "POST",
      });

      const data = await res.json();

      if (data.needsPassword) {
        updateDocStatus(docId, "password_required");
        onPasswordNeeded?.(docId, fileName);
      } else if (data.document?.status === "completed") {
        updateDocStatus(docId, "completed");
        onUploadComplete?.();
      } else if (data.document?.status === "error") {
        updateDocStatus(docId, "error", data.document.errorMessage);
      } else {
        updateDocStatus(docId, data.document?.status || "error");
      }
    } catch {
      updateDocStatus(docId, "error", "분석 중 오류가 발생했습니다.");
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  };

  const updateDocStatus = (
    docId: string,
    status: string,
    error?: string
  ) => {
    setUploadedDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status, error } : d))
    );
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return { text: "대기", className: styles.statusPending };
      case "analyzing":
        return { text: "분석 중", className: styles.statusAnalyzing };
      case "completed":
        return { text: "완료", className: styles.statusCompleted };
      case "password_required":
        return { text: "비밀번호 필요", className: styles.statusPassword };
      case "error":
        return { text: "오류", className: styles.statusError };
      default:
        return { text: status, className: "" };
    }
  };

  return (
    <div className={styles.container}>
      {/* 요구사항 9: 문서 업로드 전 대상 가족 선택 */}
      <div className={styles.familySelectorBar}>
        <label htmlFor="upload-family-select" className={styles.familyLabel}>
          <span>👤</span> 대상 가족:
        </label>
        <select
          id="upload-family-select"
          className={styles.familySelect}
          value={selectedFamilyId}
          onChange={(e) => setSelectedFamilyId(e.target.value)}
          disabled={isUploading}
        >
          {familyMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.relationship})
            </option>
          ))}
        </select>
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          className={styles.fileInput}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className={styles.dropzoneIcon}>
          {isUploading ? "⏳" : "📄"}
        </div>
        <div className={styles.dropzoneTitle}>
          {isUploading
            ? "업로드 중..."
            : "보험 문서를 끌어다 놓거나 클릭하세요"}
        </div>
        <div className={styles.dropzoneDesc}>
          PDF, JPG, JPEG, PNG (최대 50MB)
          <br />
          {familyMembers.find((m) => m.id === selectedFamilyId)?.name || "선택된 가족"}님의 보험증권, 약관, 가입내역을 업로드합니다
        </div>
      </div>

      {/* 업로드된 문서 목록 */}
      {uploadedDocs.length > 0 && (
        <div className={styles.docList}>
          <h3 className={styles.docListTitle}>
            업로드된 문서 ({uploadedDocs.length})
          </h3>
          {uploadedDocs.map((doc) => {
            const { text, className } = statusLabel(doc.status);
            const member = familyMembers.find((m) => m.id === doc.familyMemberId);
            return (
              <div key={doc.id || doc.fileName} className={styles.docItem}>
                <div className={styles.docInfo}>
                  <span className={styles.docIcon}>
                    {doc.fileName.endsWith(".pdf") ? "📋" : "🖼️"}
                  </span>
                  <span className={styles.docName}>{doc.fileName}</span>
                  {member && (
                    <span className={styles.memberTag}>👤 {member.name}</span>
                  )}
                </div>
                <div className={styles.docMeta}>
                  <span className={`${styles.statusBadge} ${className}`}>
                    {analyzingIds.has(doc.id) && (
                      <span className={styles.spinner} />
                    )}
                    {text}
                  </span>
                </div>
                {doc.error && (
                  <div className={styles.docError}>{doc.error}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
