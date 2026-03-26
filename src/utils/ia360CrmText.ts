/**
 * Opcional si en el futuro se vuelve a acortar mensajes IA360 en BD.
 * Hoy las respuestas IA360 se guardan con markdown completo para el historial en el widget.
 */
export function stripMarkdownImagesForCrm(contenido: string): string {
  return contenido
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n[Ilustración en documentación — no almacenada en CRM]\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
