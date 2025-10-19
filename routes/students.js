const express = require('express');
const db = require('../models/database');

const router = express.Router();

// Get student's enrolled subjects (previously classes)
router.get('/:id/classes', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    // CHANGED: The SQL query below now uses 'subjects' instead of 'classes'
    const result = await db.query(
      `SELECT subjects.* FROM subjects 
      INNER JOIN enrollment ON subjects.id = enrollment.subject_id
       WHERE enrollment.student_id = $1`,
      [studentId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get student profile
router.get('/:id', async (req, res) => {
  try {
    const studentId = req.params.id;
    
    const result = await db.query(
      'SELECT id, username, name, email FROM students WHERE id = $1',
      [studentId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all students
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, email FROM students'
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
// GET a specific student by ID (for student portal)
router.get('/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const result = await db.query('SELECT id, name, username, email FROM students WHERE id = $1', [studentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/assignments', async (req, res) => {
    try {
        const studentId = req.params.id;
        const subjectId = req.query.subjectId;
        
        console.log('=== ASSIGNMENTS DEBUG ===');
        console.log('Student ID:', studentId);
        console.log('Subject ID:', subjectId);

        // SIMPLIFIED QUERY - Remove the complex subquery
        let query = `
            SELECT 
                a.id,
                a.title,
                a.description,
                a.due_date,
                a.pdf_path,
                a.subject_id,
                s.name as subject_name,
                sub.id as submission_id,
                sub.submission_file,
                sub.submission_date,
                sub.status as submission_status
            FROM assignments a
            JOIN subjects s ON a.subject_id = s.id
            JOIN enrollment e ON a.subject_id = e.subject_id AND e.student_id = $1
            LEFT JOIN submissions sub ON a.id = sub.assignment_id AND sub.student_id = $1
            WHERE 1=1
        `;
        
        let params = [studentId];
        
        if (subjectId) {
            query += ' AND a.subject_id = $2';
            params.push(subjectId);
        }
        
        query += ' ORDER BY a.due_date ASC';
        
        console.log('Query:', query);
        console.log('Params:', params);

        const result = await db.query(query, params);
        
        console.log('Database result rows:', result.rows.length);
        console.log('Raw result:', result.rows);

        // Process the results to handle file names
        const assignments = result.rows.map(assignment => {
            let attachment = null;
            let originalName = null;
            
            if (assignment.pdf_path) {
    console.log('🔍 Processing pdf_path:', assignment.pdf_path);
    
    // Handle the format: "Original Name,System Name"
    const fileParts = assignment.pdf_path.split(',');
    if (fileParts.length === 2) {
        originalName = fileParts[0];
        attachment = fileParts[1]; // Use system name for the download
    } else if (assignment.pdf_path.startsWith('/uploads/assignments/')) {
        // If it's a full path like "/uploads/assignments/filename.pdf", extract just the filename
        attachment = assignment.pdf_path.replace('/uploads/assignments/', '');
        originalName = attachment;
    } else if (assignment.pdf_path.startsWith('/uploads/')) {
        // If it's in the old location
        attachment = assignment.pdf_path.replace('/uploads/', '');
        originalName = attachment;
    } else {
        // If it's already just a filename
        attachment = assignment.pdf_path;
        originalName = attachment;
    }
    
    console.log('🔍 Result - attachment:', attachment, 'originalName:', originalName);
}
            
            const processedAssignment = {
                id: assignment.id,
                title: assignment.title,
                description: assignment.description,
                due_date: assignment.due_date,
                subject_id: assignment.subject_id,
                subject_name: assignment.subject_name,
                attachment: attachment,
                original_filename: originalName,
                submission_id: assignment.submission_id,
                submission_file: assignment.submission_file,
                submission_date: assignment.submission_date,
                submission_status: assignment.submission_status || 'pending'
            };
            
            console.log('Processed assignment:', processedAssignment);
            return processedAssignment;
        });
        
        console.log('Final assignments array:', assignments);
        res.json(assignments);
        
    } catch (error) {
        console.error('Error fetching student assignments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
module.exports = router;