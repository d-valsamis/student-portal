const express = require('express');
const db = require('../models/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure multer for file uploads for THIS specific router
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create a unique filename
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

// GET all classes
router.get('/', async (req, res) => {
    try {
        const { subject_id } = req.query;
        let query = 'SELECT * FROM classes';
        let params = [];

        if (subject_id) {
            query += ' WHERE subject_id = $1 ORDER BY opening_date DESC';
            params = [subject_id];
        } else {
            query += ' ORDER BY opening_date DESC';
        }

        const { rows } = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST create a new class
router.post('/', async (req, res) => {
    try {
        const { code, name, subject_id, opening_date, closing_date, file_names } = req.body;

        const result = await db.query(
            `INSERT INTO classes (code, name, subject_id, opening_date, closing_date, file_names) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING *`,
            [code, name, subject_id, opening_date, closing_date, file_names || null]
        );

        res.json({
            message: 'Class created successfully',
            classId: result.rows[0].id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// POST upload files for a specific class
router.post('/:id/files', upload.array('files', 10), async (req, res) => {
    try {
        const classId = req.params.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // 1. Get current file names from the database
        const classResult = await db.query('SELECT file_names FROM classes WHERE id = $1', [classId]);
        let currentFileNames = [];
        if (classResult.rows.length > 0 && classResult.rows[0].file_names) {
            currentFileNames = classResult.rows[0].file_names.split(',');
        }

        // 2. Add new file names to the list as pairs: originalName,systemName
        const newFilePairs = files.map(file => `${file.originalname},${file.filename}`);
        const allFileNames = currentFileNames ? 
            `${currentFileNames},${newFilePairs.join(',')}` : 
            newFilePairs.join(',');

        // 3. Update the class with the new combined list of file names
        await db.query('UPDATE classes SET file_names = $1 WHERE id = $2', [allFileNames, classId]);

        res.json({
            message: 'Files uploaded successfully',
            fileCount: files.length,
            fileNames: newFileNames
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get file information for a specific class - FIXED VERSION
router.get('/:id/files', async (req, res) => {
    try {
        const classId = req.params.id;
        
        const result = await db.query(
            'SELECT file_names FROM classes WHERE id = $1',
            [classId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const fileNamesString = result.rows[0].file_names;
        let files = [];
        
        if (fileNamesString) {
            const fileNames = fileNamesString.split(',');
            
            // Group into pairs: [originalName, systemName]
            for (let i = 0; i < fileNames.length; i += 2) {
                if (i + 1 < fileNames.length) {
                    const originalName = fileNames[i];
                    const systemName = fileNames[i + 1];
                    
                    // Only add valid pairs (both names exist)
                    if (originalName && systemName) {
                        files.push({
                            originalName: originalName,
                            systemName: systemName,
                            downloadUrl: `/classes/${classId}/files/${originalName}`
                        });
                    }
                }
            }
        }
        
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});
// GET download a specific file
router.get('/:id/files/:filename', async (req, res) => {
    try {
        const classId = req.params.id;
        const requestedFileName = req.params.filename;

        // Get the file names from the database
        const result = await db.query(
            'SELECT file_names FROM classes WHERE id = $1',
            [classId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        const fileNamesString = result.rows[0].file_names;
        if (!fileNamesString) {
            return res.status(404).json({ error: 'No files found for this class' });
        }

        // Parse the file names correctly
        const fileNames = fileNamesString.split(',');
        
        // Find the requested file - handle both original and system names
        let fileIndex = -1;
        let isSystemName = false;
        
        // Check if it's a system name (contains timestamp)
        if (requestedFileName.match(/^\d+-/)) {
            fileIndex = fileNames.indexOf(requestedFileName);
            isSystemName = true;
        } else {
            // It's an original name - find its position
            fileIndex = fileNames.indexOf(requestedFileName);
        }
        
        if (fileIndex === -1) {
            return res.status(404).json({ error: 'File not found' });
        }

        let systemFileName;
        let originalFileName;

        if (isSystemName) {
            // Requested by system name - get the original name from previous position
            systemFileName = requestedFileName;
            originalFileName = fileIndex > 0 ? fileNames[fileIndex - 1] : requestedFileName;
        } else {
            // Requested by original name - get system name from next position
            originalFileName = requestedFileName;
            systemFileName = fileIndex < fileNames.length - 1 ? fileNames[fileIndex + 1] : requestedFileName;
        }

        const filePath = path.join(__dirname, '..', 'uploads', systemFileName);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        // Send file with original name
        res.download(filePath, originalFileName);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// GET a specific class by ID
router.get('/:id', async (req, res) => {
    try {
        const classId = req.params.id;
        const result = await db.query(`
            SELECT c.*, s.name as subject_name 
            FROM classes c 
            LEFT JOIN subjects s ON c.subject_id = s.id 
            WHERE c.id = $1
        `, [classId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE a class
router.put('/:id', async (req, res) => {
    try {
        const classId = req.params.id;
        const { code, name, subject_id, opening_date, closing_date } = req.body;
        
        const result = await db.query(
            `UPDATE classes 
             SET code = $1, name = $2, subject_id = $3, opening_date = $4, closing_date = $5 
             WHERE id = $6 
             RETURNING *`,
            [code, name, subject_id, opening_date, closing_date, classId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        res.json({ 
            message: 'Class updated successfully',
            class: result.rows[0]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE a class
router.delete('/:id', async (req, res) => {
    try {
        const classId = req.params.id;
        
        // Check if class exists
        const checkResult = await db.query('SELECT * FROM classes WHERE id = $1', [classId]);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        // Delete the class
        await db.query('DELETE FROM classes WHERE id = $1', [classId]);
        
        res.json({ message: 'Class deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ADD MORE FILES to an existing class
router.post('/:id/files/add', upload.array('files', 10), async (req, res) => {
    try {
        const classId = req.params.id;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        // Get current file names from the database
        const classResult = await db.query('SELECT file_names FROM classes WHERE id = $1', [classId]);
        if (classResult.rows.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        let currentFileNames = [];
        if (classResult.rows[0].file_names) {
            currentFileNames = classResult.rows[0].file_names.split(',');
        }

        // Add new file names to the list as pairs: originalName,systemName
        const newFilePairs = files.map(file => `${file.originalname},${file.filename}`);
        const allFileNames = currentFileNames.length > 0 ? 
            `${currentFileNames},${newFilePairs.join(',')}` : 
            newFilePairs.join(',');

        // Update the class with the new combined list of file names
        await db.query('UPDATE classes SET file_names = $1 WHERE id = $2', [allFileNames, classId]);

        res.json({
            message: 'Files added successfully',
            fileCount: files.length,
            fileNames: files.map(f => f.originalname)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;