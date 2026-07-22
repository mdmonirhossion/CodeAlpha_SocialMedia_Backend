const admin = require('firebase-admin');

let bucket = null;
let useFirebase = false;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

  if (projectId && clientEmail && privateKey && storageBucket) {
    // Format private key properly in case it has escaped newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });

    bucket = admin.storage().bucket();
    useFirebase = true;
    console.log('Firebase Admin SDK initialized successfully for storage.');
  } else {
    console.warn('Firebase configuration missing in .env. Falling back to local filesystem storage for uploads.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
  console.warn('Falling back to local filesystem storage for uploads.');
}

module.exports = {
  admin,
  bucket,
  useFirebase,
};
