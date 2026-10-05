"use client";
import { useAppStore } from "@/store/useStore";
import { getLearningState, hasCourseTopic } from "@/lib/services/learningService";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { useState } from "react";
export default function LessonOverview() {
  const tree = useAppStore((s) => s.getCurrentTree());
  const nodes = useAppStore((s) => s.nodes);
  const sending = useAppStore((s) => s.isSending);
  const planning = useAppStore((s) => s.isPlanning);
  const generate = useAppStore((s) => s.generateStudyOutline);
  const start = useAppStore((s) => s.startStudyLesson);
  const select = useAppStore((s) => s.selectStudyBranch);
  const [error, setError] = useState("");
  if (!tree) return null;
  const learning = getLearningState(tree, nodes);
  const branch = learning.branches.find((b) => b.id === learning.activeBranchId)!;
  if (branch.kind === "question") return null;
  const children = learning.branches.filter(
    (b) => b.kind === "lesson" && b.parentBranchId === branch.id,
  );
  const hasTopic = hasCourseTopic(tree);
  const disabled = sending || planning;
  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  }
  return (
    <section className="bm-lesson-overview" aria-label="章节学习操作">
      <div className="bm-lesson-overview-heading">
        <div>
          <span className="bm-eyebrow">{branch.kind === "main" ? "课程地图" : "当前章节"}</span>
          <h2>
            {branch.kind === "main" ? (hasTopic ? tree.title : "你想学习什么？") : branch.title}
          </h2>
        </div>
        <span className="bm-lesson-state">
          {planning
            ? "正在创建章节…"
            : children.length
              ? `${children.length} 个章节`
              : branch.started
                ? "讲义已开始"
                : branch.kind === "main"
                  ? hasTopic
                    ? "规划学习路径"
                    : "先确定学习主题"
                  : branch.canExpand === false
                    ? "可以开始学习"
                    : "可继续细分"}
        </span>
      </div>
      <p>
        {branch.kind === "main"
          ? hasTopic
            ? "章节按课程主题自动规划。选择章节后，可继续细分或开始学习。下方输入框用于单独答疑。"
            : "先输入一个学习主题，例如量子力学。确认后，AI 会自动规划章节，无需另写提示。"
          : branch.description || "围绕本节主题逐步学习。"}
      </p>
      {children.length > 0 ? (
        <div className="bm-lesson-cards">
          {children.map((child, index) => (
            <button
              key={child.id}
              disabled={disabled}
              onClick={() => void run(() => select(child.id))}
            >
              <span className="bm-lesson-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{child.title}</strong>
                <small>{child.description}</small>
              </div>
              <WorkspaceIcon name="chevron" size={17} />
            </button>
          ))}
        </div>
      ) : (
        <div className="bm-lesson-overview-actions">
          {(branch.kind === "main" ||
            (branch.canExpand !== false && branch.outlineStatus !== "leaf")) && (
            <button
              className="bm-primary"
              disabled={disabled}
              onClick={() => {
                if (!hasTopic) window.dispatchEvent(new Event("branchmind:new-course"));
                else void run(() => generate());
              }}
            >
              <WorkspaceIcon name="branch" size={17} />
              {planning
                ? "创建中…"
                : branch.kind === "main"
                  ? hasTopic
                    ? "自动创建课程章节"
                    : "创建学习主题"
                  : "创建分支"}
            </button>
          )}
          {branch.kind === "lesson" && (
            <button
              className={
                branch.canExpand === false || branch.outlineStatus === "leaf"
                  ? "bm-primary"
                  : "bm-secondary"
              }
              disabled={disabled}
              onClick={() => void run(start)}
            >
              <WorkspaceIcon name="book" size={17} />
              {branch.started ? "继续讲解" : "开始学习"}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="bm-overview-error">
          {error}
        </p>
      )}
    </section>
  );
}
