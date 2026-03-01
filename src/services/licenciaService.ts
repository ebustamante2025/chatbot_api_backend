/**
 * Valida la licencia de una empresa consultando la API HGInet Security Licencia.
 * API: GET ValidarLicencia?IdentificacionEmpresa={nit}
 * Respuesta válida: ContratosVigentes y ContactosClientes con datos.
 * Respuesta inválida: Notificacion con mensaje o PermiteSoporte false.
 */

import { MENSAJES_VALIDACION } from '../data/mensajesValidacion.js';

const LICENCIA_API_URL =
  process.env.LICENCIA_API_URL ||
  'http://atila.hgi.com.co:8880/HGInetSecurityLicencia/Api/HelpHGIApiController/ValidarLicencia';

export interface ContratoVigente {
  Codigo: string;
  Descripcion: string;
  FechaInicial?: string;
  FechaFinal?: string;
}

export interface ContactoCliente {
  Identificacion: string;
  Nombres: string;
  Apellidos: string;
  Email?: string;
  Celular?: string;
  Telefono?: string;
  Direccion?: string;
  FechaNacimiento?: string;
}

export interface ValidarLicenciaResult {
  valida: boolean;
  mensaje?: string;
  /** Solo en desarrollo: causa técnica del fallo (ej. status atila, error de red) */
  detalleError?: string;
  /** Nombre del cliente/empresa devuelto por la API (ej. <ClienteNombre> en XML) */
  clienteNombre?: string;
  contratosVigentes?: ContratoVigente[];
  contactosClientes?: ContactoCliente[];
  permiteSoporte?: boolean;
}

function normalizarContratosVigentes(raw: unknown): ContratoVigente[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r: any) => ({
      Codigo: String(r.Codigo ?? r.codigo ?? ''),
      Descripcion: String(r.Descripcion ?? r.descripcion ?? ''),
      FechaInicial: r.FechaInicial ?? r.fechaInicial,
      FechaFinal: r.FechaFinal ?? r.fechaFinal,
    }));
  }
  if (typeof raw === 'object' && raw !== null && 'ContratoVigente' in (raw as any)) {
    const arr = (raw as any).ContratoVigente;
    return Array.isArray(arr) ? normalizarContratosVigentes(arr) : [];
  }
  return [];
}

function normalizarContactosClientes(raw: unknown): ContactoCliente[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r: any) => ({
      Identificacion: String(r.Identificacion ?? r.identificacion ?? ''),
      Nombres: String(r.Nombres ?? r.nombres ?? ''),
      Apellidos: String(r.Apellidos ?? r.apellidos ?? ''),
      Email: r.Email ?? r.email,
      Celular: r.Celular ?? r.celular,
      Telefono: r.Telefono ?? r.telefono,
      Direccion: r.Direccion ?? r.direccion,
      FechaNacimiento: r.FechaNacimiento ?? r.fechaNacimiento,
    }));
  }
  if (typeof raw === 'object' && raw !== null && 'ContactoCliente' in (raw as any)) {
    const arr = (raw as any).ContactoCliente;
    return Array.isArray(arr) ? normalizarContactosClientes(arr) : [];
  }
  return [];
}

function extraerNotificacionMensaje(raw: any): string | undefined {
  if (!raw) return undefined;
  const notif = raw.Notificacion ?? raw.notificacion;
  if (!notif) return undefined;
  const msg = notif.Mensaje ?? notif.mensaje ?? notif.d2p1?.Mensaje;
  return msg ? String(msg) : undefined;
}

function extraerTag(xml: string, tagName: string): string[] {
  const re = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push((m[1] ?? '').trim());
  return out;
}

function extraerContratosDesdeXml(xml: string): ContratoVigente[] {
  const contratos: ContratoVigente[] = [];
  const re = /<ContratoVigente>[\s\S]*?<\/ContratoVigente>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const codigo = extraerTag(block, 'Codigo')[0] ?? '';
    const descripcion = extraerTag(block, 'Descripcion')[0] ?? '';
    const fechaInicial = extraerTag(block, 'FechaInicial')[0];
    const fechaFinal = extraerTag(block, 'FechaFinal')[0];
    if (codigo || descripcion) {
      contratos.push({ Codigo: codigo, Descripcion: descripcion, FechaInicial: fechaInicial || undefined, FechaFinal: fechaFinal || undefined });
    }
  }
  return contratos;
}

function extraerContactosDesdeXml(xml: string): ContactoCliente[] {
  const contactos: ContactoCliente[] = [];
  const re = /<ContactoCliente>[\s\S]*?<\/ContactoCliente>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[0];
    const identificacion = extraerTag(block, 'Identificacion')[0] ?? '';
    const nombres = extraerTag(block, 'Nombres')[0] ?? '';
    const apellidos = extraerTag(block, 'Apellidos')[0] ?? '';
    const email = extraerTag(block, 'Email')[0];
    const celular = extraerTag(block, 'Celular')[0];
    const telefono = extraerTag(block, 'Telefono')[0];
    if (identificacion || nombres || apellidos) {
      contactos.push({
        Identificacion: identificacion,
        Nombres: nombres,
        Apellidos: apellidos,
        Email: email || undefined,
        Celular: celular || undefined,
        Telefono: telefono || undefined,
      });
    }
  }
  return contactos;
}

/**
 * Valida la licencia de una empresa por NIT.
 * Llama a la API HGInet y devuelve valida, mensaje y opcionalmente contratos y contactos.
 */
export async function validarLicencia(nit: string): Promise<ValidarLicenciaResult> {
  const url = `${LICENCIA_API_URL}?IdentificacionEmpresa=${encodeURIComponent(nit.trim())}`;
  if (process.env.NODE_ENV !== 'production') {
    console.log('[licencia] GET', url);
  }

  let data: any;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });
    const text = await response.text();
    if (process.env.NODE_ENV !== 'production') {
      console.log('[licencia] status', response.status, 'body length', text.length, 'preview', text.slice(0, 120));
    }
    if (!response.ok) {
      console.warn('[licencia] API no OK:', response.status, text.slice(0, 300));
      const detalle = process.env.NODE_ENV !== 'production'
        ? `API atila respondió ${response.status}: ${text.slice(0, 200)}`
        : undefined;
      return {
        valida: false,
        mensaje: MENSAJES_VALIDACION.apiNoDisponible,
        detalleError: detalle,
      };
    }
    // Intentar JSON primero
    const trimmed = text.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      data = JSON.parse(text);
    } else if (trimmed.startsWith('<')) {
      // XML: extraer mensaje de error si hay Notificacion
      const mensajeNotif = text.includes('Notificacion') && text.includes('Mensaje')
        ? (text.match(/<d2p1:Mensaje>([^<]+)<\/d2p1:Mensaje>/) ?? text.match(/<Mensaje>([^<]+)<\/Mensaje>/))?.[1]
        : undefined;
      const permiteSoporte = text.includes('<PermiteSoporte>true</PermiteSoporte>');
      const tieneContratos = text.includes('ContratoVigente') && !text.includes('ContratosVigentes i:nil="true"');
      const tieneContactos = text.includes('ContactoCliente') && !text.includes('ContactosClientes i:nil="true"');
      if (mensajeNotif || !permiteSoporte || !tieneContratos) {
        return {
          valida: false,
          mensaje: mensajeNotif ?? MENSAJES_VALIDACION.sinLicenciasXml,
        };
      }
      // XML válido: extraer ClienteNombre, ContratoVigente y ContactoCliente
      const clienteNombreXml = extraerTag(text, 'ClienteNombre')[0]?.trim() || undefined;
      const contratosXml = extraerContratosDesdeXml(text);
      const contactosXml = extraerContactosDesdeXml(text);
      return {
        valida: true,
        permiteSoporte: true,
        clienteNombre: clienteNombreXml,
        contratosVigentes: contratosXml,
        contactosClientes: contactosXml,
      };
    } else {
      return { valida: false, mensaje: MENSAJES_VALIDACION.respuestaNoReconocida };
    }
  } catch (err: any) {
    console.error('Error llamando API de licencias:', err);
    const detalle = process.env.NODE_ENV !== 'production' && err?.message
      ? `Error de red: ${err.message}`
      : undefined;
    return {
      valida: false,
      mensaje: MENSAJES_VALIDACION.errorConexion,
      detalleError: detalle,
    };
  }

  const notificacionMensaje = extraerNotificacionMensaje(data);
  const permiteSoporte = data.PermiteSoporte ?? data.permiteSoporte ?? false;
  const contratos = normalizarContratosVigentes(data.ContratosVigentes ?? data.contratosVigentes);
  const contactos = normalizarContactosClientes(data.ContactosClientes ?? data.contactosClientes);

  if (notificacionMensaje || !permiteSoporte || contratos.length === 0) {
    return {
      valida: false,
      mensaje: MENSAJES_VALIDACION.noSeEncontraronLicencias,
    };
  }

  const clienteNombre = data.ClienteNombre ?? data.clienteNombre;
  const clienteNombreStr = typeof clienteNombre === 'string' ? clienteNombre.trim() || undefined : undefined;

  return {
    valida: true,
    clienteNombre: clienteNombreStr,
    contratosVigentes: contratos,
    contactosClientes: contactos,
    permiteSoporte: true,
  };
}
