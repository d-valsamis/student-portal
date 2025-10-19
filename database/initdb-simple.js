// initdb-simple.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/student_portal.db');

console.log('Testing simple database operations...');

// Test with just ONE simple table
db.run('CREATE TABLE IF NOT EXISTS test_table (id INTEGER, name TEXT)', function(err) {
    if (err) {
        console.error('Error with simple table:', err.message);
    } else {
        console.log('Simple table created successfully');
    }
    db.close();
});