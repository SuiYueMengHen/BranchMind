/** Only quote a selection wholly inside one lecture, never another message or the composer. */
export function readArticleSelection(selection: Selection | null, article: HTMLElement): string {
  if (
    !selection ||
    selection.isCollapsed ||
    !selection.rangeCount ||
    !selection.anchorNode ||
    !selection.focusNode ||
    !article.contains(selection.anchorNode) ||
    !article.contains(selection.focusNode)
  )
    return "";
  return selection.toString().trim().slice(0, 12000);
}
