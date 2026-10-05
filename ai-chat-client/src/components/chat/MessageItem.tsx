"use client";

import { WorkspaceIcon } from "@/components/learning/WorkspaceIcon";
import { NOTE_STYLES } from "@/lib/services/learningService";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { NodeType, type Node } from "@/types";
import { useAppStore } from "@/store/useStore";
import { useT } from "@/lib/i18n/useT";
import { stripModelThinkingTags } from "@/lib/services/messageContentService";

import { MarkdownContent } from "./MarkdownContent";

interface MessageItemProps {
  node: Node;
}

function CopyIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M8 8h9a2 2 0 012 2v9a2 2 0 01-2 2H8a2 2 0 01-2-2v-9a2 2 0 012-2z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M6 16H5a2 2 0 01-2-2V5a2 2 0 012-2h9a2 2 0 012 2v1"
      />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3 12a9 9 0 0115.3-6.36M21 12a9 9 0 01-15.3 6.36"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3 4v6h6M21 20v-6h-6"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l5 5L19 7" />
    </svg>
  );
}

function stringifyPreview(value: unknown, limit = 1800): string {
  if (typeof value === "string") return value.length > limit ? `${value.slice(0, limit)}…` : value;
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    return "[unserializable]";
  }
}

export function MessageItem({ node }: MessageItemProps) {
  const t = useT();
  const isSending = useAppStore((s) => s.isSending);
  const meta = (() => {
    const author =
      node.type === NodeType.ASSISTANT
        ? (node.metadata.modelName ?? t("node.author.assistant"))
        : node.type === NodeType.USER
          ? t("node.author.you")
          : node.type === NodeType.SYSTEM
            ? t("node.author.system")
            : t("node.author.compressed");
    const avatar = author.trim() ? author.trim()[0]!.toUpperCase() : "?";

    const role: "human" | "machine" | "system" =
      node.type === NodeType.USER
        ? "human"
        : node.type === NodeType.ASSISTANT
          ? "machine"
          : "system";

    return { role, author, avatar };
  })();
  const time = format(new Date(node.createdAt), "HH:mm");
  const body = node.type === NodeType.COMPRESSED ? (node.summary ?? node.content) : node.content;
  const stripped = node.type === NodeType.ASSISTANT ? stripModelThinkingTags(body) : null;
  const displayBody = stripped ? stripped.visible : body;
  const isAssistant = node.type === NodeType.ASSISTANT;
  const isUser = node.type === NodeType.USER;
  const retryAssistant = useAppStore((s) => s.retryAssistant);
  const mcpServers = useAppStore((s) => s.toolSettings.mcp.servers);
  const [copied, setCopied] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const copyTimeoutRef = useRef<number | null>(null);
  const toolLogs = node.metadata.toolLogs ?? [];

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`bm-message ${isUser ? "bm-user-message" : "bm-assistant-message"} animate-message-in mb-8 max-w-[680px]`}
    >
      <div className="bm-message-heading mb-3 flex items-center gap-3">
        <div
          className={`font-display text-cream flex h-8 w-8 items-center justify-center rounded-full text-[0.9rem] italic ${
            meta.role === "human"
              ? "bg-human"
              : meta.role === "machine"
                ? "bg-machine"
                : "bg-system"
          }`}
        >
          {isAssistant ? <WorkspaceIcon name="branch" size={27} /> : meta.avatar}
        </div>
        <span className="text-ink text-[0.9rem] font-medium">
          {isAssistant ? "Branch Mind" : meta.author}
        </span>
        <span
          className="bm-message-subtitle text-sand text-[0.7rem]"
          title={`${meta.author} · ${time}`}
        >
          {isAssistant && node.metadata.notePreferences
            ? `${NOTE_STYLES[node.metadata.notePreferences.style]}${node.metadata.notePreferences.bilingual ? " · 中英术语" : ""}`
            : time}
        </span>
      </div>

      {isUser && node.metadata.toolUses && node.metadata.toolUses.length > 0 ? (
        <div className="-mt-1 mb-3 flex flex-wrap gap-2 pl-11">
          {node.metadata.toolUses.map((tool) => (
            <span
              key={tool}
              className="border-parchment bg-paper text-sand rounded-full border px-2.5 py-1 font-mono text-[0.65rem]"
              title={t("chat.message.toolUseEnabledTitle")}
            >
              {(() => {
                if (tool === "web_search") return t("chat.input.tool.webSearch");
                if (tool === "python") return t("chat.input.tool.python");
                if (tool === "mcp") return "MCP";
                if (tool.startsWith("mcp:")) {
                  const id = tool.slice("mcp:".length).trim();
                  const server = mcpServers.find((s) => s.id === id) ?? null;
                  return server ? `MCP · ${server.name}` : `MCP · ${id || tool}`;
                }
                return tool;
              })()}
            </span>
          ))}
        </div>
      ) : null}

      <div className="prose-prompt-tree text-charcoal pl-11 text-[0.95rem] leading-relaxed">
        {isAssistant && isSending && !displayBody.trim() ? (
          <span className="text-sand font-mono text-[0.85rem]">{t("chat.thinking")}</span>
        ) : (
          <MarkdownContent content={displayBody} />
        )}
      </div>

      {isAssistant && toolLogs.length > 0 ? (
        <div className="mt-4 pl-11">
          <button
            type="button"
            className="border-parchment bg-paper text-sand hover:border-copper hover:text-ink flex items-center gap-2 rounded-xl border px-4 py-2 text-left font-mono text-[0.7rem] transition-all duration-150"
            onClick={() => setToolsOpen((v) => !v)}
          >
            <span className="text-ink font-semibold">{t("common.tools")}</span>
            <span className="bg-cream text-clay rounded-full px-2 py-0.5 text-[0.65rem]">
              {toolLogs.length}
            </span>
            <span className="text-sand ml-auto text-[0.65rem]">
              {toolsOpen ? t("common.hide") : t("common.show")}
            </span>
          </button>

          {toolsOpen ? (
            <div className="mt-2 space-y-2">
              {toolLogs.map((log) => {
                const duration =
                  typeof log.endedAt === "number"
                    ? `${Math.max(0, log.endedAt - log.startedAt)}ms`
                    : log.status === "running"
                      ? t("chat.tool.status.running")
                      : "";
                const statusLabel =
                  log.status === "success"
                    ? t("chat.tool.status.ok")
                    : log.status === "error"
                      ? t("chat.tool.status.error")
                      : t("chat.tool.status.running");

                return (
                  <div
                    key={log.id}
                    className="border-parchment bg-shoji-white rounded-xl border px-4 py-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-ink font-mono text-[0.75rem]">{log.tool}</div>
                      <div className="text-sand flex items-center gap-2 font-mono text-[0.65rem]">
                        <span className={log.status === "error" ? "text-red-500" : ""}>
                          {statusLabel}
                        </span>
                        {duration ? <span>{duration}</span> : null}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-sand mb-1 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                          {t("chat.tool.args")}
                        </div>
                        <pre className="bg-paper text-ink max-h-[180px] overflow-auto rounded-lg px-3 py-2 font-mono text-[0.7rem]">
                          {stringifyPreview(log.args)}
                        </pre>
                      </div>

                      {log.status === "error" ? (
                        <div>
                          <div className="text-sand mb-1 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                            {t("chat.tool.error")}
                          </div>
                          <pre className="max-h-[180px] overflow-auto rounded-lg bg-red-50 px-3 py-2 font-mono text-[0.7rem] text-red-700">
                            {log.error ?? t("chat.tool.unknownError")}
                          </pre>
                        </div>
                      ) : null}

                      {log.status === "success" ? (
                        <div>
                          <div className="text-sand mb-1 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                            {t("chat.tool.result")}
                          </div>
                          <pre className="bg-paper text-ink max-h-[220px] overflow-auto rounded-lg px-3 py-2 font-mono text-[0.7rem]">
                            {stringifyPreview(log.result)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {isAssistant ? (
        <div className="bm-message-actions mt-3 flex flex-wrap justify-end gap-2 pl-11">
          <button
            type="button"
            disabled={isSending}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("branchmind:question", { detail: { nodeId: node.id } }),
              )
            }
          >
            <WorkspaceIcon name="question" size={16} /> 单独答疑
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("branchmind:memory", {
                  detail: { nodeId: node.id, content: displayBody },
                }),
              )
            }
          >
            <WorkspaceIcon name="notes" size={16} /> 保存共享笔记
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([displayBody], { type: "text/markdown;charset=utf-8" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `Branch-Mind-讲义-${node.id.slice(0, 8)}.md`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            <WorkspaceIcon name="export" size={16} /> 导出讲义
          </button>
          <button
            type="button"
            className="border-parchment text-sand hover:border-copper hover:text-ink flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] transition-all duration-150 disabled:opacity-50"
            onClick={() => {
              void (async () => {
                try {
                  await navigator.clipboard.writeText(displayBody);
                  setCopied(true);
                  if (copyTimeoutRef.current) {
                    window.clearTimeout(copyTimeoutRef.current);
                  }
                  copyTimeoutRef.current = window.setTimeout(() => {
                    setCopied(false);
                  }, 1600);
                } catch {
                  // ignore copy failures
                }
              })();
            }}
            disabled={isSending}
            aria-label={t("chat.message.copyResponseAria")}
          >
            <div className="h-3.5 w-3.5">{copied ? <CheckIcon /> : <CopyIcon />}</div>
            {copied ? t("common.copied") : t("common.copy")}
          </button>
          <button
            type="button"
            className="border-parchment text-sand hover:border-copper hover:text-ink flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.65rem] transition-all duration-150 disabled:opacity-50"
            onClick={() => void retryAssistant(node.id)}
            disabled={isSending}
            aria-label={t("chat.message.retryResponseAria")}
          >
            <div className="h-3.5 w-3.5">
              <RetryIcon />
            </div>
            {t("chat.message.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
