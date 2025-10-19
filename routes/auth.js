const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models/database'); // This now imports the PostgreSQL pool

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user in database
    const result = await db.query(
      'SELECT * FROM students WHERE username = $1', 
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const student = result.rows[0];
    
    // Check password
    if (bcrypt.compareSync(password, student.password)) {
      // Create token - IMPORTANT: Replace 'your_jwt_secret' with your actual secret from .env
      const token = jwt.sign(
        { id: student.id, username: student.username },
        process.env.JWT_SECRET || 'your_jwt_secret', // Use environment variable for secret
        { expiresIn: '24h' }
      );
      
      res.json({
        token,
        student: {
          id: student.id,
          username: student.username,
          name: student.name,
          email: student.email
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
