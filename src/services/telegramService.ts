/**
 * Servicio para llamar a la API de Telegram (Bot API).
 * Requiere TELEGRAM_BOT_TOKEN en el entorno.
 * Se lee en cada llamada para que dotenv.config() ya haya cargado el .env.
 */
function getToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}
function getApiBase(): string {
  const token = getToken();
  return token ? `https://api.telegram.org/bot${token}` : '';
}

export function isTelegramConfigured(): boolean {
  const token = getToken();
  return Boolean(token && getApiBase());
}

export interface TelegramSendMessageResult {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

/**
 * Envía un mensaje de texto a un chat de Telegram.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramSendMessageResult> {
  const apiBase = getApiBase();
  if (!apiBase || !chatId || !text) {
    return { ok: false, description: 'Telegram no configurado o chat_id/texto vacío' };
  }

  try {
    const res = await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
    const data = (await res.json()) as TelegramSendMessageResult;
    if (!res.ok || !data.ok) {
      console.error('[Telegram] sendMessage error:', data.description || res.statusText);
      return { ok: false, description: data.description || 'Error enviando mensaje' };
    }
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    console.error('[Telegram] sendMessage exception:', msg);
    return { ok: false, description: msg };
  }
}

export interface GetMeResult {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  description?: string;
}

/**
 * Obtiene la información del bot (para verificar token y mostrar en UI).
 */
export async function getTelegramBotMe(): Promise<GetMeResult> {
  const apiBase = getApiBase();
  if (!apiBase) {
    return { ok: false, description: 'TELEGRAM_BOT_TOKEN no configurado' };
  }
  try {
    const res = await fetch(`${apiBase}/getMe`);
    const data = (await res.json()) as GetMeResult;
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error de red';
    return { ok: false, description: msg };
  }
}
