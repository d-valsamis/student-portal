const express = require('express');
const db = require('../models/database'); // This now imports the PostgreSQL pool
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// ========== SIMPLIFIED LOGIN ROUTE FOR TESTING ==========
// Admin login route (should be PUBLIC - no auth required)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Hardcoded credentials for testing
    const hardcodedUsername = 'admin';
    const hardcodedPassword = 'password';

    // Check credentials
    if (username !== hardcodedUsername || password !== hardcodedPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        username: username,
        role: 'admin' 
      }, 
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        username: username
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
// ========== END OF LOGIN ROUTE ==========

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
// For assignment PDF uploads - use assignments folder
const assignmentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/assignments');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const assignmentUpload = multer({ 
    storage: assignmentStorage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// Update the assignment PDF upload route to use the correct multer instance
router.post('/assignments/:id/pdf', auth, assignmentUpload.single('assignmentPdf'), async (req, res) => {
    // ... rest of your existing code
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB file size limit
  }
});

// Add new student
router.post('/students', async (req, res) => {
  try {
    const { name, username, email, password } = req.body;

    // Check if student already exists
    const studentCheck = await db.query(
      'SELECT * FROM students WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (studentCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Student already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new student
    const result = await db.query(
      'INSERT INTO students (name, username, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, username, email, hashedPassword]
    );

    res.json({
      message: 'Student created successfully',
      studentId: result.rows[0].id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new subject
router.post('/subjects', async (req, res) => {
  try {
    const { name, professor, teacheremail, teachertelephone, description } = req.body;
    
    const result = await db.query(
      'INSERT INTO subjects (name, professor, teacheremail, teachertelephone, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [name, professor, teacheremail || null, teachertelephone || null, description || null]
    );
    
    res.json({
      message: 'Subject created successfully',
      subjectId: result.rows[0].id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// **********************************************************
// REMOVED: The entire '/classes' and '/classes/:id/files' endpoint block.
// The 'classes' table no longer exists; it was renamed to 'subjects'.
// File uploads should be handled at the subject or note level.
// **********************************************************

// Enroll student in subject
router.post('/enrollments', async (req, res) => {
  try {
    const { studentId, subjectId } = req.body;

    // Check if enrollment already exists
    const enrollmentCheck = await db.query(
      'SELECT * FROM enrollment WHERE student_id = $1 AND subject_id = $2', // CHANGED: Check 'enrollment' table and 'class_id' column
      [studentId, subjectId]
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Student is already enrolled in this subject' });
    }

    // Create enrollment
    await db.query(
      'INSERT INTO enrollment (student_id, subject_id) VALUES ($1, $2)', // CHANGED: Insert into 'enrollment' table using 'class_id' column
      [studentId, subjectId]
    );

    res.json({ message: 'Student enrolled in subject successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Get all enrollments
router.get('/enrollments', async (req, res) => {
    try {
        const { subject_id } = req.query;
        
        // If subject_id is provided, get enrollments for that subject
        if (subject_id) {
            const { rows } = await db.query(  // ✅ CHANGED: pool -> db
                `SELECT e.*, s.id as student_id, s.name, s.username, s.email 
                 FROM enrollment e 
                 JOIN students s ON e.student_id = s.id 
                 WHERE e.subject_id = $1`,
                [subject_id]
            );
            
            // Format response to include student object
            const enrollments = rows.map(row => ({
                id: row.id,
                student_id: row.student_id,
                subject_id: row.subject_id,
                enrolled_at: row.enrolled_at,
                student: {
                    id: row.student_id,
                    name: row.name,
                    username: row.username,
                    email: row.email
                }
            }));
            
            return res.json(enrollments);
        }
        
        // If no subject_id, return all enrollments
        const { rows } = await db.query(  // ✅ CHANGED: pool -> db
            'SELECT * FROM enrollment ORDER BY enrolled_at DESC'
        );
        res.json(rows);
        
    } catch (error) {
        console.error('Error fetching enrollments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove enrollment
router.delete('/enrollments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM enrollment WHERE id = $1', [id]); // CHANGED: from 'enrollments' to 'enrollment'
    res.json({ message: 'Enrollment removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Delete assignment
router.delete('/assignments/:id', auth, async (req, res) => {
    try {
        const assignmentId = req.params.id;
        
        // Check if assignment exists
        const checkResult = await db.query('SELECT * FROM assignments WHERE id = $1', [assignmentId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        // Delete the assignment
        await db.query('DELETE FROM assignments WHERE id = $1', [assignmentId]);
        
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Add note with optional PDF upload
router.post('/notes', upload.single('pdf'), async (req, res) => {
  try {
    const { subjectId, title, content } = req.body; // CHANGED: from 'classId' to 'subjectId'
    const pdfPath = req.file ? req.file.path : null;

    console.log('File upload details:', req.file);
    console.log('Form data:', { subjectId, title, content }); // CHANGED: Log 'subjectId'

    const result = await db.query(
      'INSERT INTO notes (class_id, title, content, pdf_path) VALUES ($1, $2, $3, $4) RETURNING id', // Note: Keeping 'class_id' column name in notes table
      [subjectId, title, content, pdfPath] // CHANGED: variable name
    );

    res.json({
      message: 'Note added successfully',
      noteId: result.rows[0].id,
      filePath: pdfPath
    });

  } catch (error) {
    // Delete uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (unlinkErr) => {
        if (unlinkErr) console.error('Error deleting file:', unlinkErr);
      });
    }
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Add assignment
router.post('/assignments', auth, async (req, res) => {
  try {
    const { subjectId, title, description, dueDate } = req.body; // CHANGED: from 'classId' to 'subjectId'

    const result = await db.query(
      'INSERT INTO assignments (subject_id, title, description, due_date) VALUES ($1, $2, $3, $4) RETURNING id', // Note: Keeping 'class_id' column name in assignments table
      [subjectId, title, description, dueDate] // CHANGED: variable name
    );

    res.json({
      message: 'Assignment added successfully',
      assignmentId: result.rows[0].id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Add assignment PDF upload endpoint
router.post('/assignments/:id/pdf', auth, upload.single('assignmentPdf'), async (req, res) => {
    try {
        const assignmentId = req.params.id;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // NEW LOGIC: Save both original and system name in a single string
        const systemName = req.file.filename;
        const originalName = req.file.originalname; // Get the original uploaded name
        const pdfPath = `/uploads/${systemName}`;

        // Store both names in the format: "Original Name,System Name"
        const fileNames = `${originalName},${systemName}`;

        await db.query(
            'UPDATE assignments SET pdf_path = $1 WHERE id = $2',
            [fileNames, assignmentId] // Now stores "My Assignment.pdf,1758405448172-753720332.pdf"
        );

        res.json({ 
            message: 'PDF uploaded successfully',
            filePath: pdfPath,
            originalName: originalName // You can also send back the original name if needed
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get all students (for dropdowns)
router.get('/students', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, email FROM students ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// **********************************************************
// REMOVED: The '/classes' dropdown endpoint. The table is gone.
// Use the '/subjects' endpoint below for dropdowns instead.
// **********************************************************

// GET all subjects (for dropdown)
router.get('/subjects', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subjects ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get enrollments for a specific student
router.get('/students/:id/enrollments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
    SELECT s.id, s.name, s.professor, s.teacheremail, s.teachertelephone
    FROM subjects s
    JOIN enrollment e ON s.id = e.subject_id  // FIXED: 'class_id' -> 'subject_id'
    WHERE e.student_id = $1
`, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// GET a specific subject by ID
router.get('/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        const result = await db.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE a subject
router.put('/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        const { name, professor, teacheremail, teachertelephone, description } = req.body;
        
        const result = await db.query(
            `UPDATE subjects 
             SET name = $1, professor = $2, teacheremail = $3, teachertelephone = $4, description = $5 
             WHERE id = $6 
             RETURNING *`,
            [name, professor, teacheremail, teachertelephone, description, subjectId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }
        
        res.json({ 
            message: 'Subject updated successfully',
            subject: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE a subject
router.delete('/subjects/:id', async (req, res) => {
    try {
        const subjectId = req.params.id;
        
        // Check if subject exists
        const checkResult = await db.query('SELECT * FROM subjects WHERE id = $1', [subjectId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }
        
        // Delete the subject
        await db.query('DELETE FROM subjects WHERE id = $1', [subjectId]);
        
        res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// Get submission details with student information
router.get('/:id/details', auth, async (req, res) => {
    try {
        const submissionId = req.params.id;
        
        const query = `
            SELECT 
                sub.*,
                s.name as student_name,
                s.username as student_username,
                a.title as assignment_title
            FROM submissions sub
            JOIN students s ON sub.student_id = s.id
            JOIN assignments a ON sub.assignment_id = a.id
            WHERE sub.id = $1
        `;
        
        const result = await db.query(query, [submissionId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        const submission = result.rows[0];
        
        // Format the response with human-readable info
        const formattedSubmission = {
            id: submission.id,
            student_name: submission.student_name,
            student_username: submission.student_username,
            assignment_title: submission.assignment_title,
            submission_file: submission.submission_file,
            submission_date: submission.submission_date,
            status: submission.status,
            // Add human-readable filename suggestion
            suggested_download_name: `${submission.student_name}_${submission.assignment_title}_${new Date(submission.submission_date).toISOString().split('T')[0]}.pdf`
        };
        
        res.json(formattedSubmission);
        
    } catch (error) {
        console.error('Error fetching submission details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET a specific student by ID (for admin)
router.get('/students/:id', async (req, res) => {
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

// UPDATE a student
router.put('/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        const { name, username, email, password } = req.body;
        
        let query, params;
        
        if (password) {
            // Update with password
            query = `UPDATE students 
                     SET name = $1, username = $2, email = $3, password = $4 
                     WHERE id = $5 
                     RETURNING id, name, username, email`;
            params = [name, username, email, password, studentId];
        } else {
            // Update without password
            query = `UPDATE students 
                     SET name = $1, username = $2, email = $3 
                     WHERE id = $4 
                     RETURNING id, name, username, email`;
            params = [name, username, email, studentId];
        }
        
        const result = await db.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        res.json({ 
            message: 'Student updated successfully',
            student: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE a student
router.delete('/students/:id', async (req, res) => {
    try {
        const studentId = req.params.id;
        
        // Check if student exists
        const checkResult = await db.query('SELECT * FROM students WHERE id = $1', [studentId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Delete the student
        await db.query('DELETE FROM students WHERE id = $1', [studentId]);
        
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Update assignment
router.put('/assignments/:id', auth, async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const { title, description, due_date } = req.body;
        
        const result = await db.query(
            `UPDATE assignments 
             SET title = $1, description = $2, due_date = $3 
             WHERE id = $4 
             RETURNING *`,
            [title, description, due_date, assignmentId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json({ 
            message: 'Assignment updated successfully',
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
// Update assignment
router.put('/assignments/:id', auth, async (req, res) => {
    try {
        const assignmentId = req.params.id;
        const { title, description, due_date } = req.body;
        
        const result = await db.query(
            `UPDATE assignments 
             SET title = $1, description = $2, due_date = $3 
             WHERE id = $4 
             RETURNING *`,
            [title, description, due_date, assignmentId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        res.json({ 
            message: 'Assignment updated successfully',
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;