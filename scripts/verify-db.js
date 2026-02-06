import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'crm_chatbot',
};

async function verifyDatabase() {
  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL\n');

    // Verificar tablas creadas
    console.log('📊 Tablas en la base de datos:');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length === 0) {
      console.log('⚠️  No se encontraron tablas. Ejecuta las migraciones primero:');
      console.log('   npm run migrate:latest\n');
    } else {
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
      console.log(`\n✅ Total: ${tablesResult.rows.length} tablas\n`);
    }

    // Verificar migraciones ejecutadas
    console.log('🔄 Migraciones ejecutadas:');
    const migrationsResult = await client.query(`
      SELECT name, batch, migration_time 
      FROM knex_migrations 
      ORDER BY batch, id;
    `);

    if (migrationsResult.rows.length === 0) {
      console.log('⚠️  No se encontraron migraciones ejecutadas.\n');
    } else {
      migrationsResult.rows.forEach((row, index) => {
        const date = new Date(row.migration_time).toLocaleString('es-ES');
        console.log(`   ${index + 1}. ${row.name} (batch: ${row.batch}) - ${date}`);
      });
      console.log(`\n✅ Total: ${migrationsResult.rows.length} migraciones\n`);
    }

    // Verificar datos de ejemplo (seeds)
    console.log('📦 Datos de ejemplo (seeds):');
    
    const empresasCount = await client.query('SELECT COUNT(*) FROM empresas');
    const usuariosCount = await client.query('SELECT COUNT(*) FROM usuarios_soporte');
    const contactosCount = await client.query('SELECT COUNT(*) FROM contactos');
    const conversacionesCount = await client.query('SELECT COUNT(*) FROM conversaciones');
    const mensajesCount = await client.query('SELECT COUNT(*) FROM mensajes');

    console.log(`   - Empresas: ${empresasCount.rows[0].count}`);
    console.log(`   - Usuarios: ${usuariosCount.rows[0].count}`);
    console.log(`   - Contactos: ${contactosCount.rows[0].count}`);
    console.log(`   - Conversaciones: ${conversacionesCount.rows[0].count}`);
    console.log(`   - Mensajes: ${mensajesCount.rows[0].count}\n`);

    // Resumen
    console.log('📋 Resumen:');
    console.log(`   ✅ Base de datos: ${config.database}`);
    console.log(`   ✅ Tablas creadas: ${tablesResult.rows.length}`);
    console.log(`   ✅ Migraciones: ${migrationsResult.rows.length}`);
    
    if (tablesResult.rows.length === 0) {
      console.log('\n⚠️  ACCIÓN REQUERIDA: Ejecuta las migraciones:');
      console.log('   npm run migrate:latest');
    } else if (tablesResult.rows.length < 14) {
      console.log('\n⚠️  Algunas tablas pueden faltar. Verifica las migraciones.');
    } else {
      console.log('\n✅ Base de datos configurada correctamente!');
    }

  } catch (error) {
    if (error.code === '42P01') {
      console.error('❌ Error: La tabla knex_migrations no existe.');
      console.error('   Esto significa que las migraciones no se han ejecutado.');
      console.error('\n   Ejecuta: npm run migrate:latest');
    } else if (error.code === '3D000') {
      console.error(`❌ Error: La base de datos "${config.database}" no existe.`);
      console.error('\n   Ejecuta: npm run db:create');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
