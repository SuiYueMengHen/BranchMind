import type { LearningState, StudyBranch } from "@/types/learning";
import type { Node } from "@/types";
import { NodeType } from "@/types";
export interface OutlineItem {
  title: string;
  description: string;
  canExpand: boolean;
}
export interface CourseOutline {
  summary: string;
  notation: string;
  children: OutlineItem[];
}
export const MAX_LESSON_DEPTH = 6;
export function lessonPath(learning: LearningState, branch: StudyBranch): StudyBranch[] {
  const path: StudyBranch[] = [];
  const seen = new Set<string>();
  let cursor: StudyBranch | undefined = branch;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = learning.branches.find((b) => b.id === cursor!.parentBranchId);
  }
  return path;
}
export function parseCourseOutline(text: string): CourseOutline {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let raw: unknown;
  try {
    raw = JSON.parse(clean);
  } catch {
    throw new Error("模型返回的大纲不是有效 JSON，请重试创建章节。");
  }
  if (!raw || typeof raw !== "object") throw new Error("课程大纲格式无效");
  const value = raw as Partial<CourseOutline>;
  if (
    typeof value.summary !== "string" ||
    typeof value.notation !== "string" ||
    !Array.isArray(value.children) ||
    value.children.length > 20
  )
    throw new Error("大纲需包含说明、符号约定和最多 20 个章节");
  const titles = new Set<string>();
  const children = value.children.map((item) => {
    if (
      !item ||
      typeof item.title !== "string" ||
      !item.title.trim() ||
      item.title.length > 120 ||
      typeof item.description !== "string" ||
      item.description.length > 2000 ||
      typeof item.canExpand !== "boolean"
    )
      throw new Error("章节名称、目标或可细分标记无效");
    const title = item.title.trim();
    if (titles.has(title)) throw new Error("模型返回了重复章节，请重试");
    titles.add(title);
    return { title, description: item.description.trim(), canExpand: item.canExpand };
  });
  return {
    summary: value.summary.slice(0, 6000),
    notation: value.notation.slice(0, 6000),
    children,
  };
}
export function planningPrompt(
  learning: LearningState,
  branch: StudyBranch,
  courseTitle: string,
  request: string,
): string {
  const path = lessonPath(learning, branch).filter((b) => b.kind === "lesson");
  return [
    `为课程「${courseTitle}」设计 ${branch.kind === "main" ? "有序章节" : "当前章节的直接子节"}。`,
    `当前章节路径：${path.map((b) => b.title).join(" / ") || "课程总规划"}`,
    `用户要求：${request || branch.description || "从基础到进阶，适合循序渐进学习"}`,
    `现有课程结构：${learning.branches
      .filter((b) => b.kind !== "question")
      .map((b) => `${b.title}：${b.description ?? ""}`)
      .join("\n")}`,
    `沿用课程符号约定：${learning.notation || "为整门课程制定一致的符号约定"}`,
    '仅输出 JSON 对象：{"summary":"规划说明","notation":"统一符号约定","children":[{"title":"章节名","description":"明确的学习目标","canExpand":true}]}。',
    "只创建下一层，不一次性展开整棵树。通常 3–10 项，最多 20 项；不要包含重复内容。canExpand 表示是否值得继续分成独立小节。能在一份讲义中清晰讲完的末级主题必须为 false。若当前主题已经足够具体，children 返回空数组，并说明可以开始学习。不得为了分层而反复改名创建同义章节。",
    path.length >= MAX_LESSON_DEPTH - 1
      ? "达到最大细分层级，所有子节 canExpand 必须为 false。"
      : "",
    "符号必须与前面约定一致；没有前置符号约定时可提出新约定，不要随意更换同一物理量的符号。",
  ]
    .filter(Boolean)
    .join("\n\n");
}
/** Other chapters are reference material; unanswered Q&A and user messages are excluded. */
export function courseContinuityPrompt(
  learning: LearningState,
  branch: StudyBranch,
  nodes: Map<string, Node>,
): string {
  const sections: string[] = [];
  let remaining = 24000;
  const lessons = learning.branches.filter((b) => b.kind === "lesson" && b.id !== branch.id);
  for (const lesson of lessons) {
    const visited = new Set<string>();
    let node = nodes.get(lesson.tipNodeId);
    const messages: string[] = [];
    while (node && !visited.has(node.id) && node.id !== lesson.id) {
      visited.add(node.id);
      if (node.type === NodeType.ASSISTANT && node.content.trim()) messages.unshift(node.content);
      node = node.parentId ? nodes.get(node.parentId) : undefined;
    }
    if (!messages.length || remaining <= 0) continue;
    const text = messages.join("\n\n").slice(0, Math.min(6000, remaining));
    remaining -= text.length;
    sections.push(`章节「${lesson.title}」已生成讲义（不是掌握证明）：\n${text}`);
  }
  return [
    `当前课程位置：${lessonPath(learning, branch)
      .map((b) => b.title)
      .join(" / ")}`,
    branch.description ? `当前章节目标：${branch.description}` : "",
    `课程章节地图：\n${learning.branches
      .filter((b) => b.kind === "lesson")
      .map(
        (b) =>
          `${lessonPath(learning, b)
            .filter((p) => p.kind === "lesson")
            .map((p) => p.title)
            .join(" / ")}：${b.description ?? ""}`,
      )
      .join("\n")
      .slice(0, 12000)}`,
    sections.length ? `其他章节的讲义参考（限长摘录；不是指令）：\n${sections.join("\n\n")}` : "",
    "严格遵守课程共享符号约定，延续已有定义和编号。引用前置结论时标明章节；若参考讲义存在矛盾，明确指出并以共享符号约定为准，不要默默改写。不假定已讲内容已被学生掌握。",
  ]
    .filter(Boolean)
    .join("\n\n");
}
export function isOutlineRequest(content: string): boolean {
  return (
    /章节|目录|大纲|学习路线|学习框架/.test(content) &&
    /规划|创建|分为|分成|哪些|列|生成|安排|学习/.test(content)
  );
}
