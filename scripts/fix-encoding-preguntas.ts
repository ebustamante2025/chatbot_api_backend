/**
 * Script para corregir en la BD textos con ?? (codificación incorrecta).
 * Ejecutar: npx tsx scripts/fix-encoding-preguntas.ts
 * (o desde la raíz del backend con dotenv cargado)
 *
 * Corrige temas_preguntas.nombre y preguntas_frecuentes.pregunta/respuesta.
 */

import knex from 'knex';
import config from '../knexfile.js';

const env = process.env.NODE_ENV || 'development';
const db = knex(config[env as keyof typeof config] as any);

// Pares [texto incorrecto, texto correcto] para reemplazar
const REEMPLAZOS: [string, string][] = [
  ['N??mina', 'Nómina'],
  ['n??mina', 'nómina'],
  ['contrase??a', 'contraseña'],
  ['Contrase??a', 'Contraseña'],
  ['CONTRASE??A', 'CONTRASEÑA'],
  ['contrase??as', 'contraseñas'],
  ['a??o', 'año'],
  ['A??o', 'Año'],
  ['ni??o', 'niño'],
  ['Ni??o', 'Niño'],
  ['se??or', 'señor'],
  ['Se??or', 'Señor'],
  ['mu??eca', 'muñeca'],
  ['ca??on', 'cañon'],
  ['espa??ol', 'español'],
  ['Espa??ol', 'Español'],
];

async function run() {
  console.log('Corrigiendo codificación en temas_preguntas y preguntas_frecuentes...\n');

  let temasActualizados = 0;
  let preguntasActualizados = 0;

  for (const [mal, bien] of REEMPLAZOS) {
    if (mal === '??' && bien === 'ó') {
      // Solo reemplazar ?? por ó donde tenga sentido (ej. Nómina ya hecho arriba)
      continue;
    }

    const r1 = await db('temas_preguntas')
      .where('nombre', 'like', `%${mal}%`)
      .update({
        nombre: db.raw(`REPLACE(nombre, ?, ?)`, [mal, bien]),
        updated_at: db.fn.now(),
      });
    if (r1 > 0) {
      temasActualizados += r1;
      console.log(`  Temas: reemplazo "${mal}" -> "${bien}": ${r1} fila(s)`);
    }

    const r2 = await db('preguntas_frecuentes')
      .where('pregunta', 'like', `%${mal}%`)
      .orWhere('respuesta', 'like', `%${mal}%`)
      .update({
        pregunta: db.raw('REPLACE(pregunta, ?, ?)', [mal, bien]),
        respuesta: db.raw('REPLACE(respuesta, ?, ?)', [mal, bien]),
        updated_at: db.fn.now(),
      });
    if (r2 > 0) {
      preguntasActualizados += r2;
      console.log(`  Preguntas: reemplazo "${mal}" -> "${bien}": ${r2} fila(s)`);
    }
  }

  console.log(`\nListo. Temas actualizados: ${temasActualizados}, Preguntas actualizadas: ${preguntasActualizados}.`);
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
