"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { appStore, useAppStore } from "@/store/useStore";
import { ChatView } from "@/components/chat/ChatView";
import {
  getLearningState,
  normalizeCourseProfile,
  NOTE_STYLES,
} from "@/lib/services/learningService";
import type { CourseProfile, LearningState, NotePreferences, StudyBranch } from "@/types/learning";
import { CourseProfileFields } from "./CourseProfileFields";
import SyncPanel from "./SyncPanel";
import InstallSupport from "./InstallSupport";
import { CurriculumTree } from "./CurriculumTree";
import { WorkspaceIcon } from "./WorkspaceIcon";

function Preferences({ learning, branch }: { learning: LearningState; branch: StudyBranch }) {
  const saveLearning = useAppStore((s) => s.saveLearning);
  const sending = useAppStore((s) => s.isSending || s.isPlanning);
  const [notes, setNotes] = useState<NotePreferences>(branch.notes);
  const [profile, setProfile] = useState<CourseProfile>(
    learning.profile ?? { learningGoal: "", priorKnowledge: "" },
  );
  const [notation, setNotation] = useState(learning.notation);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const patch = (patch: Partial<NotePreferences>) => {
    setNotes((n) => ({ ...n, ...patch }));
    setStatus("");
  };
  return (
    <section className="bm-panel-section">
      <div className="bm-eyebrow">讲义格式</div>
      <h3>让讲义按你的方式展开</h3>
      <p>
        设置当前{branch.kind === "main" ? "主线" : branch.kind === "lesson" ? "章节" : "答疑"}
        的默认风格。已生成讲义保留原来的风格。
      </p>
      <label className="bm-label">
        讲义风格
        <select
          aria-label="讲义风格"
          value={notes.style}
          onChange={(e) => patch({ style: e.target.value as NotePreferences["style"] })}
        >
          {Object.entries(NOTE_STYLES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="bm-check">
        <input
          type="checkbox"
          checked={notes.bilingual}
          onChange={(e) => patch({ bilingual: e.target.checked })}
        />
        术语附英文括注
      </label>
      <div className="bm-note-preview">
        {notes.style === "rigorous" ? (
          <>
            定义 1（希尔伯特空间，Hilbert Space）：
            <br />
            <span>在内积诱导的范数下完备的内积空间。</span>
          </>
        ) : notes.style === "intuitive" ? (
          "先解释直觉与例子，再引入正式定义。"
        ) : notes.style === "concise" ? (
          "核心定义 → 关键公式 → 条件与易错点"
        ) : (
          "按照下方的自定义要求组织讲义。"
        )}
      </div>
      <label className="bm-label">
        补充要求
        <textarea
          rows={3}
          maxLength={4000}
          value={notes.customInstructions}
          onChange={(e) => patch({ customInstructions: e.target.value })}
          placeholder="例如：定义编号；证明不跳步；公式后解释每个符号。"
        />
      </label>
      <CourseProfileFields value={profile} onChange={setProfile} disabled={sending || saving} />
      <label className="bm-label">
        课程共享符号约定
        <textarea
          rows={4}
          maxLength={6000}
          value={notation}
          onChange={(e) => {
            setNotation(e.target.value);
            setStatus("");
          }}
          placeholder="例如：ℏ 表示约化普朗克常数；态矢量采用 |ψ⟩；内积对第二个变量线性。"
        />
      </label>
      <button
        className="bm-primary"
        disabled={sending || saving}
        onClick={() =>
          void (async () => {
            setSaving(true);
            try {
              const state = appStore.getState();
              const tree = state.getCurrentTree();
              if (!tree) return;
              const latest = getLearningState(tree, state.nodes);
              await saveLearning({
                ...latest,
                notation,
                ...(profile.learningGoal.trim() || profile.priorKnowledge.trim() || latest.profile
                  ? { profile: normalizeCourseProfile(profile) }
                  : {}),
                branches: latest.branches.map((b) => (b.id === branch.id ? { ...b, notes } : b)),
              });
              setStatus("已保存，将用于后续讲义");
            } catch (e) {
              setStatus(e instanceof Error ? e.message : "保存失败");
            } finally {
              setSaving(false);
            }
          })()
        }
      >
        {saving ? "保存中…" : "保存讲义设置"}
      </button>
      <p role="status" className="bm-status">
        {status}
      </p>
    </section>
  );
}
export default function LearningWorkspace() {
  const initialize = useAppStore((s) => s.initialize);
  const initialized = useAppStore((s) => s.initialized);
  const trees = useAppStore((s) => s.trees);
  const tree = useAppStore((s) => s.getCurrentTree());
  const nodes = useAppStore((s) => s.nodes);
  const activeNodeId = useAppStore((s) => s.activeNodeId);
  const sending = useAppStore((s) => s.isSending || s.isPlanning);
  const loading = useAppStore((s) => s.isLoading);
  const planning = useAppStore((s) => s.isPlanning);
  const createCourse = useAppStore((s) => s.createStudyCourse);
  const loadTree = useAppStore((s) => s.loadTree);
  const selectBranch = useAppStore((s) => s.selectStudyBranch);
  const createQuestion = useAppStore((s) => s.createQuestionBranch);
  const saveLearning = useAppStore((s) => s.saveLearning);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const [navOpen, setNavOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"notes" | "memory" | "sync">("notes");
  const panelRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [newCourse, setNewCourse] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseProfile, setCourseProfile] = useState<CourseProfile>({
    learningGoal: "",
    priorKnowledge: "",
  });
  const [questionSource, setQuestionSource] = useState<string | null>(null);
  const [questionTitle, setQuestionTitle] = useState("");
  const [memorySource, setMemorySource] = useState<string | null>(null);
  const [memoryText, setMemoryText] = useState("");
  const [actionError, setActionError] = useState("");
  const [working, setWorking] = useState(false);
  const learning = useMemo(() => (tree ? getLearningState(tree, nodes) : null), [tree, nodes]);
  const branch = learning?.branches.find((b) => b.id === learning.activeBranchId);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    const question = (event: Event) => {
      const d = (event as CustomEvent<{ nodeId: string }>).detail;
      setQuestionSource(d.nodeId);
      setQuestionTitle("");
      setActionError("");
    };
    const memory = (event: Event) => {
      const d = (event as CustomEvent<{ nodeId: string; content: string }>).detail;
      setMemorySource(d.nodeId);
      setMemoryText(d.content.slice(0, 4000));
      setActionError("");
    };
    const newTopic = () => {
      setCourseTitle("");
      setCourseProfile({ learningGoal: "", priorKnowledge: "" });
      setActionError("");
      setNewCourse(true);
    };
    window.addEventListener("branchmind:new-course", newTopic);
    window.addEventListener("branchmind:question", question);
    window.addEventListener("branchmind:memory", memory);
    return () => {
      window.removeEventListener("branchmind:new-course", newTopic);
      window.removeEventListener("branchmind:question", question);
      window.removeEventListener("branchmind:memory", memory);
    };
  }, []);
  useEffect(() => {
    if (!panelOpen && !navOpen) return;
    const drawer = panelOpen ? panelRef.current : navRef.current;
    const previous = document.activeElement as HTMLElement | null;
    drawer?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        setNavOpen(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
        ) ?? [],
      );
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === drawer)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [panelOpen, navOpen]);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!newCourse && !questionSource && !memorySource) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const elements = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
        ) ?? [],
      );
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [newCourse, questionSource, memorySource]);
  async function action(fn: () => Promise<unknown>) {
    setWorking(true);
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setWorking(false);
    }
  }
  const questions = learning?.branches.filter((b) => b.kind === "question") ?? [];
  const branchNavigation = tree && learning && (
    <div className="bm-nav-section bm-question-list">
      <div className="bm-eyebrow">
        当前课程 <span>{questions.length} 个答疑</span>
      </div>
      <button
        className={`bm-branch ${branch?.kind === "main" ? "is-active" : ""}`}
        disabled={sending}
        onClick={() =>
          void action(async () => {
            await selectBranch("main");
            setNavOpen(false);
          })
        }
      >
        <WorkspaceIcon name="notes" size={17} />
        <span>学习主线</span>
        <i className="bm-branch-dot" />
      </button>
      <CurriculumTree
        learning={learning}
        disabled={sending}
        onSelect={(id) =>
          void action(async () => {
            await selectBranch(id);
            setNavOpen(false);
          })
        }
      />
      {!!questions.length && <div className="bm-question-section-label">独立答疑</div>}
      {questions.map((q) => (
        <button
          className={`bm-branch ${q.id === branch?.id ? "is-active" : ""}`}
          key={q.id}
          disabled={sending}
          onClick={() =>
            void action(async () => {
              await selectBranch(q.id);
              setNavOpen(false);
            })
          }
        >
          <i className="bm-question-dot" />
          <span>
            {q.title}
            <small>
              {learning?.branches.find((b) => b.id === q.parentBranchId)?.kind === "question"
                ? "答疑的追问 · "
                : ""}
              {q.resolved ? "已解决" : "待探索"}
            </small>
          </span>
        </button>
      ))}
      {!questions.length && (
        <p className="bm-nav-hint">
          讲义里遇到问题时，点击「单独答疑」。主线会停在原处，等你回来。
        </p>
      )}
    </div>
  );
  return (
    <div className="bm-app">
      <InstallSupport />
      {(navOpen || panelOpen) && (
        <button
          className="bm-scrim"
          aria-label="关闭侧栏"
          onClick={() => {
            setNavOpen(false);
            setPanelOpen(false);
          }}
        />
      )}
      <aside
        ref={navRef}
        tabIndex={-1}
        inert={panelOpen}
        className={`bm-nav ${navOpen ? "is-open" : ""}`}
        aria-label="学习导航"
      >
        <div className="bm-brand">
          <WorkspaceIcon name="branch" size={30} />
          <div>Branch Mind</div>
        </div>
        <button
          className="bm-nav-close bm-mobile-button"
          aria-label="关闭学习导航"
          onClick={() => setNavOpen(false)}
        >
          <WorkspaceIcon name="close" />
        </button>
        <div className="bm-space-label">学习空间</div>
        <button
          className="bm-new-course"
          disabled={sending || loading}
          onClick={() => {
            setNewCourse(true);
            setCourseTitle("");
            setCourseProfile({ learningGoal: "", priorKnowledge: "" });
            setActionError("");
          }}
        >
          <WorkspaceIcon name="plus" size={18} /> 新建学习主题
        </button>
        <div className="bm-nav-section">
          <div className="bm-eyebrow">
            学习主线 <span>{trees.size}</span>
          </div>
          {Array.from(trees.values()).map((t) => (
            <div key={t.id}>
              <button
                disabled={sending || loading}
                className={`bm-course ${t.id === tree?.id ? "is-active" : ""}`}
                onClick={() =>
                  void action(async () => {
                    await loadTree(t.id);
                    setNavOpen(false);
                  })
                }
              >
                <WorkspaceIcon name="book" />
                <span>{t.title === "New Chat" ? "尚未设置主题" : t.title}</span>
                <WorkspaceIcon name="chevron" size={15} />
              </button>
              {t.id === tree?.id && branchNavigation}
            </div>
          ))}
        </div>
        <div className="bm-nav-bottom">
          <Link href="/settings">
            <WorkspaceIcon name="settings" size={19} /> 设置
          </Link>
          <Link href="/advanced">
            <WorkspaceIcon name="branch" size={19} /> 上下文画布
          </Link>
          <button
            className="bm-theme-button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "切换深色外观" : "切换浅色外观"}
          >
            <WorkspaceIcon name={theme === "light" ? "moon" : "sun"} />
          </button>
        </div>
      </aside>
      <main className="bm-main" inert={panelOpen || navOpen}>
        <header className="bm-header">
          <button
            className="bm-mobile-button"
            aria-label="打开学习导航"
            onClick={() => setNavOpen(true)}
          >
            <WorkspaceIcon name="menu" />
          </button>
          <div className="bm-breadcrumb">
            <h1>
              {branch?.kind !== "main" && branch
                ? branch.title
                : tree?.title === "New Chat"
                  ? "我的学习计划"
                  : (tree?.title ?? "Branch Mind")}
            </h1>
            <span>/</span>
            <span>
              {branch?.kind === "question"
                ? "独立答疑"
                : branch?.kind === "lesson"
                  ? "章节学习"
                  : "学习主线"}
            </span>
          </div>
          <div className="bm-header-tools">
            <button
              aria-label="共享记忆"
              onClick={() => {
                setPanelTab("memory");
                setPanelOpen(true);
              }}
            >
              <WorkspaceIcon name="memory" size={18} />
              <span>共享记忆</span>
              {!!learning?.memories.length && <i>{learning.memories.length}</i>}
            </button>
            <button
              aria-label="笔记规则"
              onClick={() => {
                setPanelTab("notes");
                setPanelOpen(true);
              }}
            >
              <WorkspaceIcon name="notes" size={18} />
              <span>笔记规则</span>
            </button>
            <button
              aria-label="备份与同步"
              onClick={() => {
                setPanelTab("sync");
                setPanelOpen(true);
              }}
            >
              •••
            </button>
          </div>
        </header>
        {branch && learning && (
          <div className="bm-route-bar">
            <WorkspaceIcon name={branch.kind === "question" ? "question" : "branch"} size={26} />
            <span className={`bm-mode ${branch.kind}`}>
              {branch.kind === "main"
                ? "学习主线"
                : branch.kind === "lesson"
                  ? "章节学习"
                  : "独立答疑"}
            </span>
            <span className="bm-route-description">
              {planning
                ? "正在规划并创建章节…"
                : branch.kind === "main"
                  ? "循序渐进，构建完整知识体系"
                  : branch.kind === "lesson"
                    ? "与课程共享符号约定和章节上下文"
                    : "继承来源上下文，单独展开这个问题"}
            </span>
            <div className="bm-route-actions">
              {branch.kind === "question" ? (
                <>
                  <button
                    disabled={sending}
                    onClick={() => void action(() => selectBranch(branch.parentBranchId ?? "main"))}
                  >
                    返回
                    {branch.parentBranchId === "main"
                      ? "主线"
                      : learning.branches.find((b) => b.id === branch.parentBranchId)?.kind ===
                          "lesson"
                        ? "章节"
                        : "上级答疑"}
                  </button>
                  <button
                    disabled={sending}
                    onClick={() =>
                      void action(() =>
                        saveLearning({
                          ...learning,
                          branches: learning.branches.map((b) =>
                            b.id === branch.id ? { ...b, resolved: !b.resolved } : b,
                          ),
                        }),
                      )
                    }
                  >
                    {branch.resolved ? "重新打开" : "标记已解决"}
                  </button>
                </>
              ) : (
                <>
                  {branch.kind === "lesson" && (
                    <button
                      disabled={sending}
                      onClick={() =>
                        void action(() => selectBranch(branch.parentBranchId ?? "main"))
                      }
                    >
                      返回{branch.parentBranchId === "main" ? "主线" : "上级章节"}
                    </button>
                  )}
                  <button
                    disabled={sending || !activeNodeId}
                    onClick={() => {
                      setQuestionSource(activeNodeId);
                      setQuestionTitle("");
                    }}
                  >
                    <WorkspaceIcon name="plus" size={16} /> 单独答疑
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {actionError && (
          <div className="bm-error" role="alert">
            {actionError}
          </div>
        )}
        {!initialized ? <div className="bm-welcome">正在打开你的学习空间…</div> : <ChatView />}
      </main>
      <aside
        ref={panelRef}
        tabIndex={-1}
        aria-hidden={!panelOpen}
        inert={!panelOpen}
        className={`bm-inspector ${panelOpen ? "is-open" : ""}`}
        aria-label="讲义偏好与学习记忆"
      >
        <div className="bm-inspector-header">
          <span>
            {panelTab === "notes" ? "笔记规则" : panelTab === "memory" ? "共享记忆" : "备份与同步"}
          </span>
          <button
            className="bm-mobile-button"
            aria-label="关闭学习工作台"
            onClick={() => setPanelOpen(false)}
          >
            <WorkspaceIcon name="close" />
          </button>
        </div>
        <div className="bm-panel-tabs">
          {(["notes", "memory", "sync"] as const).map((tab) => (
            <button
              key={tab}
              className={panelTab === tab ? "is-active" : ""}
              onClick={() => setPanelTab(tab)}
            >
              {tab === "notes" ? "笔记规则" : tab === "memory" ? "共享记忆" : "同步"}
            </button>
          ))}
        </div>
        {panelTab === "notes" && learning && branch && (
          <Preferences key={`${tree?.id}:${branch.id}`} learning={learning} branch={branch} />
        )}
        {panelTab === "memory" && learning && (
          <section className="bm-panel-section">
            <div className="bm-eyebrow">课程上下文</div>
            <h3>
              课程共享笔记 <span className="bm-count">{learning.memories.length}</span>
            </h3>
            <p>手动确认的结论会在主线与各答疑中共享。完整聊天仍保留在各自分支。</p>
            {learning.memories.map((m) => (
              <article className="bm-memory" key={m.id}>
                <p>{m.content}</p>
                <div className="bm-button-row">
                  <button
                    disabled={sending || !nodes.has(m.sourceNodeId)}
                    onClick={() => {
                      let cursor = nodes.get(m.sourceNodeId);
                      let sourceBranch = learning.branches.find((b) => b.id === "main");
                      const visited = new Set<string>();
                      while (cursor && !visited.has(cursor.id)) {
                        visited.add(cursor.id);
                        const found = learning.branches.find((b) => b.id === cursor!.id);
                        if (found) {
                          sourceBranch = found;
                          break;
                        }
                        cursor = cursor.parentId ? nodes.get(cursor.parentId) : undefined;
                      }
                      void action(async () => {
                        if (sourceBranch) await selectBranch(sourceBranch.id);
                        appStore.getState().setActiveNode(m.sourceNodeId);
                      });
                    }}
                  >
                    查看来源
                  </button>
                  <button
                    disabled={sending}
                    onClick={() =>
                      void action(() =>
                        saveLearning({
                          ...learning,
                          memories: learning.memories.filter((x) => x.id !== m.id),
                        }),
                      )
                    }
                  >
                    移除共享
                  </button>
                </div>
              </article>
            ))}
            {!learning.memories.length && (
              <div className="bm-empty-memory">
                从讲义中「保存共享笔记」，把重要结论留给下一次学习。
              </div>
            )}
          </section>
        )}
        {panelTab === "sync" && <SyncPanel />}
      </aside>
      {newCourse && (
        <div
          className="bm-modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !working) setNewCourse(false);
          }}
        >
          <section
            className="bm-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bm-topic-title"
          >
            <div className="bm-eyebrow">从一个主题开始</div>
            <h2 id="bm-topic-title">你想学习什么？</h2>
            <p>填写学习目标和已有基础，AI 据此安排先修知识、章节顺序与讲解深度。</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!courseTitle.trim() || working || sending) return;
                void action(async () => {
                  await createCourse(courseTitle, courseProfile);
                  setNewCourse(false);
                  setNavOpen(false);
                });
              }}
            >
              <label className="bm-label">
                学习主题
                <input
                  autoFocus
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="例如：量子力学"
                  maxLength={120}
                  disabled={working}
                />
              </label>
              <CourseProfileFields
                value={courseProfile}
                onChange={setCourseProfile}
                required
                disabled={working}
              />
              {actionError && (
                <p role="alert" className="bm-error">
                  {actionError}
                </p>
              )}
              <div className="bm-button-row">
                <button type="button" disabled={working} onClick={() => setNewCourse(false)}>
                  取消
                </button>
                <button
                  className="bm-primary"
                  disabled={
                    working ||
                    sending ||
                    !courseTitle.trim() ||
                    !courseProfile.learningGoal.trim() ||
                    !courseProfile.priorKnowledge.trim()
                  }
                >
                  {working ? "正在自动规划章节…" : "确认主题并创建章节"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {(questionSource || memorySource) && (
        <div
          className="bm-modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !working) {
              setQuestionSource(null);
              setMemorySource(null);
            }
          }}
        >
          <section
            className="bm-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bm-dialog-title"
          >
            <div className="bm-eyebrow">
              {questionSource ? "FOLLOW YOUR QUESTION" : "KEEP WHAT MATTERS"}
            </div>
            <h2 id="bm-dialog-title">
              {questionSource ? "从这里展开一个答疑" : "确认课程共享笔记"}
            </h2>
            <p>
              {questionSource
                ? "保留当前讲义作为上下文。创建后，在独立答疑里提问，随时可返回主线。"
                : "检查并编辑需要记住的内容。确认后，主线和其他答疑都能使用它。"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  if (questionSource) {
                    await createQuestion(questionSource, questionTitle);
                    setQuestionSource(null);
                    setQuestionTitle("");
                  } else if (memorySource) {
                    await appStore.getState().shareStudyMemory(memorySource, memoryText);
                    setMemorySource(null);
                  }
                });
              }}
            >
              <label className="bm-label">
                {questionSource ? "答疑标题" : "笔记内容"}
                {questionSource ? (
                  <input
                    autoFocus
                    required
                    maxLength={120}
                    placeholder="例如：为什么态矢量必须归一化？"
                    value={questionTitle}
                    onChange={(e) => setQuestionTitle(e.target.value)}
                  />
                ) : (
                  <textarea
                    autoFocus
                    required
                    maxLength={4000}
                    rows={8}
                    value={memoryText}
                    onChange={(e) => setMemoryText(e.target.value)}
                  />
                )}
              </label>
              {actionError && (
                <p role="alert" className="bm-error">
                  {actionError}
                </p>
              )}
              <div className="bm-button-row">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => {
                    setQuestionSource(null);
                    setMemorySource(null);
                  }}
                >
                  取消
                </button>
                <button className="bm-primary" disabled={working || sending}>
                  {working ? "保存中…" : questionSource ? "创建独立答疑" : "确认并共享"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
