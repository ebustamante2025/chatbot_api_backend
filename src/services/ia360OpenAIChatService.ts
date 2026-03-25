/**
 * Chat IA360 con OpenAI + tools Notion (equivalente a chatbot_Agente/openai_chat.py).
 */
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { executeIa360NotionTool } from './ia360NotionService.js';

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Rondas modelo↔Notion (defecto 5). Menor = más rápido, menos exhaustivo (env IA360_MAX_TOOL_ROUNDS). */
function readEnvInt(name: string, defaultVal: number, lo: number, hi: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return defaultVal;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return clampInt(n, lo, hi);
}

const SYSTEM_PROMPT = `Eres un asistente inteligente de documentacion interna de la empresa. \
Tienes acceso a toda la base de conocimiento y documentacion de la organizacion.

Capacidades:
- Buscar documentos, manuales y bases de datos internas por nombre o contenido.
- Leer el contenido completo de cualquier documento.
- Consultar bases de datos internas con filtros.
- Listar todas las bases de datos disponibles.
- Obtener propiedades y metadatos de documentos.

Reglas:
1. Responde SIEMPRE en español.
2. NUNCA menciones "Notion", "workspace", "pagina de Notion" ni ninguna referencia a la \
plataforma donde se almacena la informacion. Para ti, son "documentos", "manuales", \
"la documentacion", "la base de conocimiento" o "registros internos".
3. Cuando el usuario pregunte algo, usa las herramientas disponibles para obtener la \
informacion real antes de responder.
4. Si una busqueda no arroja resultados, dile al usuario y sugiere reformular.
5. Presenta la informacion de forma clara y organizada usando Markdown.
6. Si necesitas multiples pasos (buscar y luego leer), hazlos secuencialmente.
7. No inventes informacion: basa tus respuestas unicamente en los datos obtenidos.
8. IMAGENES: cuando el contenido de un documento incluya imagenes (formato \
![texto](url)), SIEMPRE incluyelas en tu respuesta usando exactamente la misma \
sintaxis Markdown ![descripcion](url). Nunca omitas imagenes ni digas que no puedes \
mostrarlas. Las imagenes son parte esencial de la documentacion.
9. AGOTAR HERRAMIENTAS ANTES DE RENDIRTE: antes de decir que no puedes obtener una seccion \
o un procedimiento (ej. factura en HGI360 POS, "Generacion Documentos"), DEBES llamar las \
herramientas varias veces en este mismo turno: search_notion con consultas distintas \
(sinonimos, nombre del producto, modulo, accion: factura, POS, documento, electronico, etc.), \
en caso util list_databases para ubicar bases, y con los IDs obtenidos usar get_page_content \
para leer el documento completo. Si hay varias paginas relevantes, lee la mas acorde. \
Solo si tras eso los resultados siguen vacios o el error viene de la herramienta, di que no \
aparece en la documentacion accesible y sugiere reformular la pregunta.
10. No sugieras "contactar soporte tecnico" o externos como sustituto de haber buscado y leido \
la documentacion interna. El soporte humano no es un paso automatico: primero la base de conocimiento.
11. Si el usuario pide algo que objetivamente no esta en las herramientas, explicalo sin revelar \
detalles tecnicos internos.
12. Respuestas CONCRETAS: pasos numerados, nombres exactos de menus o botones tal como aparecen \
en el documento leido, sin rodeos. Si el documento lista secciones, citelas.
13. IMAGENES OBLIGATORIAS: copia en tu respuesta TODAS las lineas Markdown ![descripcion](url) que \
aparezcan en get_page_content, sin resumir ni sustituir por texto. El usuario debe ver las mismas \
ilustraciones que en la documentacion.
14. EFICIENCIA: si search_notion ya devolvio un documento claramente relevante, usa get_page_content \
antes de repetir busquedas con terminos casi iguales. Minimiza llamadas redundantes sin sacrificar \
la regla 9 cuando realmente falte informacion.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_notion',
      description:
        'Buscar documentos y bases de datos internas. Combina resultados amplios y por paginas. Si la primera busqueda no basta, llamar de nuevo con otros terminos (producto, modulo, verbo: facturar, POS, etc.).',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termino de busqueda para encontrar documentos o bases de datos.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description:
        'Leer el contenido completo de un documento dado su ID, incluyendo texto e imagenes. Usa esto cuando necesites ver que dice un documento especifico.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'El ID del documento (UUID).' },
        },
        required: ['page_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_database',
      description:
        'Consultar una base de datos interna para obtener sus entradas/filas. Opcionalmente acepta un filtro en formato JSON.',
      parameters: {
        type: 'object',
        properties: {
          database_id: { type: 'string', description: 'El ID de la base de datos (UUID).' },
          filter_json: {
            type: 'string',
            description:
              'Filtro opcional en formato JSON. Ejemplo: {"property": "Status", "status": {"equals": "Done"}}',
          },
        },
        required: ['database_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_databases',
      description:
        'Listar todas las bases de datos disponibles en la documentacion interna. Usa esto cuando el usuario pregunte que bases de datos tiene o quiera una vista general.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_properties',
      description:
        'Obtener las propiedades y metadatos de un documento (titulo, fecha, estado, etc). Usa esto cuando necesites ver los campos/propiedades de un documento, no su contenido.',
      parameters: {
        type: 'object',
        properties: {
          page_id: { type: 'string', description: 'El ID del documento (UUID).' },
        },
        required: ['page_id'],
      },
    },
  },
];

export interface Ia360ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function trimMessages(
  messages: ChatCompletionMessageParam[],
  maxHistory: number
): ChatCompletionMessageParam[] {
  if (messages.length <= maxHistory + 1) return messages;
  const sys = messages[0];
  const rest = messages.slice(1);
  const tail = rest.slice(-maxHistory);
  return sys ? [sys, ...tail] : tail;
}

/**
 * Ejecuta un turno de chat: mensaje nuevo del usuario + historial previo (sin el mensaje nuevo).
 */
export async function runIa360Chat(params: {
  userMessage: string;
  history: Ia360ChatHistoryItem[];
  model?: string;
}): Promise<{ reply: string; error?: string }> {
  const client = getClient();
  if (!client) {
    return { reply: '', error: 'OPENAI_API_KEY no está configurada en el servidor.' };
  }

  const model = params.model?.trim() || process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
  const maxHistory = readEnvInt('IA360_MAX_HISTORY_MESSAGES', 24, 4, 80);
  const maxRounds = readEnvInt('IA360_MAX_TOOL_ROUNDS', 5, 1, 12);

  const prior: ChatCompletionMessageParam[] = params.history.map((h) => ({
    role: h.role,
    content: h.content,
  }));

  let messages: ChatCompletionMessageParam[] = trimMessages(
    [
      { role: 'system', content: SYSTEM_PROMPT },
      ...prior,
      { role: 'user', content: params.userMessage },
    ],
    maxHistory
  );

  for (let round = 0; round < maxRounds; round++) {
    const response = await client.chat.completions.create({
      model,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    if (!message) {
      return { reply: '', error: 'Respuesta vacía del modelo.' };
    }

    if (!message.tool_calls?.length) {
      const text = message.content ?? '';
      return { reply: text };
    }

    messages.push(message as ChatCompletionMessageParam);

    const toolCalls = message.tool_calls;
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const name = tc.function.name;
        const args = tc.function.arguments ?? '{}';
        const content = await executeIa360NotionTool(name, args);
        return { id: tc.id, content };
      })
    );
    for (const r of results) {
      messages.push({
        role: 'tool',
        tool_call_id: r.id,
        content: r.content,
      });
    }
  }

  const client2 = getClient();
  if (!client2) return { reply: '', error: 'OPENAI_API_KEY no está configurada en el servidor.' };
  const final = await client2.chat.completions.create({
    model,
    messages,
  });
  const reply = final.choices[0]?.message?.content ?? '';
  return { reply };
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY?.trim();
}
