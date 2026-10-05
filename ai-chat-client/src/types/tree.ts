export interface ConversationTree {
  id: string;
  rootId: string;
  title: string;
  folderId?: string | null;
  learning?: import("./learning").LearningState;
  createdAt: number;
  updatedAt: number;
}
