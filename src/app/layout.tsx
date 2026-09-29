import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "보험 AI 어시스턴트 | 내 보험 똑똑하게 관리하기",
  description:
    "보험증권, 약관을 업로드하면 AI가 분석하여 보장 내용을 찾아드립니다. 개인용 보험 관리 챗봇.",
  keywords: ["보험", "AI", "챗봇", "보험 관리", "보장 분석"],
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
