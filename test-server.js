const express = require('express');
const app = express();
const PORT = 5000;

// Add CORS to allow browser requests
const cors = require('cors');
app.use(cors());

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Another test route that simulates your students API
app.get('/api/test-students', (req, res) => {
    res.json([ 
        { id: 1, name: 'Test Student 1', username: 'test1' },
        { id: 2, name: 'Test Student 2', username: 'test2' }
    ]);
});

// Start server
app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log(`Test URL: http://localhost:${PORT}/test`);
    console.log(`API test URL: http://localhost:${PORT}/api/test-students`);
});