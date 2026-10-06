import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { normalizeLectureMarkdown } from "@/lib/services/markdownService";
it("renders bracket formulas and inline double dollars as display math", () => {
  const html = renderToStaticMarkup(
    <MarkdownContent
      content={String.raw`正文 \(x\)\n\[x^2=1\]\n$$y=2$$`.replaceAll("\\n", "\n")}
    />,
  );
  expect(html.match(/class="katex-display"/g)).toHaveLength(2);
  expect(html).not.toContain('class="katex-error"');
});
it("unwraps incomplete lecture fences and balances a streaming math tail", () => {
  const source = "```markdown\n**定义**：\n\n$$\nx^2=1";
  const result = normalizeLectureMarkdown(source);
  expect(result).not.toContain("```markdown");
  expect(result.trim()).toMatch(/\$\$$/);
  const html = renderToStaticMarkup(<MarkdownContent content={source} />);
  expect(html).toContain("<strong>定义</strong>");
  expect(html).toContain('class="katex-display"');
});
it("preserves delimiters inside code samples", () => {
  const code = '```python\nprint("$$ and \\[literal\\]")\n```';
  expect(normalizeLectureMarkdown(code)).toBe(code);
  expect(normalizeLectureMarkdown("`\\[literal\\]`")).toBe("`\\[literal\\]`");
});
