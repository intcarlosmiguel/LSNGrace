/**
 * Grace 5.1 emits CSS font sizes without units (e.g. font-size:612.0000).
 * Firefox ignores those declarations, then scales the inherited UI font down
 * with the native text matrix. Explicit px preserves Grace user units and
 * makes both inline previews and exported SVGs portable. Never rewrite text,
 * coordinates, transforms, or already qualified CSS lengths.
 */
export function normalizeGraceSvg(source: string): string {
  return source.replace(/<[A-Za-z][^>]*>/g, (tag) =>
    tag.replace(/\bstyle=("[^"]*"|'[^']*')/g, (attribute) => {
      const quote = attribute[6];
      const style = attribute
        .slice(7, -1)
        .replace(
          /(^|;)(\s*font-size\s*:\s*)([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(?=\s*(?:;|$))/gi,
          '$1$2$3px',
        );
      return `style=${quote}${style}${quote}`;
    }),
  );
}
