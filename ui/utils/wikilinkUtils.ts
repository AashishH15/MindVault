/**
 * Preprocesses piped [[Node Title|node_id]] format and standard [[Node Title]] format
 * into their corresponding markdown link representations.
 */
export function preprocessWikiLinks(text: string): string {
  if (!text) return "";
  // 1. Process piped [[Title|id]] format -> [Title](#node/id)
  let processed = text.replace(/\[\[([^|\]\n]+)\|([^\]\n]+)\]\]/g, "[$1](#node/$2)");
  // 2. Process standard [[Title]] format -> [Title](#node/search:Title)
  // Encode the search title so markdown parsers keep the href intact.
  processed = processed.replace(/\[\[([^|\]\n]+)\]\]/g, (_, title: string) => {
    return `[${title}](#node/search:${encodeURIComponent(title)})`;
  });
  return processed;
}
