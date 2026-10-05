"use client";
import type { LearningState, StudyBranch } from "@/types/learning";
import { WorkspaceIcon } from "./WorkspaceIcon";
import { useState } from "react";
export function CurriculumTree({
  learning,
  disabled,
  onSelect,
}: {
  learning: LearningState;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function render(parent: string, depth: number): React.ReactNode {
    return learning.branches
      .filter((b) => b.kind === "lesson" && b.parentBranchId === parent)
      .map((b: StudyBranch, index) => {
        const children = learning.branches.some(
          (child) => child.kind === "lesson" && child.parentBranchId === b.id,
        );
        return (
          <div className="bm-lesson-tree-node" key={b.id}>
            <div
              className={`bm-lesson-tree-row ${learning.activeBranchId === b.id ? "is-active" : ""}`}
            >
              {children ? (
                <button
                  className="bm-tree-collapse"
                  aria-label={`${collapsed.has(b.id) ? "展开" : "收起"} ${b.title}`}
                  aria-expanded={!collapsed.has(b.id)}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(b.id)) next.delete(b.id);
                      else next.add(b.id);
                      return next;
                    })
                  }
                >
                  <WorkspaceIcon
                    name="chevron"
                    size={13}
                    style={{ transform: collapsed.has(b.id) ? undefined : "rotate(90deg)" }}
                  />
                </button>
              ) : (
                <i className="bm-tree-leaf" />
              )}
              <button
                className="bm-lesson-select"
                disabled={disabled}
                onClick={() => onSelect(b.id)}
                title={b.description}
              >
                <span className="bm-lesson-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{b.title}</span>
                {b.started && <i className="bm-lesson-started" title="已有讲义" />}
              </button>
            </div>
            {children && !collapsed.has(b.id) && depth < 6 && (
              <div className="bm-lesson-tree-children">{render(b.id, depth + 1)}</div>
            )}
          </div>
        );
      });
  }
  return (
    <div className="bm-curriculum-tree" aria-label="课程章节">
      {render("main", 0)}
    </div>
  );
}
