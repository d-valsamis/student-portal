
// database.js - Updated for PostgreSQL
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Create a new Pool instance. The Pool manages multiple client connections.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add these for better stability and to avoid common errors on PaaS platforms
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // Often needed for PaaS like Railway
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test the connection immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring client from PostgreSQL pool:', err.stack);
  } else {
    console.log('Successfully connected to PostgreSQL database.');
    release(); // Release the client back to the pool
  }
});

// Listen for errors on the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(-1);
});

// Export the pool so other files can use it to run queries
module.exports = pool;