import { db } from '../database/connection.js';

const TZ = 'America/Bogota';
const NAGER_TTL_MS = 24 * 60 * 60 * 1000;

/** Índice: 0=domingo … 6=sábado (Date.getUTCDay no sirve; usamos partes en Bogotá). */
const DOW_FIELDS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;

export type HorarioAgenteConfigRow = {
  id: number;
  zona_horaria: string;
  lunes: boolean;
  martes: boolean;
  miercoles: boolean;
  jueves: boolean;
  viernes: boolean;
  sabado: boolean;
  domingo: boolean;
  hora_inicio: string;
  hora_fin: string;
  tooltip_fuera_horario: string | null;
  mensaje_fuera_horario: string | null;
  actualizado_en: string;
};

export type HorarioExcepcionRow = {
  id: number;
  fecha: string;
  tipo: 'cerrado' | 'horario_especial';
  hora_inicio: string | null;
  hora_fin: string | null;
  nota: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

export type ResultadoDisponibilidadAgente = {
  disponible: boolean;
  codigo: string;
  razon: string;
  /** Texto largo fuera de horario: generado desde hora_inicio / hora_fin y días (misma fuente que resumen). */
  tooltip: string;
  /** Una línea para el widget (p. ej. debajo del título «Chatear con un agente»). */
  resumen_horario_linea: string;
  mensaje: string;
  es_festivo: boolean;
  nombre_festivo: string | null;
  proximo_resumen: string | null;
};

type NagerItem = { date: string; localName?: string; name?: string };

let nagerMemoria: {
  year: number;
  dates: Set<string>;
  nombres: Map<string, string>;
  fetchedAt: number;
} | null = null;

/** Partes de fecha/hora en zona Bogotá. */
export function ahoraEnBogota(fecha: Date = new Date()): {
  dateStr: string;
  dow: number;
  minutesOfDay: number;
} {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(fecha);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '0';
  const y = get('year');
  const m = get('month');
  const d = get('day');
  const h = get('hour');
  const min = get('minute');
  const dateStr = `${y}-${m}-${d}`;
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(fecha);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = dowMap[wd] ?? 0;
  const minutesOfDay = Number(h) * 60 + Number(min);
  return { dateStr, dow, minutesOfDay };
}

function timeStrToMinutes(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null;
  const s = t.trim().slice(0, 8);
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

const DIA_ORDER_DISPLAY = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

const DIA_NOMBRE: Record<(typeof DIA_ORDER_DISPLAY)[number], string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  domingo: 'domingo',
};

function sliceTimeHHMM(t: string | null | undefined): string {
  if (!t) return '08:00';
  return String(t).trim().slice(0, 5);
}

/** HH:mm (24 h) → 8:00 AM / 5:30 PM (texto usuario). */
function horaHHMMaAMPM(hhmm: string): string {
  const s = hhmm.trim().slice(0, 5);
  const [hs, ms] = s.split(':');
  const hRaw = Number.parseInt(hs ?? '0', 10);
  const m = (ms ?? '00').slice(0, 2);
  if (!Number.isFinite(hRaw) || hRaw < 0 || hRaw > 23) return `${s} h`;
  if (hRaw === 0) return `12:${m} AM`;
  if (hRaw < 12) return `${hRaw}:${m} AM`;
  if (hRaw === 12) return `12:${m} PM`;
  return `${hRaw - 12}:${m} PM`;
}

function formatearDiasAtencionDesdeConfig(config: HorarioAgenteConfigRow): string {
  const activos = DIA_ORDER_DISPLAY.map((k, i) => (config[k] ? i : -1)).filter((i) => i >= 0);
  if (activos.length === 0) return 'ningún día (revise la configuración)';
  if (activos.length === 7) return 'todos los días';
  const sorted = [...new Set(activos)].sort((a, b) => a - b);
  if (sorted.length === 1) {
    const k = DIA_ORDER_DISPLAY[sorted[0]!]!;
    return `los ${DIA_NOMBRE[k]}`;
  }
  let i = 1;
  while (i < sorted.length && sorted[i] === sorted[i - 1]! + 1) i += 1;
  if (i === sorted.length) {
    const k0 = DIA_ORDER_DISPLAY[sorted[0]!]!;
    const k1 = DIA_ORDER_DISPLAY[sorted[sorted.length - 1]!]!;
    return `${DIA_NOMBRE[k0]} a ${DIA_NOMBRE[k1]}`;
  }
  const labels = sorted.map((idx) => DIA_NOMBRE[DIA_ORDER_DISPLAY[idx]!]!);
  if (labels.length === 2) return `${labels[0]} y ${labels[1]}`;
  const last = labels.pop()!;
  return `${labels.join(', ')} y ${last}`;
}

/** Texto tooltip coherente con hora_inicio / hora_fin y días en BD (evita texto guardado desfasado). */
export function construirTooltipFueraHorarioDesdeConfig(config: HorarioAgenteConfigRow): string {
  const hi = sliceTimeHHMM(config.hora_inicio);
  const hf = sliceTimeHHMM(config.hora_fin);
  const diasTxt = formatearDiasAtencionDesdeConfig(config);
  return `Nos encontramos fuera de horario laboral. Nuestro horario de atención es de ${diasTxt} de ${horaHHMMaAMPM(hi)} a ${horaHHMMaAMPM(hf)}.`;
}

/** Línea corta del widget (mismas horas y días que el tooltip). */
export function construirResumenLineaHorarioAgente(config: HorarioAgenteConfigRow): string {
  const hi = sliceTimeHHMM(config.hora_inicio);
  const hf = sliceTimeHHMM(config.hora_fin);
  const diasTxt = formatearDiasAtencionDesdeConfig(config);
  const cap = diasTxt.charAt(0).toUpperCase() + diasTxt.slice(1);
  return `${cap} de ${horaHHMMaAMPM(hi)} a ${horaHHMMaAMPM(hf)} · Colombia`;
}

async function ensureConfig(): Promise<HorarioAgenteConfigRow> {
  let row = (await db('widget_horario_agente_config').orderBy('id', 'asc').first()) as HorarioAgenteConfigRow | undefined;
  if (!row) {
    await db('widget_horario_agente_config').insert({
      zona_horaria: TZ,
      lunes: true,
      martes: true,
      miercoles: true,
      jueves: true,
      viernes: true,
      sabado: true,
      domingo: false,
      hora_inicio: '08:00:00',
      hora_fin: '17:30:00',
      tooltip_fuera_horario:
        'En este momento nos encontramos fuera de horario laboral. Nuestro horario de atención es de lunes a sábado de 8:00 AM a 5:30 PM.',
      mensaje_fuera_horario:
        'Hola 👋 En este momento nuestro servicio de atención no está disponible.\n\nNuestro horario de atención es **lunes a sábado de 8:00 AM a 5:30 PM** (hora Colombia).\n\nPuedes dejarnos tu mensaje y te responderemos en el próximo horario hábil.',
    });
    row = (await db('widget_horario_agente_config').orderBy('id', 'asc').first()) as HorarioAgenteConfigRow;
  }
  return row;
}

async function fetchNagerColombia(year: number): Promise<Map<string, string>> {
  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/CO`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    console.warn('[horario agente] Nager HTTP', res.status, url);
    return new Map();
  }
  const data = (await res.json()) as NagerItem[];
  if (!Array.isArray(data)) return new Map();
  const map = new Map<string, string>();
  for (const item of data) {
    if (item.date && typeof item.date === 'string') {
      map.set(item.date, item.localName || item.name || 'Festivo');
    }
  }
  return map;
}

/** Lista de festivos CO para el año (caché en memoria ~24h o cambio de año). */
export async function obtenerFestivosColombiaNager(year: number): Promise<Map<string, string>> {
  const now = Date.now();
  if (
    nagerMemoria &&
    nagerMemoria.year === year &&
    now - nagerMemoria.fetchedAt < NAGER_TTL_MS
  ) {
    return nagerMemoria.nombres;
  }
  try {
    const nombres = await fetchNagerColombia(year);
    const dates = new Set(nombres.keys());
    nagerMemoria = { year, dates, nombres, fetchedAt: now };
    return nombres;
  } catch (e) {
    console.warn('[horario agente] Nager error, sin festivos remotos:', e);
    nagerMemoria = { year, dates: new Set(), nombres: new Map(), fetchedAt: now };
    return nagerMemoria.nombres;
  }
}

function diaHabilSegunConfig(config: HorarioAgenteConfigRow, dow: number): boolean {
  const field = DOW_FIELDS[dow];
  return Boolean((config as Record<string, unknown>)[field]);
}

function enVentanaHoraria(minutes: number, startM: number, endM: number): boolean {
  return minutes >= startM && minutes < endM;
}

export async function evaluarDisponibilidadAgenteHumano(
  ahora: Date = new Date(),
): Promise<ResultadoDisponibilidadAgente> {
  const config = await ensureConfig();
  const { dateStr, dow, minutesOfDay } = ahoraEnBogota(ahora);
  const year = Number(dateStr.slice(0, 4));

  const tooltipDesdeConfig = construirTooltipFueraHorarioDesdeConfig(config);
  const resumenLinea = construirResumenLineaHorarioAgente(config);

  const mensajeDefault =
    config.mensaje_fuera_horario?.trim() ||
    'Hola 👋 En este momento nuestro servicio de atención no está disponible.\n\nNuestro horario de atención es **lunes a sábado de 8:00 AM a 5:30 PM** (hora Colombia).\n\nPuedes dejarnos tu mensaje y te responderemos en el próximo horario hábil.';

  const startGeneral = timeStrToMinutes(config.hora_inicio) ?? 8 * 60;
  const endGeneral = timeStrToMinutes(config.hora_fin) ?? 17 * 60 + 30;

  const ex = (await db('widget_horario_excepciones')
    .where({ fecha: dateStr, activo: true })
    .first()) as HorarioExcepcionRow | undefined;

  if (ex) {
    if (ex.tipo === 'cerrado') {
      const nota = ex.nota?.trim();
      return {
        disponible: false,
        codigo: 'NOVEDAD_CERRADO',
        razon: nota || 'Día sin servicio (novedad registrada)',
        tooltip: tooltipDesdeConfig,
        resumen_horario_linea: resumenLinea,
        mensaje:
          mensajeDefault +
          (nota ? `\n\nMotivo: ${nota}` : '') +
          '\n\nHoy es un día marcado como sin atención en nuestro calendario.',
        es_festivo: false,
        nombre_festivo: null,
        proximo_resumen: await estimarProximoHorario(config, ahora),
      };
    }
    if (ex.tipo === 'horario_especial') {
      const hs = timeStrToMinutes(ex.hora_inicio);
      const he = timeStrToMinutes(ex.hora_fin);
      if (hs == null || he == null) {
        return {
          disponible: false,
          codigo: 'NOVEDAD_HORARIO_INVALIDO',
          razon: 'Novedad con horario incompleto',
          tooltip: tooltipDesdeConfig,
          resumen_horario_linea: resumenLinea,
          mensaje: mensajeDefault,
          es_festivo: false,
          nombre_festivo: null,
          proximo_resumen: null,
        };
      }
      const ok = enVentanaHoraria(minutesOfDay, hs, he);
      if (!ok) {
        const nota = ex.nota?.trim();
        return {
          disponible: false,
          codigo: 'NOVEDAD_FUERA_HORARIO_ESPECIAL',
          razon: nota || 'Fuera del horario especial del día',
          tooltip: tooltipDesdeConfig,
          resumen_horario_linea: resumenLinea,
          mensaje: mensajeDefault + (nota ? `\n\n${nota}` : ''),
          es_festivo: false,
          nombre_festivo: null,
          proximo_resumen: await estimarProximoHorario(config, ahora),
        };
      }
      return {
        disponible: true,
        codigo: 'NOVEDAD_HORARIO_ESPECIAL',
        razon: ex.nota?.trim() || 'Horario especial',
        tooltip: '',
        resumen_horario_linea: '',
        mensaje: '',
        es_festivo: false,
        nombre_festivo: null,
        proximo_resumen: null,
      };
    }
  }

  const festivos = await obtenerFestivosColombiaNager(year);
  const nombreFestivo = festivos.get(dateStr);
  if (nombreFestivo) {
    return {
      disponible: false,
      codigo: 'FESTIVO_CO',
      razon: `Festivo: ${nombreFestivo}`,
      tooltip: tooltipDesdeConfig,
      resumen_horario_linea: resumenLinea,
      mensaje:
        mensajeDefault +
        `\n\nHoy es día festivo en Colombia (${nombreFestivo}).`,
      es_festivo: true,
      nombre_festivo: nombreFestivo,
      proximo_resumen: await estimarProximoHorario(config, ahora),
    };
  }

  if (!diaHabilSegunConfig(config, dow)) {
    return {
      disponible: false,
      codigo: 'DIA_NO_HABIL',
      razon: 'Día no hábil según configuración',
      tooltip: tooltipDesdeConfig,
      resumen_horario_linea: resumenLinea,
      mensaje: mensajeDefault,
      es_festivo: false,
      nombre_festivo: null,
      proximo_resumen: await estimarProximoHorario(config, ahora),
    };
  }

  if (!enVentanaHoraria(minutesOfDay, startGeneral, endGeneral)) {
    return {
      disponible: false,
      codigo: 'FUERA_HORARIO',
      razon: 'Fuera del horario general',
      tooltip: tooltipDesdeConfig,
      resumen_horario_linea: resumenLinea,
      mensaje: mensajeDefault,
      es_festivo: false,
      nombre_festivo: null,
      proximo_resumen: await estimarProximoHorario(config, ahora),
    };
  }

  return {
    disponible: true,
    codigo: 'DISPONIBLE',
    razon: 'Dentro de horario',
    tooltip: '',
    resumen_horario_linea: '',
    mensaje: '',
    es_festivo: false,
    nombre_festivo: null,
    proximo_resumen: null,
  };
}

/** Estimación simple: siguiente día hábil a hora_inicio si hoy no hay ventana. */
async function estimarProximoHorario(config: HorarioAgenteConfigRow, desde: Date): Promise<string | null> {
  const startM = timeStrToMinutes(config.hora_inicio) ?? 8 * 60;
  const h = Math.floor(startM / 60);
  const mi = startM % 60;
  const labelHora = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;

  for (let delta = 1; delta <= 14; delta++) {
    const d = new Date(desde.getTime() + delta * 24 * 60 * 60 * 1000);
    const { dateStr, dow } = ahoraEnBogota(d);
    const year = Number(dateStr.slice(0, 4));
    const ex = (await db('widget_horario_excepciones')
      .where({ fecha: dateStr, activo: true })
      .first()) as HorarioExcepcionRow | undefined;
    if (ex?.tipo === 'cerrado') continue;

    const festivos = await obtenerFestivosColombiaNager(year);
    if (festivos.has(dateStr)) continue;

    if (!diaHabilSegunConfig(config, dow)) continue;

    if (ex?.tipo === 'horario_especial') {
      const hs = timeStrToMinutes(ex.hora_inicio);
      const he = timeStrToMinutes(ex.hora_fin);
      if (hs != null && he != null) {
        return `Próxima atención: ${dateStr} entre ${String(ex.hora_inicio).slice(0, 5)} y ${String(ex.hora_fin).slice(0, 5)} (horario especial).`;
      }
    }
    return `Próxima atención estimada: ${dateStr} desde las ${labelHora} (hora Colombia).`;
  }
  return 'Consulte más adelante el horario hábil.';
}
