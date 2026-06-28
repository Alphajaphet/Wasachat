// Run with: npm run migrate
// Reads schema.sql and executes it against DATABASE_URL
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  try {
    // Needed for gen_random_uuid()
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query(sql);
    console.log('✅ Migration completed successfully. Tables created.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();