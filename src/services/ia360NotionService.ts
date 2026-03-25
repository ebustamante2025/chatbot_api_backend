/**
 * Herramientas Notion para IA360 (misma idea que chatbot_Agente/notion_tools.py).
 */
import { Client, APIResponseError } from '@notionhq/client';

const MAX_RETRIES = 3;

/** Menos caracteres por herramienta = menos tokens y vueltas más rápidas (env: IA360_MAX_TOOL_RESULT_CHARS). */
function getMaxToolResultChars(): number {
  const raw = process.env.IA360_MAX_TOOL_RESULT_CHARS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2000 && n <= 50_000) return n;
  }
  return 9000;
}

function getNotion(): Client | null {
  const key = process.env.NOTION_API_KEY?.trim();
  if (!key) return null;
  return new Client({ auth: key });
}

function truncateText(text: string, maxChars?: number): string {
  const cap = maxChars ?? getMaxToolResultChars();
  if (text.length <= cap) return text;
  return `${text.slice(0, cap - 50)}\n\n... [contenido truncado por longitud]`;
}

function richTextToString(rich: Array<{ plain_text?: string }> | undefined): string {
  if (!rich?.length) return '';
  return rich.map((r) => r.plain_text ?? '').join('');
}

function formatPropertyValue(prop: Record<string, unknown>): string {
  const ptype = String(prop.type ?? '');
  if (ptype === 'title') return richTextToString(prop.title as Array<{ plain_text?: string }>);
  if (ptype === 'rich_text') return richTextToString(prop.rich_text as Array<{ plain_text?: string }>);
  if (ptype === 'number') {
    const n = prop.number;
    return n != null ? String(n) : '';
  }
  if (ptype === 'select') {
    const s = prop.select as { name?: string } | null;
    return s?.name ?? '';
  }
  if (ptype === 'multi_select') {
    const arr = (prop.multi_select as Array<{ name?: string }>) ?? [];
    return arr.map((o) => o.name ?? '').filter(Boolean).join(', ');
  }
  if (ptype === 'status') {
    const s = prop.status as { name?: string } | null;
    return s?.name ?? '';
  }
  if (ptype === 'date') {
    const d = prop.date as { start?: string; end?: string } | null;
    if (!d) return '';
    return d.end ? `${d.start ?? ''} → ${d.end}` : (d.start ?? '');
  }
  if (ptype === 'checkbox') return prop.checkbox ? 'Si' : 'No';
  if (ptype === 'url') return String(prop.url ?? '');
  if (ptype === 'email') return String(prop.email ?? '');
  if (ptype === 'phone_number') return String(prop.phone_number ?? '');
  if (ptype === 'created_time') return String(prop.created_time ?? '');
  if (ptype === 'last_edited_time') return String(prop.last_edited_time ?? '');
  return '';
}

function parsePageProperties(properties: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [name, prop] of Object.entries(properties)) {
    const value = formatPropertyValue(prop as Record<string, unknown>);
    if (value) lines.push(`**${name}**: ${value}`);
  }
  return lines.length ? lines.join('\n') : '(sin propiedades)';
}

function parseBlocksToText(blocks: Array<Record<string, unknown>>): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const btype = String(block.type ?? '');
    const data = (block[btype] as Record<string, unknown>) ?? {};

    if (btype === 'paragraph') {
      lines.push(richTextToString(data.rich_text as Array<{ plain_text?: string }>));
    } else if (btype.startsWith('heading_')) {
      const level = Number(btype.slice(-1)) || 1;
      const prefix = '#'.repeat(Math.min(level, 3));
      lines.push(`${prefix} ${richTextToString(data.rich_text as Array<{ plain_text?: string }>)}`);
    } else if (btype === 'bulleted_list_item') {
      lines.push(`- ${richTextToString(data.rich_text as Array<{ plain_text?: string }>)}`);
    } else if (btype === 'numbered_list_item') {
      lines.push(`1. ${richTextToString(data.rich_text as Array<{ plain_text?: string }>)}`);
    } else if (btype === 'to_do') {
      const checked = data.checked ? 'x' : ' ';
      lines.push(`- [${checked}] ${richTextToString(data.rich_text as Array<{ plain_text?: string }>)}`);
    } else if (btype === 'code') {
      const lang = String(data.language ?? '');
      const code = richTextToString(data.rich_text as Array<{ plain_text?: string }>);
      lines.push(`\`\`\`${lang}\n${code}\n\`\`\``);
    } else if (btype === 'quote') {
      lines.push(`> ${richTextToString(data.rich_text as Array<{ plain_text?: string }>)}`);
    } else if (btype === 'divider') {
      lines.push('---');
    } else if (btype === 'image') {
      let url = '';
      const img = data as { type?: string; external?: { url?: string }; file?: { url?: string } };
      if (img.type === 'external') url = img.external?.url ?? '';
      else if (img.type === 'file') url = img.file?.url ?? '';
      const caption = richTextToString(data.caption as Array<{ plain_text?: string }>);
      if (url) {
        const label = caption || 'imagen del documento';
        lines.push(`![${label}](${url})`);
      }
    } else if (btype === 'table_row') {
      const cells = (data.cells as Array<Array<{ plain_text?: string }>>) ?? [];
      const row = cells.map((cell) => richTextToString(cell)).join(' | ');
      lines.push(`| ${row} |`);
    } else {
      const rich = data.rich_text as Array<{ plain_text?: string }> | undefined;
      if (rich?.length) lines.push(richTextToString(rich));
    }
  }
  return lines.join('\n');
}

function formatSearchResults(results: Array<Record<string, unknown>>): string {
  if (!results.length) return 'No se encontraron resultados.';
  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const objType = String(item.object ?? '');
    const itemId = String(item.id ?? '');
    if (objType === 'page') {
      const props = (item.properties as Record<string, Record<string, unknown>>) ?? {};
      let title = '';
      for (const prop of Object.values(props)) {
        if (prop && prop.type === 'title') {
          title = richTextToString(prop.title as Array<{ plain_text?: string }>);
          break;
        }
      }
      if (!title) title = '(sin titulo)';
      lines.push(`${i + 1}. **${title}**\n   ID: \`${itemId}\``);
    } else if (objType === 'database') {
      const titleList = (item.title as Array<{ plain_text?: string }>) ?? [];
      const title = titleList.length ? richTextToString(titleList) : '(sin titulo)';
      lines.push(`${i + 1}. **${title}** (base de datos)\n   ID: \`${itemId}\``);
    }
  }
  return lines.join('\n\n');
}

function formatDatabaseRows(results: Array<Record<string, unknown>>): string {
  if (!results.length) return 'La base de datos no tiene entradas (o el filtro no coincide con nada).';
  const lines: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const propsText = parsePageProperties((row.properties as Record<string, unknown>) ?? {});
    const rowId = String(row.id ?? '');
    lines.push(`### Entrada ${i + 1} (ID: \`${rowId}\`)\n${propsText}`);
  }
  return lines.join('\n\n');
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (e instanceof APIResponseError && e.status === 429 && attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

/**
 * Recorre bloques en profundidad (columnas, toggles, etc.) para no perder imágenes anidadas.
 * Orden: pre-order por cada lista de hijos.
 */
async function collectBlocksDepthFirst(
  notion: Client,
  blockId: string,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let cursor: string | undefined;
  for (;;) {
    const response = await withRetry(() =>
      notion.blocks.children.list({ block_id: blockId, start_cursor: cursor, page_size: 100 }),
    );
    const r = response as {
      results?: Array<Record<string, unknown>>;
      has_more?: boolean;
      next_cursor?: string | null;
    };
    for (const block of r.results ?? []) {
      out.push(block);
      const b = block as { has_children?: boolean; id?: string };
      if (b.has_children && b.id) {
        const nested = await collectBlocksDepthFirst(notion, b.id);
        out.push(...nested);
      }
    }
    if (!r.has_more) break;
    cursor = r.next_cursor ?? undefined;
    if (!cursor) break;
  }
  return out;
}

export async function executeIa360NotionTool(
  name: string,
  rawArgs: string,
): Promise<string> {
  const notion = getNotion();
  if (!notion) {
    return 'Error: NOTION_API_KEY no está configurada en el servidor.';
  }

  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return 'Error: argumentos JSON inválidos para la herramienta.';
  }

  try {
    switch (name) {
      case 'search_notion': {
        const query = String(args.query ?? '').trim();
        if (!query) return 'Error: indique terminos de busqueda.';
        const seen = new Set<string>();
        const merged: Array<Record<string, unknown>> = [];
        const addBatch = (results: Array<Record<string, unknown>>) => {
          for (const item of results) {
            const id = String(item.id ?? '');
            if (id && !seen.has(id)) {
              seen.add(id);
              merged.push(item);
            }
          }
        };
        const runSearch = async (extra: Record<string, unknown>) => {
          const res = await withRetry(() =>
            notion.search({
              query,
              page_size: 50,
              ...extra,
            } as Parameters<typeof notion.search>[0]),
          );
          const results = (res as { results?: Array<Record<string, unknown>> }).results ?? [];
          addBatch(results);
        };
        await runSearch({});
        try {
          await runSearch({ filter: { property: 'object', value: 'page' } });
        } catch {
          /* algunos workspaces aceptan solo la busqueda sin filtro */
        }
        const top = merged.slice(0, 35);
        return truncateText(formatSearchResults(top));
      }
      case 'get_page_content': {
        const pageId = String(args.page_id ?? '');
        if (!pageId) return 'Error: falta page_id.';
        const blocks = await collectBlocksDepthFirst(notion, pageId);
        if (!blocks.length) return 'La pagina esta vacia o no tiene contenido de bloques.';
        return truncateText(parseBlocksToText(blocks));
      }
      case 'query_database': {
        const databaseId = String(args.database_id ?? '');
        if (!databaseId) return 'Error: falta database_id.';
        const filterJson = String(args.filter_json ?? '');
        const body: Parameters<typeof notion.databases.query>[0] = {
          database_id: databaseId,
          page_size: 20,
        };
        if (filterJson.trim()) {
          try {
            body.filter = JSON.parse(filterJson) as never;
          } catch {
            return 'Error: el filtro proporcionado no es JSON valido.';
          }
        }
        const response = await withRetry(() => notion.databases.query(body));
        const results = (response as { results?: Array<Record<string, unknown>> }).results ?? [];
        return truncateText(formatDatabaseRows(results));
      }
      case 'list_databases': {
        const databases: Array<Record<string, unknown>> = [];
        let cursor: string | undefined;
        for (;;) {
          const response = await withRetry(() =>
            notion.search({
              query: '',
              page_size: 100,
              start_cursor: cursor,
            } as Parameters<typeof notion.search>[0]),
          );
          const r = response as {
            results?: Array<Record<string, unknown>>;
            has_more?: boolean;
            next_cursor?: string | null;
          };
          for (const item of r.results ?? []) {
            if (item.object === 'database') databases.push(item);
          }
          if (!r.has_more) break;
          cursor = r.next_cursor ?? undefined;
          if (!cursor) break;
        }
        return truncateText(formatSearchResults(databases));
      }
      case 'get_page_properties': {
        const pageId = String(args.page_id ?? '');
        if (!pageId) return 'Error: falta page_id.';
        const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }));
        const p = page as Record<string, unknown>;
        const properties = (p.properties as Record<string, unknown>) ?? {};
        const url = String(p.url ?? '');
        const created = String(p.created_time ?? '');
        const edited = String(p.last_edited_time ?? '');
        const header = `**URL**: ${url}\n**Creado**: ${created}\n**Editado**: ${edited}\n\n`;
        return truncateText(header + parsePageProperties(properties));
      }
      default:
        return `Error: funcion '${name}' no soportada.`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Error en herramienta Notion (${name}): ${msg}`;
  }
}

export function isNotionConfigured(): boolean {
  return !!process.env.NOTION_API_KEY?.trim();
}
