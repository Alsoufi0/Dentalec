const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3001; // Use a different port like 3001 for local dev if needed

// --- Security and CORS Configuration ---
// This tells your backend which frontend URLs are allowed to access it.
const allowedOrigins = [
    'http://localhost:5500', // For local testing with Live Server
    'http://127.0.0.1:5500', // For local testing
    // YOUR LIVE NETLIFY URL HAS BEEN ADDED HERE:
    'https://coruscating-cheesecake-9bbb2f.netlify.app' 
    'simav-dentalec.netlify.app'
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increased limit for PDF content

// --- Firebase Admin SDK Initialization ---
let db;
try {
    let serviceAccount;
    // Render/Vercel use environment variables for security. This is the primary method.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        console.log('Initializing Firebase from Base64 environment variable...');
        const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
        const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
        serviceAccount = JSON.parse(serviceAccountJson);
    } else {
        // Fallback for local development
        console.log('Initializing Firebase from local serviceAccountKey.json file...');
        serviceAccount = require('./serviceAccountKey.json');
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }

    db = admin.firestore();
    console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
    console.error("CRITICAL: Firebase Admin SDK Initialization Error:", error.message);
    process.exit(1);
}

const subjectsCollection = db.collection('subjects');

// --- API Endpoints ---

// GET all subjects
app.get('/api/subjects', async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/subjects - Fetching all subjects...`);
    try {
        const snapshot = await subjectsCollection.get();
        const subjects = snapshot.docs.map(doc => doc.data());
        res.status(200).json(subjects);
    } catch (error) {
        console.error("Error fetching subjects:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// CREATE a new subject
app.post('/api/subjects', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/subjects - Received request.`);
    console.log("Request Body:", req.body);
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Subject name is required.' });
        }

        const newSubjectRef = subjectsCollection.doc();
        const newSubject = {
            id: newSubjectRef.id,
            name: name.trim(),
            files: []
        };

        await newSubjectRef.set(newSubject);
        console.log("Successfully created subject with ID:", newSubject.id);
        res.status(201).json(newSubject);
    } catch (error) {
        console.error("Error creating subject:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// UPDATE a subject (Rename)
app.put('/api/subjects/:subjectId', async (req, res) => {
    console.log(`[${new Date().toISOString()}] PUT /api/subjects/${req.params.subjectId}`);
    try {
        const { subjectId } = req.params;
        const { name } = req.body;
        if (!name) { return res.status(400).json({ message: 'New name is required.' }); }
        
        await subjectsCollection.doc(subjectId).update({ name });
        console.log("Successfully updated subject:", subjectId);
        res.status(200).json({ message: 'Subject updated successfully' });
    } catch (error) {
        console.error("Error updating subject:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// DELETE a subject
app.delete('/api/subjects/:subjectId', async (req, res) => {
    console.log(`[${new Date().toISOString()}] DELETE /api/subjects/${req.params.subjectId}`);
    try {
        const { subjectId } = req.params;
        await subjectsCollection.doc(subjectId).delete();
        console.log("Successfully deleted subject:", subjectId);
        res.status(200).json({ message: 'Subject deleted successfully' });
    } catch (error) {
        console.error("Error deleting subject:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// CREATE a new file within a subject
app.post('/api/subjects/:subjectId/files', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/subjects/${req.params.subjectId}/files`);
    try {
        const { subjectId } = req.params;
        const { name, content } = req.body;

        if (!name || !content) { return res.status(400).json({ message: 'File name and content are required.' }); }

        const subjectRef = subjectsCollection.doc(subjectId);
        const subjectDoc = await subjectRef.get();
        if (!subjectDoc.exists) { return res.status(404).json({ message: 'Subject not found.' }); }

        const newFile = {
            id: admin.firestore.Timestamp.now().toMillis().toString() + Math.random().toString(36).substr(2, 9),
            name,
            content
        };

        await subjectRef.update({ files: admin.firestore.FieldValue.arrayUnion(newFile) });
        console.log(`Successfully added file "${name}" to subject:`, subjectId);
        res.status(201).json(newFile);
    } catch (error) {
        console.error("Error adding file:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// DELETE a file from a subject
app.delete('/api/subjects/:subjectId/files/:fileId', async (req, res) => {
    console.log(`[${new Date().toISOString()}] DELETE /api/subjects/${req.params.subjectId}/files/${req.params.fileId}`);
    try {
        const { subjectId, fileId } = req.params;
        const subjectRef = subjectsCollection.doc(subjectId);
        const subjectDoc = await subjectRef.get();

        if (!subjectDoc.exists) { return res.status(404).json({ message: 'Subject not found.' }); }

        const subjectData = subjectDoc.data();
        const fileToRemove = subjectData.files.find(f => f.id === fileId);
        
        if (!fileToRemove) { return res.status(404).json({ message: 'File not found.' }); }

        await subjectRef.update({ files: admin.firestore.FieldValue.arrayRemove(fileToRemove) });
        console.log(`Successfully removed file "${fileToRemove.name}" from subject:`, subjectId);
        res.status(200).json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


