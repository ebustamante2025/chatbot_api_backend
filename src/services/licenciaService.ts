// =============================================================================
// BORRADOR: Licencia siempre válida para desarrollo.
// Para producción: restaurar la llamada a la API externa (Licensecurity).
// =============================================================================

/**
 * Valida la licencia de una empresa.
 * Por ahora siempre retorna válida; solo se verifica si la empresa está en la BD.
 * @param nit - NIT de la empresa (no usado en el stub)
 */
export async function validarLicencia(_nit: string): Promise<{ valida: boolean; mensaje?: string }> {
  // Stub para desarrollo: licencia siempre true
  return {
    valida: true,
    mensaje: 'Licencia válida (modo desarrollo)',
  };
}
