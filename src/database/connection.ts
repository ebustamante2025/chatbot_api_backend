import knex from 'knex';
import type { Knex } from 'knex';
import config from '../../knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const dbConfig = config[environment as keyof typeof config];

export const db: Knex = knex(dbConfig);

// Función para verificar la conexión
export async function testConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error);
    return false;
  }
}

// Función para cerrar la conexión
export async function closeConnection(): Promise<void> {
  await db.destroy();
  console.log('🔌 Conexión a la base de datos cerrada');
}
