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
  const children = new Map<string, StudyBranch[]>();
  for (const branch of learning.branches) {
    if (branch.kind !== "lesson" || !branch.parentBranchId) continue;
    const siblings = children.get(branch.parentBranchId) ?? [];
    siblings.push(branch);
    children.set(branch.parentBranchId, siblings);
  }
  // Iterative traversal has no fixed depth and avoids recursive component stacks.
  const rows: { branch: StudyBranch; depth: number; index: number }[] = [];
  const pending = (children.get("main") ?? [])
    .map((branch, index) => ({ branch, depth: 0, index }))
    .reverse();
  const seen = new Set<string>();
  while (pending.length) {
    const row = pending.pop()!;
    if (seen.has(row.branch.id)) continue;
    seen.add(row.branch.id);
    rows.push(row);
    if (!collapsed.has(row.branch.id)) {
      const next = (children.get(row.branch.id) ?? []).map((branch, index) => ({
        branch,
        depth: row.depth + 1,
        index,
      }));
      pending.push(...next.reverse());
    }
  }
  return (
    <div className="bm-curriculum-tree" aria-label="课程章节">
      {rows.map(({ branch: b, depth, index }) => (
        <div
          className="bm-lesson-tree-node"
          key={b.id}
          style={{ paddingLeft: Math.min(depth, 5) * 12 }}
          data-depth={depth + 1}
        >
          <div
            className={`bm-lesson-tree-row ${learning.activeBranchId === b.id ? "is-active" : ""}`}
          >
            {children.has(b.id) ? (
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
              title={`第 ${depth + 1} 层 · ${b.description ?? b.title}`}
            >
              <span className="bm-lesson-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{b.title}</span>
              {b.started && <i className="bm-lesson-started" title="已有讲义" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
