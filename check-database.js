const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your database file
const dbPath = path.join(__dirname, 'database', 'student_portal.db');

console.log('Checking database at:', dbPath);

// Open the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to SQLite database');
});

// Check students table
db.all('SELECT * FROM students', (err, rows) => {
    if (err) {
        console.error('Error reading students:', err.message);
    } else {
        console.log('\nStudents in database:');
        if (rows.length === 0) {
            console.log('No students found in database');
        } else {
            rows.forEach(row => {
                console.log(`ID: ${row.id}, Name: ${row.name}, Username: ${row.username}, Email: ${row.email}`);
            });
        }
    }
    
    // Check classes table
    db.all('SELECT * FROM classes', (err, classes) => {
        if (err) {
            console.error('Error reading classes:', err.message);
        } else {
            console.log('\nClasses in database:');
            if (classes.length === 0) {
                console.log('No classes found in database');
            } else {
                classes.forEach(cls => {
                    console.log(`ID: ${cls.id}, Code: ${cls.code}, Name: ${cls.name}, Professor: ${cls.professor}`);
                });
            }
        }
        
        // Close database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('\nDatabase connection closed');
            }
        });
    });
});