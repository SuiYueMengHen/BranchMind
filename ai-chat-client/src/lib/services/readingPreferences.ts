export const LECTURE_FONT_KEY = "branchmind.lecture-font-size.v1";
export function clampLectureFont(value: number): number {
  return Number.isFinite(value) ? Math.min(28, Math.max(12, Math.round(value))) : 16;
}
export function getLectureFont(): number {
  try {
    const value =
      typeof localStorage !== "undefined" ? localStorage.getItem(LECTURE_FONT_KEY) : null;
    return value ? clampLectureFont(Number(value)) : 16;
  } catch {
    return 16;
  }
}
export function saveLectureFont(value: number): void {
  try {
    localStorage.setItem(LECTURE_FONT_KEY, String(clampLectureFont(value)));
  } catch {
    /* Storage may be disabled. */
  }
}
