/** Minimal markdown renderer for legal documents (headings, lists, bold, paragraphs). */
export function Prose({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j} dangerouslySetInnerHTML={{ __html: inline(l.slice(2)) }} />
              ))}
            </ul>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h2 key={i} className="pt-2 font-display text-xl font-bold text-foreground">
              {block.slice(2)}
            </h2>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h3 key={i} className="pt-2 font-display text-lg font-semibold text-foreground">
              {block.slice(3)}
            </h3>
          );
        }
        if (block.startsWith("> ")) {
          return (
            <blockquote key={i} className="rounded-xl border-l-2 border-warning bg-warning/5 p-3 text-xs text-warning">
              {block.replace(/^> ?/gm, "")}
            </blockquote>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(block) }} />;
      })}
    </div>
  );
}

function inline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong class='text-foreground'>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
