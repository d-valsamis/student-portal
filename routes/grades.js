const express = require('express');
const router = express.Router();
const db = require('../models/database');
const auth = require('../middleware/authMiddleware');

// Get student's grades with optional subject filter
router.get('/:id/grades', auth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const subjectId = req.query.subjectId;
        
        console.log('Fetching grades for student:', studentId, 'subject:', subjectId);
        
        // Verify the student is accessing their own data
        if (req.user.id != studentId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        let query = `
            SELECT 
                g.*,
                a.title as assignment_name,
                a.description,
                a.due_date,
                s.name as subject_name,
                s.id as subject_id
            FROM grades g
            JOIN assignments a ON g.assignment_id = a.id
            JOIN subjects s ON a.subject_id = s.id
            WHERE g.student_id = $1
        `;
        
        let params = [studentId];
        
        if (subjectId) {
            query += ' AND s.id = $2';
            params.push(subjectId);
        }
        
        query += ' ORDER BY a.due_date DESC';
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const result = await db.query(query, params);
        console.log('Query result:', result.rows);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching grades:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});
// Add this route for the admin panel
router.get('/grades', auth, async (req, res) => {
    try {
        const assignmentId = req.query.assignment_id;
        
        // Verify user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!assignmentId) {
            return res.status(400).json({ error: 'assignment_id parameter is required' });
        }

        const query = `
            SELECT 
                g.*,
                s.id as student_id,
                s.name as student_name,
                s.email as student_email,
                sub.name as subject_name
            FROM grades g
            RIGHT JOIN students s ON g.student_id = s.id
            JOIN assignments a ON a.id = $1
            JOIN subjects sub ON a.subject_id = sub.id
            WHERE (g.assignment_id = $1 OR g.assignment_id IS NULL)
            ORDER BY s.name
        `;
        
        const result = await db.query(query, [assignmentId]);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching assignment grades:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create or update grades (for admin)
router.post('/grades', auth, async (req, res) => {
    try {
        const { assignment_id, student_id, score, letter_grade, feedback } = req.body;
        
        console.log('Saving grade:', { assignment_id, student_id, score, letter_grade, feedback });
        
        // Verify user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!assignment_id || !student_id) {
            return res.status(400).json({ error: 'assignment_id and student_id are required' });
        }

        // Validate data types
        if (score && (isNaN(score) || score < 0 || score > 100)) {
            return res.status(400).json({ error: 'Score must be a number between 0 and 100' });
        }

        // Check if grade already exists
        const checkQuery = 'SELECT id FROM grades WHERE assignment_id = $1 AND student_id = $2';
        const checkResult = await db.query(checkQuery, [assignment_id, student_id]);
        console.log('Check result:', checkResult.rows);

        let result;
        if (checkResult.rows.length > 0) {
            // Update existing grade
            console.log('Updating existing grade');
            const updateQuery = `
    UPDATE grades 
    SET score = $1, letter_grade = $2, feedback = $3
    WHERE assignment_id = $4 AND student_id = $5
    RETURNING *
`;
            result = await db.query(updateQuery, [score, letter_grade, feedback, assignment_id, student_id]);
            console.log('Updated grade:', result.rows[0]);
        } else {
            // Insert new grade
            console.log('Creating new grade');
            const insertQuery = `
                INSERT INTO grades (assignment_id, student_id, score, letter_grade, feedback)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `;
            result = await db.query(insertQuery, [assignment_id, student_id, score, letter_grade, feedback]);
            console.log('Created grade:', result.rows[0]);
        }

        res.json({ 
            success: true, 
            message: 'Grade saved successfully',
            grade: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error saving grade:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            code: error.code
        });
    }
});
module.exports = router;