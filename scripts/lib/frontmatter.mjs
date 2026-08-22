/**
 * 記事Markdownの frontmatter を書き出す／読み取る最小限の実装。
 * 書き出す側もこのファイルなので、扱う型は自分で発行したものに限られる。
 */

const quote = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export const toDateString = (date) => new Date(date).toISOString().slice(0, 10);

export function serializeFrontmatter(data) {
  const lines = ['---'];

  lines.push(`title: ${quote(data.title)}`);
  lines.push(`description: ${quote(data.description)}`);
  lines.push(`pubDate: ${toDateString(data.pubDate)}`);
  if (data.updatedDate) lines.push(`updatedDate: ${toDateString(data.updatedDate)}`);
  lines.push(`category: ${data.category}`);

  if (data.tags?.length) {
    lines.push(`tags: [${data.tags.map(quote).join(', ')}]`);
  } else {
    lines.push('tags: []');
  }

  lines.push(`author: ${data.author ?? 'agent'}`);

  if (data.sources?.length) {
    lines.push('sources:');
    for (const source of data.sources) {
      lines.push(`  - title: ${quote(source.title)}`);
      lines.push(`    url: ${quote(source.url)}`);
      if (source.publisher) lines.push(`    publisher: ${quote(source.publisher)}`);
    }
  } else {
    lines.push('sources: []');
  }

  if (data.draft) lines.push('draft: true');

  lines.push('---', '');
  return lines.join('\n');
}

const unquote = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
};

/**
 * 記事の frontmatter を読み戻す。
 * 扱う形式は serializeFrontmatter が書くもの、および
 * docs/agent/weekly-research.md でエージェントに指示している形式に限る。
 * 汎用のYAMLパーサではない。
 */
export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, body: raw, hasFrontmatter: false };

  const data = {};
  const lines = match[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '' || /^\s/.test(line)) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const rest = line.slice(separator + 1).trim();

    // sources: の直後に続くインデント行をまとめて読む
    if (key === 'sources' && rest === '') {
      const { items, nextIndex } = parseObjectList(lines, i + 1);
      data.sources = items;
      i = nextIndex - 1;
      continue;
    }

    if (rest === '') continue;

    if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      data[key] = inner === '' ? [] : inner.split(',').map(unquote);
    } else if (rest === 'true' || rest === 'false') {
      data[key] = rest === 'true';
    } else {
      data[key] = unquote(rest);
    }
  }

  return { data, body: match[2], hasFrontmatter: true };
}

/** `  - key: value` 形式のオブジェクト配列を読む */
function parseObjectList(lines, start) {
  const items = [];
  let current = null;
  let index = start;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (!/^\s/.test(line)) break;

    const entry = /^\s*-\s*([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(line);
    if (entry) {
      current = { [entry[1]]: unquote(entry[2]) };
      items.push(current);
      continue;
    }

    const field = /^\s+([A-Za-z_][\w]*)\s*:\s*(.*)$/.exec(line);
    if (field && current) current[field[1]] = unquote(field[2]);
  }

  return { items, nextIndex: index };
}
