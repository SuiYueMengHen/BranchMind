import { afterEach, expect, it, vi } from "vitest";
import { readArticleSelection } from "@/lib/services/articleSelection";
import { createAppStore } from "@/store/useStore";
import { LECTURE_FONT_KEY } from "@/lib/services/readingPreferences";
afterEach(() => vi.unstubAllGlobals());
it("restores custom font size and clamps invalid values", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  const store = createAppStore();
  store.getState().setLectureFontSize(22);
  expect(values.get(LECTURE_FONT_KEY)).toBe("22");
  const restored = createAppStore();
  restored.getState().hydrateUiFromStorage();
  expect(restored.getState().lectureFontSize).toBe(22);
  restored.getState().setLectureFontSize(100);
  expect(restored.getState().lectureFontSize).toBe(28);
});
it("captures text only when both ends of the selection belong to the source article", () => {
  const anchor = {} as Node,
    focus = {} as Node,
    outside = {} as Node;
  const article = { contains: (node: unknown) => node === anchor || node === focus } as HTMLElement;
  const selection = {
    isCollapsed: false,
    rangeCount: 1,
    anchorNode: anchor,
    focusNode: focus,
    toString: () => "  待解释的原文  ",
  } as Selection;
  expect(readArticleSelection(selection, article)).toBe("待解释的原文");
  expect(readArticleSelection({ ...selection, focusNode: outside } as Selection, article)).toBe("");
  expect(readArticleSelection({ ...selection, isCollapsed: true } as Selection, article)).toBe("");
});
