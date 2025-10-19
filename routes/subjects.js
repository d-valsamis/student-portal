const express = require('express');
const db = require('../models/database'); // Make sure this path is correct

const router = express.Router();

// GET all subjects
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subjects ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET a specific subject by ID (THIS IS YOUR EXISTING ENDPOINT - KEEP IT)
router.get('/:id', async (req, res) => {
  try {
    const subjectId = req.params.id;
    
    const result = await db.query(
      'SELECT * FROM subjects WHERE id = $1',
      [subjectId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET all classes for a specific subject (ADD THIS NEW ENDPOINT)
router.get('/:id/classes', async (req, res) => {
  try {
    const subjectId = req.params.id;
    
    const result = await db.query(
      `SELECT * FROM classes 
       WHERE subject_id = $1 
       ORDER BY opening_date DESC`,
      [subjectId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;