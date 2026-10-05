"use client";

import LessonOverview from "@/components/learning/LessonOverview";
import { getLearningState, hasCourseTopic, NOTE_STYLES } from "@/lib/services/learningService";
import { useEffect, useMemo } from "react";

import { useT } from "@/lib/i18n/useT";
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
} from "@/lib/services/providerModelService";
import { estimateTokens } from "@/lib/services/tokenService";
import { buildToolInstructionBlocks } from "@/lib/services/tools/toolInstructions";
import { useAppStore } from "@/store/useStore";
import { NodeType, type Node } from "@/types";

import { InputArea } from "./InputArea";
import { MessageList } from "./MessageList";

function buildPath(nodes: Map<string, Node>, activeNodeId: string | null): Node[] {
  if (!activeNodeId) return [];

  const seen = new Set<string>();
  const path: Node[] = [];

  let current = nodes.get(activeNodeId) ?? null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    if (!current.parentId) break;
    current = nodes.get(current.parentId) ?? null;
  }

  return path;
}

function buildConversation(nodes: Map<string, Node>, activeNodeId: string | null): Node[] {
  const path = buildPath(nodes, activeNodeId);
  if (path.length === 0) return [];

  const lastUserIndex = [...path].reverse().findIndex((node) => node.type === NodeType.USER);

  if (lastUserIndex === -1) return path;

  const index = path.length - 1 - lastUserIndex;
  const lastUserNode = path[index];
  const siblings = Array.from(nodes.values())
    .filter((node) => node.parentId === lastUserNode.id && node.type === NodeType.ASSISTANT)
    .sort((a, b) => a.createdAt - b.createdAt);

  if (siblings.length <= 1) return path;

  return [...path.slice(0, index + 1), ...siblings];
}

export function ChatView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const nodes = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const folders = useAppStore((s) => s.folders);

  const isLoading = useAppStore((s) => s.isLoading);
  const isSending = useAppStore((s) => s.isSending || s.isPlanning);
  const error = useAppStore((s) => s.planningError ?? s.llmError ?? s.error);

  const providers = useAppStore((s) => s.providers);
  const model = useAppStore((s) => s.model);
  const temperature = useAppStore((s) => s.temperature);
  const contextBox = useAppStore((s) => s.contextBox);
  const selectedModels = useAppStore((s) => s.selectedModels);
  const setSelectedModels = useAppStore((s) => s.setSelectedModels);
  const toolSettings = useAppStore((s) => s.toolSettings);
  const draftToolUses = useAppStore((s) => s.draftToolUses);
  const setDraftToolUses = useAppStore((s) => s.setDraftToolUses);
  const addFilesToContext = useAppStore((s) => s.addFilesToContext);
  const longTermMemorySettings = useAppStore((s) => s.longTermMemorySettings);

  const sendQuestion = useAppStore((s) => s.sendStudyQuestion);
  const optimizePrompt = useAppStore((s) => s.optimizePrompt);

  const nextNotes = useAppStore((s) => s.nextNotePreferences);
  const setNextNotes = useAppStore((s) => s.setNextNotePreferences);
  const learning = currentTree ? getLearningState(currentTree, nodes) : null;
  const branch = learning?.branches.find((b) => b.id === learning.activeBranchId);

  const messages = useMemo(() => {
    const conversation = buildConversation(nodes, activeNodeId);
    const markerIndex =
      branch && branch.kind !== "main" ? conversation.findIndex((n) => n.id === branch.id) : -1;
    return (markerIndex >= 0 ? conversation.slice(markerIndex + 1) : conversation).filter(
      (n) => n.type !== NodeType.SYSTEM,
    );
  }, [nodes, activeNodeId, branch]);

  const enabledModelOptions = useMemo(() => getEnabledModelOptions(providers), [providers]);

  const folderEnabledOptions = useMemo(() => {
    const folderId = currentTree?.folderId ?? null;
    if (!folderId) return enabledModelOptions;
    const folder = folders.get(folderId) ?? null;
    const enabled = folder?.enabledModels;
    if (enabled == null) return enabledModelOptions;
    const allowedKeys = new Set(enabled.map(buildModelSelectionKey));
    return enabledModelOptions.filter((option) => allowedKeys.has(buildModelSelectionKey(option)));
  }, [currentTree?.folderId, enabledModelOptions, folders]);

  useEffect(() => {
    const folderId = currentTree?.folderId ?? null;
    if (!folderId) return;
    const folder = folders.get(folderId) ?? null;
    const enabled = folder?.enabledModels;
    if (enabled == null) return;

    const allowedKeys = new Set(folderEnabledOptions.map(buildModelSelectionKey));
    const pruned = selectedModels.filter((selection) =>
      allowedKeys.has(buildModelSelectionKey(selection)),
    );
    if (pruned.length === selectedModels.length) return;
    setSelectedModels(pruned);
  }, [currentTree?.folderId, folderEnabledOptions, folders, selectedModels, setSelectedModels]);

  const modelLabel = useMemo(() => {
    if (selectedModels.length === 0) return model.startsWith("deepseek") ? "DeepSeek" : model;
    const optionMap = new Map(
      enabledModelOptions.map((option) => [buildModelSelectionKey(option), option]),
    );
    const labels = selectedModels.map((selection) => {
      const option = optionMap.get(buildModelSelectionKey(selection));
      return option?.modelId ?? selection.modelId;
    });
    return labels.join(", ");
  }, [selectedModels, enabledModelOptions, model]);

  const toolTokens = useMemo(() => {
    const blocks = buildToolInstructionBlocks(draftToolUses, toolSettings);
    return blocks.reduce((sum, block) => sum + estimateTokens(block.content), 0);
  }, [draftToolUses, toolSettings]);

  const tokenLabel =
    contextBox && contextBox.maxTokens
      ? t("chat.contextTokens", {
          used: (contextBox.totalTokens + toolTokens).toLocaleString(locale),
          max: contextBox.maxTokens.toLocaleString(locale),
        })
      : "";

  if (!currentTree) {
    return (
      <div className="text-sand flex min-h-0 flex-1 items-center justify-center p-8">
        {isLoading ? t("common.loading") : t("chat.noConversationLoaded")}
      </div>
    );
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
      <div className="bm-chat-scroll">
        <MessageList
          key={`${currentTree.id}:${branch?.id}`}
          messages={messages}
          isSending={isSending}
          error={error}
          beforeMessages={<LessonOverview key={`${currentTree.id}:${branch?.id}`} />}
        />
        {messages.length === 0 && branch?.kind === "question" && (
          <div className="bm-chat-empty">
            <span className="bm-eyebrow">
              {branch?.kind === "question" ? "一个问题，一条新路径" : "从一张知识地图开始"}
            </span>
            <h2>{branch?.kind === "question" ? branch.title : "今天，想弄懂什么？"}</h2>
            <p>
              {branch?.kind === "question"
                ? "来源讲义已作为上下文保留。在下方提出你的疑问。"
                : "让 AI 先为你列出学习框架，再沿着主线逐步学习。遇到问题，可以单独展开答疑。"}
            </p>
            {branch?.kind !== "question" && (
              <div className="bm-start-examples">
                可以试试：
                <br />
                「请为我规划量子力学的学习路线，先评估需要哪些数学基础。」
              </div>
            )}
            <a href="/settings">配置模型服务 →</a>
          </div>
        )}
      </div>
      <InputArea
        placeholder={
          !hasCourseTopic(currentTree)
            ? "请先创建学习主题"
            : branch?.kind === "question"
              ? "围绕这个问题继续追问…"
              : "有疑问？在这里输入，将单独创建答疑分支…"
        }
        styleControl={
          branch && (
            <div className="bm-composer-style">
              <label>
                <span className="bm-sr-only">本次讲义风格</span>
                <select
                  aria-label="本次讲义风格"
                  disabled={isSending}
                  value={nextNotes?.style ?? "inherit"}
                  onChange={(e) =>
                    setNextNotes(
                      e.target.value === "inherit"
                        ? null
                        : { ...branch.notes, style: e.target.value as typeof branch.notes.style },
                    )
                  }
                >
                  <option value="inherit">
                    {NOTE_STYLES[branch.notes.style]}
                    {branch.notes.bilingual ? " · 中英术语" : ""}
                  </option>
                  {Object.entries(NOTE_STYLES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>

              {nextNotes && (
                <label className="bm-once-bilingual">
                  <input
                    type="checkbox"
                    checked={nextNotes.bilingual}
                    disabled={isSending}
                    onChange={(e) => setNextNotes({ ...nextNotes, bilingual: e.target.checked })}
                  />
                  术语附英文
                </label>
              )}
              {nextNotes?.style === "custom" && (
                <label className="bm-label bm-once-custom">
                  本次讲义的自定义要求
                  <textarea
                    rows={2}
                    maxLength={4000}
                    value={nextNotes.customInstructions}
                    disabled={isSending}
                    onChange={(e) =>
                      setNextNotes({ ...nextNotes, customInstructions: e.target.value })
                    }
                    placeholder="例如：定义（中文术语，English term）；给出严格条件；证明逐步展开。"
                  />
                </label>
              )}
            </div>
          )
        }
        key={`${currentTree.id}:${branch?.id ?? "main"}`}
        draftKey={`branchmind.draft:${currentTree.id}:${branch?.id ?? "main"}`}
        onSend={sendQuestion}
        onOptimizePrompt={async (content, signal) => optimizePrompt(content, { signal })}
        onAttachFiles={async (files) => {
          await addFilesToContext(files);
        }}
        disabled={isLoading || isSending || !hasCourseTopic(currentTree)}
        modelLabel={modelLabel}
        temperatureLabel={temperature.toFixed(1)}
        tokenLabel={tokenLabel}
        modelOptions={folderEnabledOptions}
        selectedModels={selectedModels}
        onSelectedModelsChange={setSelectedModels}
        selectedTools={draftToolUses}
        onSelectedToolsChange={setDraftToolUses}
        toolSettings={toolSettings}
        includeMemoryTool={
          longTermMemorySettings.enabled && longTermMemorySettings.enableMemorySearchTool
        }
      />
    </div>
  );
}
