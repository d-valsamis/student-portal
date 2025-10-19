const express = require('express');
const router = express.Router();
const pool = require('../models/database');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for assignment file uploads (ADD THIS)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/assignments');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Keep original filename but sanitize it
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const safeFileName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, Date.now() + '_' + safeFileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});


// Get assignments by subject
router.get('/', auth, async (req, res) => {
    try {
        const { subject_id } = req.query;
        let query = 'SELECT * FROM assignments';
        let params = [];

        if (subject_id) {
            query += ' WHERE subject_id = $1 ORDER BY due_date DESC';
            params = [subject_id];
        } else {
            query += ' ORDER BY due_date DESC';
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific assignment by ID - ADD THIS ROUTE
router.get('/:id', auth, async (req, res) => {
    try {
        const assignmentId = req.params.id;
        
        const { rows } = await pool.query(
            'SELECT * FROM assignments WHERE id = $1',
            [assignmentId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error fetching assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new assignment
router.post('/', auth, async (req, res) => {
    try {
        const { subject_id, title, description, due_date } = req.body;
        
        const { rows } = await pool.query(
            'INSERT INTO assignments (subject_id, title, description, due_date) VALUES ($1, $2, $3, $4) RETURNING *',
            [subject_id, title, description, due_date]
        );
        
        res.json({ message: 'Assignment created successfully', assignmentId: rows[0].id });
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get assignments for a student with submission status (student)
router.get('/students/:id/assignments', auth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const subjectId = req.query.subjectId;
        
        console.log('Fetching assignments for student:', studentId, 'subject:', subjectId);
        
        // Verify the student is accessing their own data
        if (req.user.id != studentId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        let query = `
            SELECT 
                a.id,
                a.title,
                a.description,
                a.due_date,
                a.pdf_path as attachment,
                a.subject_id,
                s.name as subject_name,
                sub.id as submission_id,
                sub.submission_date,
                sub.submission_file,
                sub.status as submission_status,
                CASE 
                    WHEN sub.id IS NOT NULL THEN 'submitted'
                    WHEN a.due_date < CURRENT_TIMESTAMP THEN 'overdue'
                    ELSE 'pending'
                END as display_status
            FROM assignments a
            JOIN subjects s ON a.subject_id = s.id
            LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.student_id = $1
            WHERE 1=1
        `;
        
        let params = [studentId];
        
        if (subjectId) {
            query += ' AND a.subject_id = $2';
            params.push(subjectId);
        }
        
        query += ' ORDER BY a.due_date ASC';
        
        console.log('Executing assignments query:', query);
        console.log('With params:', params);
        
        const result = await pool.query(query, params);
        console.log('Assignments result:', result.rows.length, 'assignments found');
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Download assignment file (student & admin)
router.get('/:id/files/:filename', auth, async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const filename = req.params.filename;
        
        console.log('=== ASSIGNMENT FILE DOWNLOAD DEBUG ===');
        console.log('Assignment ID:', assignmentId);
        console.log('Filename:', filename);

        // Look for the file in uploads/assignments directory
        const filePath = path.join(__dirname, '../uploads/assignments', filename);
        
        console.log('Looking for file at:', filePath);
        console.log('File exists:', fs.existsSync(filePath));

        if (!fs.existsSync(filePath)) {
            console.log('❌ File not found at:', filePath);
            
            // Also check the old location for backward compatibility
            const oldFilePath = path.join(__dirname, '../uploads', filename);
            console.log('Checking old location:', oldFilePath);
            console.log('File exists in old location:', fs.existsSync(oldFilePath));
            
            if (fs.existsSync(oldFilePath)) {
                console.log('✅ File found in old location, serving download...');
                return res.download(oldFilePath, filename);
            }
            
            return res.status(404).json({ error: 'File not found' });
        }
        
        console.log('✅ File found in assignments folder, serving download...');
        res.download(filePath, filename);
        
    } catch (error) {
        console.error('❌ Error serving assignment file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;