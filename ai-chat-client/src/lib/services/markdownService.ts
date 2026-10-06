/** Presentation/export normalization. Stored model text is retained verbatim. */
export function normalizeLectureMarkdown(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");
  // Models sometimes wrap an entire lecture as a Markdown code sample.
  if (/^\s*```(?:markdown|md)\s*\n/i.test(text)) {
    text = text.replace(/^\s*```(?:markdown|md)\s*\n/i, "").replace(/\n```\s*$/, "");
  }
  let fence: { char: string; length: number } | null = null;
  let mathOpen = false;
  const output: string[] = [];
  for (const line of text.split("\n")) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (marker) {
      if (!fence) fence = { char: marker[1][0], length: marker[1].length };
      else if (marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim())
        fence = null;
      output.push(line);
      continue;
    }
    if (fence) {
      output.push(line);
      continue;
    }
    const segments = line.split(/(`+[^`]*`+)/g);
    output.push(
      segments
        .map((part) => {
          if (part.startsWith("`")) return part;
          let normalized = part.replace(/\\\((.*?)\\\)/g, (_, body: string) => `$${body}$`);
          normalized = normalized.replace(/\\\[|\\\]/g, () => "$$");
          // Put display delimiters on their own lines; remark-math then emits display KaTeX.
          normalized = normalized.replace(/(?<!\\)\$\$/g, () => {
            mathOpen = !mathOpen;
            return "\n$$\n";
          });
          return normalized;
        })
        .join(""),
    );
  }
  // Balance incomplete streaming tails for display; never synthesize omitted lecture content.
  if (mathOpen && !fence) output.push("\n$$");
  if (fence) output.push(fence.char.repeat(fence.length));
  return output.join("\n");
}
