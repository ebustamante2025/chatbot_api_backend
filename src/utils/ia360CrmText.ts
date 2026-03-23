/**
 * El CRM guarda solo texto; las URLs de imágenes de Notion son largas y caducan.
 * No se almacenan referencias a imágenes en BD (solo texto útil para auditoría).
 */
export function stripMarkdownImagesForCrm(contenido: string): string {
  return contenido
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n[Ilustración en documentación — no almacenada en CRM]\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
