const express = require('express');
const router = express.Router();
const db = require('../models/database');
const auth = require('../middleware/authMiddleware');

// Get student's attendance with optional subject filter
// Get student's attendance with optional subject filter
router.get('/:id/attendance', auth, async (req, res) => {
    try {
        const studentId = req.params.id;
        const subjectId = req.query.subjectId;
        
        console.log('Fetching attendance for student:', studentId, 'subject:', subjectId);
        
        // Verify the student is accessing their own data
        if (req.user.id != studentId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

              let query = `
            SELECT 
                c.id as class_id,
                c.name as class_name,
                c.opening_date as class_date,
                s.name as subject_name,
                s.id as subject_id,
                COALESCE(a.status, 'Present') as status,
                a.date as attendance_date,
                a.notes
            FROM classes c
            JOIN subjects s ON c.subject_id = s.id
            LEFT JOIN attendance a ON c.id = a.class_id AND a.student_id = $1
            WHERE c.opening_date <= CURRENT_DATE AND c.closing_date >= CURRENT_DATE
        `;
        
        let params = [studentId];
        
        if (subjectId) {
            query += ' AND s.id = $2';
            params.push(subjectId);
        }
        
        query += ' ORDER BY c.opening_date DESC';
        
        console.log('Executing query:', query);
        console.log('With params:', params);
        
        const result = await db.query(query, params);
        console.log('Query result:', result.rows);
        
        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

module.exports = router;