/**
 * Mensajes de validación (NIT, licencia) que devuelve la API.
 * Edita aquí para cambiar los textos que recibe el widget.
 */

export const MENSAJES_VALIDACION = {
  apiNoDisponible: 'No se pudo consultar la API de licencias. Intente más tarde.',
  sinLicenciasXml: 'En este momento no cuenta con licencias válidas para continuar con soporte en línea. Si tiene dudas o necesita validar su licencia, contacte a Servicio al Cliente.',
  respuestaNoReconocida: 'Respuesta de la API de licencias no reconocida.',
  errorConexion: 'Error al conectar con el servicio de licencias. Intente más tarde.',
  noSeEncontraronLicencias: 'Su empresa no cuenta con licencias activas para usar el soporte en línea en este momento. Para validar o activar su licencia, contacte a Servicio al Cliente.',
  clienteSinLicencia: 'Su empresa no cuenta con licencias activas para usar el soporte en línea. Para más información, contacte a Servicio al Cliente.',
  nitObligatorio: 'El NIT es obligatorio',
} as const
