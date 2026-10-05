export type NoteStyle = "rigorous" | "intuitive" | "concise" | "custom";
export interface NotePreferences {
  style: NoteStyle;
  bilingual: boolean;
  customInstructions: string;
}
export interface StudyBranch {
  id: string;
  title: string;
  kind: "main" | "question" | "lesson";
  parentBranchId: string | null;
  sourceNodeId: string;
  tipNodeId: string;
  notes: NotePreferences;
  resolved: boolean;
  description?: string;
  canExpand?: boolean;
  outlineStatus?: "unplanned" | "ready" | "leaf";
  started?: boolean;
}
export interface StudyMemory {
  id: string;
  content: string;
  sourceNodeId: string;
  createdAt: number;
}
export interface LearningState {
  activeBranchId: string;
  branches: StudyBranch[];
  notation: string;
  memories: StudyMemory[];
}
