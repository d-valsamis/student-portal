const express = require('express');
const router = express.Router();
const db = require('../models/database');
const auth = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for submission file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/submissions');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
   filename: function (req, file, cb) {
    // Keep original filename but sanitize it
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeFileName = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    
    // Make sure we have studentId from the authenticated user
    const studentId = req.user.id || req.body.studentId || 'unknown';
    
    console.log('Submission upload - studentId:', studentId, 'user:', req.user);
    
    cb(null, studentId + '_' + Date.now() + '_' + safeFileName);
},
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Submit assignment
router.post('/', auth, upload.single('submissionFile'), async (req, res) => {
    try {
       
        
        console.log('=== SUBMISSION UPLOAD DEBUG ===');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        
        const assignmentId = req.body.assignmentId;
        const studentId = req.body.studentId;
        
        console.log('Processing submission for assignment:', assignmentId, 'student:', studentId);
        
        // Verify the student is submitting their own work
        if (req.user.id != studentId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!assignmentId || !studentId) {
            return res.status(400).json({ error: 'assignmentId and studentId are required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Check if submission already exists
        const checkQuery = 'SELECT id FROM submissions WHERE assignment_id = $1 AND student_id = $2';
        const checkResult = await db.query(checkQuery, [assignmentId, studentId]);

        let result;
        if (checkResult.rows.length > 0) {
            // Update existing submission
            const updateQuery = `
                UPDATE submissions 
                SET submission_file = $1, submission_date = CURRENT_TIMESTAMP, status = 'submitted'
                WHERE assignment_id = $2 AND student_id = $3
                RETURNING *
            `;
            result = await db.query(updateQuery, [req.file.filename, assignmentId, studentId]);
            console.log('Updated submission:', result.rows[0]);
        } else {
            // Create new submission
            const insertQuery = `
                INSERT INTO submissions (assignment_id, student_id, submission_file, submission_date, status)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'submitted')
                RETURNING *
            `;
            result = await db.query(insertQuery, [assignmentId, studentId, req.file.filename]);
            console.log('Created submission:', result.rows[0]);
        }

        res.json({ 
            success: true, 
            message: 'Assignment submitted successfully',
            submission: result.rows[0],
            file: req.file.filename
        });
        
    } catch (error) {
        console.error('Error submitting assignment:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Download submission file with proper naming
router.get('/:id/files/:filename', auth, async (req, res) => {
    try {
        const submissionId = req.params.id;
        const filename = req.params.filename;
        
        console.log('Downloading submission file:', filename, 'for submission:', submissionId);
        
        const filePath = path.join(__dirname, '../uploads/submissions', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Get submission details to create a nice filename
        const submissionQuery = `
            SELECT s.name as student_name, a.title as assignment_title, sub.submission_date
            FROM submissions sub
            JOIN students s ON sub.student_id = s.id
            JOIN assignments a ON sub.assignment_id = a.id
            WHERE sub.id = $1
        `;
        
        const submissionResult = await db.query(submissionQuery, [submissionId]);
        
        let downloadName = filename; // fallback to original name
        
        if (submissionResult.rows.length > 0) {
            const submission = submissionResult.rows[0];
            const date = new Date(submission.submission_date).toISOString().split('T')[0];
            const originalExt = path.extname(filename);
            
            // Create human-readable name: "StudentName_AssignmentTitle_Date.pdf"
            downloadName = `${submission.student_name}_${submission.assignment_title}_${date}${originalExt}`
                .replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Sanitize for filename safety
        }
        
        res.download(filePath, downloadName);
        
    } catch (error) {
        console.error('Error serving submission file:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;