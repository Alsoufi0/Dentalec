// DentaLect Pro Backend Server
// Uses Node.js, Express, and Firebase Firestore for data persistence.

// 1. Import necessary libraries
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// --- Firebase Initialization (Now more secure) ---
let serviceAccount;

// Check if the service account key is in an environment variable (for production on Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Parse the JSON string from the environment variable
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // Fallback to the local file for local development
    try {
        serviceAccount = require('./serviceAccountKey.json');
    } catch (error) {
        console.error("!!! IMPORTANT !!!");
        console.error("Could not find 'serviceAccountKey.json' for local development.");
        console.error("OR the FIREBASE_SERVICE_ACCOUNT environment variable is not set for production.");
        console.error("Please follow the setup instructions in the backend-guide.md");
        process.exit(1); // Exit if no credentials can be found
    }
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
// --- End of Initialization ---

// 3. Initialize Express App
const app = express();
const port = process.env.PORT || 3000;

// 4. Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing for your frontend
app.use(express.json()); // Allow the server to parse JSON in request bodies

// --- DUMMY USER ID ---
// In a real app, you would get this from an authentication token (e.g., JWT)
// For now, we'll use a static ID to simulate a single user.
const DUMMY_USER_ID = 'test-user-12345';

// 5. API ROUTES (The functions for your 5 modes and data)

// GET all subjects for the user
app.get('/api/subjects', async (req, res) => {
  try {
    const subjectsCollection = db.collection('users').doc(DUMMY_USER_ID).collection('subjects');
    const snapshot = await subjectsCollection.get();
    
    if (snapshot.empty) {
      // If no subjects, return the initial sample data
      const initialSubjects = [ { id: 1, name: "Anatomy", files: [ { name: "Cranial Nerves.txt", content: "The twelve cranial nerves..." }, { name: "Muscles of Mastication.txt", content: "The four primary muscles..." } ] } ];
      // Also save this to the database for next time
      for (const subject of initialSubjects) {
          await subjectsCollection.doc(String(subject.id)).set(subject);
      }
      return res.status(200).json(initialSubjects);
    }

    const subjects = snapshot.docs.map(doc => doc.data());
    res.status(200).json(subjects);
  } catch (error) {
    console.error("Error fetching subjects:", error);
    res.status(500).send("Error fetching data from server.");
  }
});

// POST a new subject
app.post('/api/subjects', async (req, res) => {
  try {
    const newSubject = req.body;
    if (!newSubject || !newSubject.name || !newSubject.id) {
      return res.status(400).send('Invalid subject data.');
    }
    // Save the new subject using its ID as the document name
    await db.collection('users').doc(DUMMY_USER_ID).collection('subjects').doc(String(newSubject.id)).set(newSubject);
    res.status(201).json(newSubject);
  } catch (error) {
    console.error("Error creating subject:", error);
    res.status(500).send("Error saving data.");
  }
});

// PUT (update) an existing subject (e.g., rename, add file)
app.put('/api/subjects/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        const updatedSubject = req.body;

        if (!updatedSubject) {
            return res.status(400).send('Invalid update data.');
        }

        await db.collection('users').doc(DUMMY_USER_ID).collection('subjects').doc(subjectId).set(updatedSubject);
        res.status(200).json(updatedSubject);
    } catch (error) {
        console.error("Error updating subject:", error);
        res.status(500).send("Error updating data.");
    }
});

// DELETE a subject
app.delete('/api/subjects/:subjectId', async (req, res) => {
    try {
        const { subjectId } = req.params;
        await db.collection('users').doc(DUMMY_USER_ID).collection('subjects').doc(subjectId).delete();
        res.status(204).send(); // 204 No Content for successful deletion
    } catch (error) {
        console.error("Error deleting subject:", error);
        res.status(500).send("Error deleting data.");
    }
});


// 6. Start the server
app.listen(port, () => {
  console.log(`DentaLect Pro backend listening at http://localhost:${port}`);
});

