// server.js (or your main server file)
require('dotenv').config(); // Loads variables from .env into process.env
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const subjectRoutes = require('./routes/subjects');
const classRoutes = require('./routes/classes'); 
const adminRoutes = require('./routes/admin'); // Make sure this exists
const assignmentsRoutes = require('./routes/assignments');
const attendanceRoutes = require('./routes/attendance');
const gradesRoutes = require('./routes/grades');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // ADD THIS
const bcrypt = require('bcryptjs'); // ADD THIS

const app = express();
const PORT = process.env.PORT || 5000;

// ADD THIS AUTHENTICATION MIDDLEWARE DEFINITION
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};
// Middleware - IMPORTANT: Order matters!
app.use(cors());

// 1. Create parsers (but don't use them globally)
const jsonParser = express.json({ limit: '50mb' });
const urlencodedParser = express.urlencoded({ limit: '50mb', extended: true });

// 2. Then logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
// 3. Apply JSON parser to specific routes that need it
app.use('/api/auth', jsonParser, urlencodedParser);
app.use('/api/admin/login', jsonParser, urlencodedParser);
app.use('/api/students', jsonParser, urlencodedParser);
app.use('/api/subjects', jsonParser, urlencodedParser);
app.use('/api/classes', jsonParser, urlencodedParser);
app.use('/api/admin', jsonParser, urlencodedParser);
app.use('/api/assignments', jsonParser, urlencodedParser);
app.use('/api/grades', jsonParser, urlencodedParser);
app.use('/api/submissions', urlencodedParser);


// Routes - PROTECT ADMIN ROUTES WITH AUTHENTICATION
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classes', authenticateToken, classRoutes); // PROTECT CLASSES
app.use('/api/admin', adminRoutes); // Auth handled in individual routes
app.use('/api/assignments', authenticateToken, assignmentsRoutes);
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/students', require('./routes/attendance'));
app.use('/api/students', require('./routes/grades'));

// Error handling middleware for multer - ADD THIS
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

// Serve the login pages
app.get('/adminlogin', (req, res) => {
  res.sendFile(path.join(__dirname, 'adminlogin.html')); // Your new admin login page
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html')); // Student login page
});

app.get('/test-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-login.html'));
});

// Serve the admin panel page (protected - redirect to login if not authenticated)
app.get('/admin-panel', (req, res) => {
  // You might want to add some client-side authentication check here
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});
// Also add a root redirect to adminlogin for convenience
app.get('/', (req, res) => {
  res.redirect('/adminlogin');
});
// ADD A LOGOUT ENDPOINT (optional)
app.post('/api/admin/logout', (req, res) => {
    // Client-side should remove the token, but this provides a server-side endpoint
    res.json({ message: 'Logout successful' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Admin login available at: http://localhost:${PORT}/adminlogin`);
    console.log(`Admin panel available at: http://localhost:${PORT}/admin-panel`);
});