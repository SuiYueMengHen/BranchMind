import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CourseProfileFields } from "@/components/learning/CourseProfileFields";
import { buildLearningPrompt } from "@/lib/services/learningService";
import type { LearningState, StudyBranch } from "@/types/learning";
it("collects both required course inputs with concrete placeholders", () => {
  const html = renderToStaticMarkup(
    <CourseProfileFields
      value={{ learningGoal: "", priorKnowledge: "" }}
      onChange={() => {}}
      required
    />,
  );
  expect(html).toContain("我需要学什么");
  expect(html).toContain("我现在掌握什么");
  expect(html.match(/required=""/g)).toHaveLength(2);
  expect(html).toContain("零基础");
});
it("uses formal numbered entries without forcing all sections or copying quantum-specific content", () => {
  const branch: StudyBranch = {
    id: "l",
    kind: "lesson",
    title: "测量",
    parentBranchId: "main",
    sourceNodeId: "r",
    tipNodeId: "r",
    notes: { style: "rigorous", bilingual: true, customInstructions: "" },
    resolved: false,
  };
  const learning: LearningState = {
    branches: [branch],
    activeBranchId: "l",
    notation: "ℏ",
    memories: [],
  };
  const prompt = buildLearningPrompt(learning, branch);
  expect(prompt).toContain("定义 1（中文术语，English Term）");
  expect(prompt).toContain("禁止寒暄");
  expect(prompt).toContain("先声明对象、假设、适用范围");
  expect(prompt).toContain("不为每一节机械凑齐");
  expect(prompt).not.toContain("核心定义使用 Markdown 引用块");
  expect(prompt).not.toContain("波函数坍缩");
});
