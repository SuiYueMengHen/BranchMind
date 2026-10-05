import MainLayout from "@/components/layout/MainLayout";
import Link from "next/link";
export default function Advanced() {
  return (
    <>
      <Link href="/" className="bm-back-learning">
        ← 返回学习空间
      </Link>
      <MainLayout />
    </>
  );
}
