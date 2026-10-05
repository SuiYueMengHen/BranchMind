import type { StateCreator } from "zustand";
import type { AppStoreDeps, AppStoreState } from "./useStore";
import { getLearningState, hasCourseTopic } from "@/lib/services/learningService";
import { NodeType, type Node } from "@/types";
import { getPrimaryApiKey } from "@/types/provider";
import { getOpenAIApiKey } from "@/lib/services/apiKeyService";
import { getOpenAIBaseUrlOrDefault } from "@/lib/services/apiUrlService";
import { estimateTokens } from "@/lib/services/tokenService";
import {
  lessonPath,
  MAX_LESSON_DEPTH,
  parseCourseOutline,
  planningPrompt,
} from "@/lib/services/curriculumService";
import type { LearningState, NotePreferences } from "@/types/learning";
export interface LearningSlice {
  createStudyCourse: (title: string) => Promise<void>;
  sendStudyQuestion: (content: string) => Promise<void>;
  isPlanning: boolean;
  planningError: string | null;
  generateStudyOutline: (request?: string) => Promise<void>;
  startStudyLesson: () => Promise<void>;
  nextNotePreferences: NotePreferences | null;
  setNextNotePreferences: (notes: NotePreferences | null) => void;
  saveLearning: (learning: LearningState) => Promise<void>;
  selectStudyBranch: (id: string) => Promise<void>;
  createQuestionBranch: (sourceNodeId: string, title: string) => Promise<void>;
  shareStudyMemory: (sourceNodeId: string, content: string) => Promise<void>;
  recordStudyTip: (treeId: string, branchId: string, nodeId: string) => Promise<void>;
}
export function createLearningSlice(
  deps: AppStoreDeps,
): StateCreator<AppStoreState, [], [], LearningSlice> {
  return (set, get) => ({
    createStudyCourse: async (title) => {
      const topic = title.trim();
      if (!topic) throw new Error("请先输入学习主题");
      if (topic.length > 120) throw new Error("学习主题最多 120 个字符");
      if (get().isSending || get().isPlanning || get().isLoading) return;
      const tree = get().getCurrentTree();
      if (tree && !hasCourseTopic(tree) && get().nodes.size === 1) {
        await get().updateTreeTitle(tree.id, topic);
      } else if (
        !(tree?.title === topic && !tree.learning?.branches.some((b) => b.kind === "lesson"))
      ) {
        await get().createTree(topic);
      }
      await get().generateStudyOutline();
    },
    sendStudyQuestion: async (content) => {
      if (!content.trim() || get().isSending || get().isPlanning) return;
      const tree = get().getCurrentTree();
      if (!tree || !hasCourseTopic(tree)) throw new Error("请先创建学习主题，再提出疑问");
      const learning = getLearningState(tree, get().nodes);
      const branch = learning.branches.find((b) => b.id === learning.activeBranchId)!;
      if (branch.kind !== "question") {
        await get().createQuestionBranch(branch.tipNodeId, content.trim().slice(0, 80));
      }
      await get().sendMessage(content);
    },
    isPlanning: false,
    planningError: null,
    generateStudyOutline: async (request = "") => {
      if (get().isSending || get().isPlanning) return;
      const tree = get().getCurrentTree();
      if (!tree) return;
      if (!hasCourseTopic(tree)) throw new Error("请先输入学习主题，再创建章节");
      const learning = getLearningState(tree, get().nodes);
      const parent = learning.branches.find((b) => b.id === learning.activeBranchId)!;
      if (parent.kind === "question") throw new Error("答疑分支不用于创建课程章节");
      if (learning.branches.some((b) => b.kind === "lesson" && b.parentBranchId === parent.id))
        return;
      if (
        parent.kind === "lesson" &&
        (parent.canExpand === false || parent.outlineStatus === "leaf")
      )
        return;
      const path = lessonPath(learning, parent).filter((b) => b.kind === "lesson");
      if (path.length >= MAX_LESSON_DEPTH)
        throw new Error("已经细分到可学习的小节，请点击开始学习");
      set({ isPlanning: true, planningError: null });
      try {
        const selection = get().selectedModels[0];
        const model = selection?.modelId ?? get().model;
        const provider = selection
          ? get().providers.find((p) => p.id === selection.providerId && p.enabled)
          : get().providers.find(
              (p) =>
                p.enabled &&
                p.models.some((m) => m.id === model && m.enabled) &&
                getPrimaryApiKey(p)?.value,
            );
        const apiKey = provider ? getPrimaryApiKey(provider)?.value : getOpenAIApiKey();
        if (!apiKey && get().providers.length) throw new Error("请先在设置中添加模型 API 密钥");
        const content = await deps.llmService.chat({
          model,
          apiKey: apiKey ?? undefined,
          baseUrl: provider?.baseUrl ?? getOpenAIBaseUrlOrDefault(),
          temperature: 0.2,
          maxTokens: 12000,
          responseFormat: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "你是课程设计教师，必须输出符合要求的 JSON。课程符号保持一致。",
            },
            {
              role: "user",
              content: `已有学习对话（作为背景资料）：\n${(
                await deps.nodeService.getPath(parent.tipNodeId)
              )
                .filter((n) => n.type !== NodeType.SYSTEM)
                .slice(-8)
                .map((n) => `${n.type}: ${n.content}`)
                .join("\n")
                .slice(
                  -16000,
                )}\n\n${planningPrompt(learning, parent, tree.title, request)}\n\n用户确认共享笔记：${learning.memories
                .map((m) => m.content)
                .join("\n")
                .slice(0, 8000)}`,
            },
          ],
        });
        const outline = parseCourseOutline(content);
        if (learning.branches.length + outline.children.length > 500)
          throw new Error("课程已有大量章节，请新建课程继续规划");
        if (parent.kind === "main" && outline.children.length === 0)
          throw new Error("课程总规划没有返回章节，请重试");
        if (get().currentTreeId !== tree.id)
          throw new Error("课程已切换，本次规划未保存，请重新创建");
        const now = Date.now();
        const makeNode = (type: NodeType, parentId: string, content: string): Node => ({
          id: crypto.randomUUID(),
          type,
          parentId,
          content,
          createdAt: now,
          updatedAt: now,
          tokenCount: estimateTokens(content),
          metadata: { tags: ["branchmind-curriculum"], metaInstructions: {} },
        });
        const promptNode = makeNode(
          NodeType.USER,
          parent.tipNodeId,
          request ||
            `请为「${parent.kind === "main" ? tree.title : parent.title}」创建下一层学习章节。`,
        );
        const text = `# ${parent.kind === "main" ? "课程学习路线" : parent.title + " · 学习分节"}\n\n${outline.summary}\n\n${outline.children.map((item, i) => `${i + 1}. **${item.title}** — ${item.description}`).join("\n")}\n\n${outline.children.length ? "章节已创建，点击左侧章节继续细分或开始学习。" : "这个主题已经足够具体，可以直接开始学习。"}`;
        const responseNode = makeNode(NodeType.ASSISTANT, promptNode.id, text);
        responseNode.metadata.modelId = model;
        responseNode.metadata.modelName = provider?.name ? `${provider.name} · ${model}` : model;
        const markers = outline.children.map((item) =>
          makeNode(
            NodeType.SYSTEM,
            responseNode.id,
            `课程章节：${item.title}\n学习目标：${item.description}\n继承课程大纲与符号约定，仅围绕此节教学。`,
          ),
        );
        const additions = outline.children.map((item, i) => ({
          id: markers[i]!.id,
          title: item.title,
          kind: "lesson" as const,
          parentBranchId: parent.id,
          sourceNodeId: responseNode.id,
          tipNodeId: markers[i]!.id,
          notes: { ...parent.notes },
          resolved: false,
          description: item.description,
          canExpand: path.length + 1 < MAX_LESSON_DEPTH && item.canExpand,
          outlineStatus: (item.canExpand && path.length + 1 < MAX_LESSON_DEPTH
            ? "unplanned"
            : "leaf") as "unplanned" | "leaf",
        }));
        const latest = getLearningState(get().getCurrentTree()!, get().nodes);
        const next = {
          ...latest,
          notation: latest.notation.trim() ? latest.notation : outline.notation,
          branches: [
            ...latest.branches.map((b) =>
              b.id === parent.id
                ? {
                    ...b,
                    tipNodeId: responseNode.id,
                    outlineStatus: outline.children.length ? ("ready" as const) : ("leaf" as const),
                    canExpand: outline.children.length > 0,
                  }
                : b,
            ),
            ...additions,
          ],
        };
        const created = [promptNode, responseNode, ...markers];
        const updated = await deps.treeService.commitLearningPlan(tree.id, next, created);
        set((state) => ({
          trees: new Map(state.trees).set(tree.id, updated),
          nodes: new Map([...state.nodes, ...created.map((node) => [node.id, node] as const)]),
          activeNodeId: responseNode.id,
        }));
        await get().syncContextToNode(responseNode.id);
      } catch (error) {
        set({ planningError: error instanceof Error ? error.message : "章节创建失败" });
        throw error;
      } finally {
        set({ isPlanning: false });
      }
    },
    startStudyLesson: async () => {
      if (get().isSending || get().isPlanning) return;
      const tree = get().getCurrentTree();
      if (!tree) return;
      const learning = getLearningState(tree, get().nodes);
      const branch = learning.branches.find((b) => b.id === learning.activeBranchId)!;
      if (branch.kind !== "lesson") return;
      if (learning.branches.some((b) => b.kind === "lesson" && b.parentBranchId === branch.id))
        throw new Error("请先选择该章节下的具体小节");
      await get().sendMessage(
        branch.started
          ? `继续讲解「${branch.title}」，沿用已有定义和符号，不重复已讲内容，接着完成本节学习目标。`
          : `开始学习「${branch.title}」。学习目标：${branch.description ?? ""}。按当前讲义风格完整讲解本节，从必要的前置知识开始，遵守课程符号约定并与前面章节一致。`,
      );
      const latest = getLearningState(get().getCurrentTree()!, get().nodes);
      await get().saveLearning({
        ...latest,
        branches: latest.branches.map((b) => (b.id === branch.id ? { ...b, started: true } : b)),
      });
    },
    nextNotePreferences: null,
    setNextNotePreferences: (notes) => set({ nextNotePreferences: notes }),
    saveLearning: async (learning) => {
      const tree = get().getCurrentTree();
      if (!tree) return;
      const updated = await deps.treeService.updateLearning(tree.id, learning);
      set((s) => ({ trees: new Map(s.trees).set(updated.id, updated) }));
    },
    selectStudyBranch: async (id) => {
      if (get().isSending || get().isPlanning) return;
      const tree = get().getCurrentTree();
      if (!tree) return;
      const learning = getLearningState(tree, get().nodes);
      const branch = learning.branches.find((b) => b.id === id);
      if (!branch) return;
      await get().saveLearning({ ...learning, activeBranchId: id });
      set({ activeNodeId: branch.tipNodeId, nextNotePreferences: null, planningError: null });
      await get().syncContextToNode(branch.tipNodeId);
      get().syncToolsToNode(branch.tipNodeId);
    },
    createQuestionBranch: async (sourceNodeId, title) => {
      if (get().isSending || get().isPlanning) return;
      const tree = get().getCurrentTree();
      if (!tree || !get().nodes.has(sourceNodeId)) return;
      const learning = getLearningState(tree, get().nodes);
      const parent = learning.branches.find((b) => b.id === learning.activeBranchId)!;
      const marker = await get().createNode({
        type: NodeType.SYSTEM,
        parentId: sourceNodeId,
        content: `独立答疑：${title.trim() || "新的问题"}。继承来源讲义的上下文，只在此分支解答问题。`,
        metadata: { tags: ["branchmind-question"], metaInstructions: {} },
      });
      const branch = {
        id: marker.id,
        title: title.trim() || "新的问题",
        kind: "question" as const,
        parentBranchId: parent.id,
        sourceNodeId,
        tipNodeId: marker.id,
        notes: { ...parent.notes },
        resolved: false,
      };
      await get().saveLearning({
        ...learning,
        activeBranchId: branch.id,
        branches: [...learning.branches, branch],
      });
      set({ activeNodeId: marker.id, nextNotePreferences: null });
      await get().syncContextToNode(marker.id);
    },
    shareStudyMemory: async (sourceNodeId, content) => {
      const tree = get().getCurrentTree();
      if (!tree || !content.trim()) return;
      const learning = getLearningState(tree, get().nodes);
      await get().saveLearning({
        ...learning,
        memories: [
          ...learning.memories,
          { id: crypto.randomUUID(), content: content.trim(), sourceNodeId, createdAt: Date.now() },
        ],
      });
    },
    recordStudyTip: async (treeId, branchId, nodeId) => {
      const tree = await deps.treeService.read(treeId);
      if (!tree?.learning) return;
      const learning = {
        ...tree.learning,
        branches: tree.learning.branches.map((b) =>
          b.id === branchId
            ? {
                ...b,
                tipNodeId: nodeId,
                ...(b.kind === "lesson" && get().nodes.get(nodeId)?.type === NodeType.ASSISTANT
                  ? { started: true }
                  : {}),
              }
            : b,
        ),
      };
      const updated = await deps.treeService.updateLearning(treeId, learning);
      set((s) => ({ trees: new Map(s.trees).set(updated.id, updated) }));
    },
  });
}
