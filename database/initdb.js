const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Smart path detection - works whether initdb.js is in root or database folder
let dbPath = path.join(__dirname, 'student_portal.db');
if (!fs.existsSync(path.dirname(dbPath))) {
    // If we're in root folder, database should be in database subfolder
    dbPath = path.join(__dirname, 'database', 'student_portal.db');
}

console.log('Database path:', dbPath);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Students table
    db.run(`CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )`);
    
    // Classes table
    db.run(`CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        professor TEXT NOT NULL
    )`);
    
    // Enrollment table
    db.run(`CREATE TABLE IF NOT EXISTS enrollment (
        student_id INTEGER,
        class_id INTEGER,
        FOREIGN KEY(student_id) REFERENCES students(id),
        FOREIGN KEY(class_id) REFERENCES classes(id),
        PRIMARY KEY(student_id, class_id)
    )`);
    
    // Notes table
   db.run(`CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    pdf_path TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id)
)`);
    
    // Assignments table
    db.run(`CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATE,
        FOREIGN KEY(class_id) REFERENCES classes(id)
    )`);
    
    // Insert sample classes
    const classes = [
        ['MATH101', 'Calculus I', 'Prof. Johnson'],
        ['CS105', 'Introduction to Programming', 'Prof. Martinez'],
        ['PHYS110', 'General Physics', 'Prof. Thompson'],
        ['ENG101', 'English Composition', 'Prof. Williams']
    ];
    
    const stmt = db.prepare("INSERT INTO classes (code, name, professor) VALUES (?, ?, ?)");
    for (const [code, name, professor] of classes) {
        stmt.run(code, name, professor);
    }
    stmt.finalize();
    
    // Insert sample student with hashed password
    const hashedPassword = bcrypt.hashSync('password123', 10);
    db.run("INSERT INTO students (username, password, name, email) VALUES (?, ?, ?, ?)", 
        ['student1', hashedPassword, 'John Doe', 'john.doe@example.com']);
    
    // Enroll student in classes
    db.run("INSERT INTO enrollment (student_id, class_id) VALUES (1, 1)");
    db.run("INSERT INTO enrollment (student_id, class_id) VALUES (1, 2)");
    
    console.log('Database tables created successfully');
    console.log('Sample data inserted');
    db.close() ;
});

