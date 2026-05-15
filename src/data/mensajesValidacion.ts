/**
 * Mensajes de validación (NIT, licencia) que devuelve la API.
 * Edita aquí para cambiar los textos que recibe el widget.
 */

export const MENSAJES_VALIDACION = {
  apiNoDisponible: 'No se pudo consultar la API de licencias. Intente más tarde.',
  sinLicenciasXml: 'En este momento no cuenta con licencias válidas para continuar con soporte en línea. Si tiene dudas o necesita validar su licencia, contacte a Servicio al Cliente.',
  respuestaNoReconocida: 'Respuesta de la API de licencias no reconocida.',
  errorConexion: 'Error al conectar con el servicio de licencias. Intente más tarde.',
  noSeEncontraronLicencias:
    'Actualmente su empresa no cuenta con licencias activas para acceder al soporte en línea.\n\nPara validar el estado de la licencia o gestionar su activación, por favor comuníquese con el área de Servicio al Cliente.',
  clienteSinLicencia:
    'Actualmente su empresa no cuenta con licencias activas para acceder al soporte en línea.\n\nPara validar el estado de la licencia o gestionar su activación, por favor comuníquese con el área de Servicio al Cliente.',
  nitObligatorio: 'El NIT es obligatorio',
} as const
