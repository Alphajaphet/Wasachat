const { Pool } = require('pg');
require('dotenv').config();

// Render/Railway provide DATABASE_URL automatically.
// SSL is required on most managed Postgres hosts in production.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;