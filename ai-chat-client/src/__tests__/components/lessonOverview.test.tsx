import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonOverview from "@/components/learning/LessonOverview";
import { CurriculumTree } from "@/components/learning/CurriculumTree";
import type { AppStoreState } from "@/store/useStore";
import type { LearningState, StudyBranch } from "@/types/learning";
const mock = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/store/useStore", () => ({
  useAppStore: (selector: (state: AppStoreState) => unknown) =>
    selector(mock.state as unknown as AppStoreState),
}));
const main: StudyBranch = {
  id: "main",
  title: "学习主线",
  kind: "main",
  parentBranchId: null,
  sourceNodeId: "root",
  tipNodeId: "root",
  notes: { style: "rigorous", bilingual: true, customInstructions: "" },
  resolved: false,
};
let learning: LearningState;
beforeEach(() => {
  learning = { activeBranchId: "main", branches: [main], notation: "", memories: [] };
  mock.state = {
    getCurrentTree: () => ({ id: "course", title: "量子力学", rootId: "root", learning }),
    nodes: new Map(),
    isSending: false,
    isPlanning: false,
    generateStudyOutline: vi.fn(),
    startStudyLesson: vi.fn(),
    selectStudyBranch: vi.fn(),
  };
});
it("shows one course-creation action for an unplanned course", () => {
  const html = renderToStaticMarkup(<LessonOverview />);
  expect(html).toContain("创建课程章节");
  expect(html).not.toContain("开始学习</button>");
});
it("shows start only for a leaf, avoiding an unnecessary refinement action", () => {
  learning.branches.push({
    ...main,
    id: "lesson",
    kind: "lesson",
    parentBranchId: "main",
    title: "归一化",
    description: "理解范数",
    canExpand: false,
    outlineStatus: "leaf",
  });
  learning.activeBranchId = "lesson";
  const html = renderToStaticMarkup(<LessonOverview />);
  expect(html).toContain("开始学习");
  expect(html).not.toContain("创建分支");
});
it("shows child selection for a chapter with subtopics and preserves separate Q&A", () => {
  learning.branches.push(
    {
      ...main,
      id: "chapter",
      kind: "lesson",
      parentBranchId: "main",
      title: "量子态",
      description: "",
      canExpand: true,
      outlineStatus: "ready",
    },
    {
      ...main,
      id: "child",
      kind: "lesson",
      parentBranchId: "chapter",
      title: "归一化",
      description: "单位范数",
      canExpand: false,
      outlineStatus: "leaf",
    },
    { ...main, id: "question", kind: "question", parentBranchId: "chapter", title: "只属于答疑" },
  );
  learning.activeBranchId = "chapter";
  const html = renderToStaticMarkup(<LessonOverview />);
  expect(html).toContain("归一化");
  expect(html).not.toContain("开始学习</button>");
  expect(html).not.toContain("只属于答疑");
  const nav = renderToStaticMarkup(
    <CurriculumTree learning={learning} disabled={false} onSelect={() => {}} />,
  );
  expect(nav).toContain("量子态");
  expect(nav).toContain("归一化");
  expect(nav).not.toContain("只属于答疑");
});

it("offers topic entry rather than generation in the initial unnamed workspace", () => {
  mock.state.getCurrentTree = () => ({ id: "empty", title: "New Chat", rootId: "root", learning });
  const html = renderToStaticMarkup(<LessonOverview />);
  expect(html).toContain("你想学习什么？");
  expect(html).toContain("创建学习主题");
  expect(html).not.toContain("创建课程章节");
  expect(html).not.toContain("New Chat");
});
