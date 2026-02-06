import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: 'postgres', // Conectamos a la BD por defecto para crear la nueva
};

const dbName = process.env.DB_NAME || 'crm_chatbot';

async function createDatabase() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Verificar si la base de datos ya existe
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rows.length > 0) {
      console.log(`ℹ️  La base de datos "${dbName}" ya existe`);
    } else {
      // Crear la base de datos
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Base de datos "${dbName}" creada exitosamente`);
    }
  } catch (error) {
    console.error('❌ Error al crear la base de datos:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
