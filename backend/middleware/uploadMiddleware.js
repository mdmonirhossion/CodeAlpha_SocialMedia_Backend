const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { bucket, useFirebase } = require('../config/firebase');

// Configure multer memory storage (we will process the buffer for both Firebase and Local fallback)
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * Helper to upload file buffer.
 * If Firebase is configured, it uploads to Firebase Storage.
 * Otherwise, it saves to local public uploads directory and returns static URL.
 */
const uploadToStorage = async (file, folderName = 'general') => {
  if (!file) return '';

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  const fileExtension = path.extname(file.originalname);
  const fileName = `${folderName}/${uniqueSuffix}${fileExtension}`;

  if (useFirebase && bucket) {
    try {
      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      return new Promise((resolve, reject) => {
        blobStream.on('error', (err) => {
          reject(err);
        });

        blobStream.on('finish', async () => {
          // Make the file public or get a signed/public URL.
          // For Firebase Storage, the standard public URL format is:
          // https://firebasestorage.googleapis.com/v0/b/<bucket_name>/o/<folder_name>%2F<file_name>?alt=media
          // We can construct this directly or use makePublic()
          try {
            await blob.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            resolve(publicUrl);
          } catch (pubErr) {
            // Fallback to a signed URL if makePublic fails due to security rules
            const [url] = await blob.getSignedUrl({
              action: 'read',
              expires: '03-09-2491', // Long-term expiration
            });
            resolve(url);
          }
        });

        blobStream.end(file.buffer);
      });
    } catch (error) {
      console.error('Firebase upload failed, trying local fallback:', error.message);
    }
  }

  // Fallback: Save to Local Directory
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const localFileName = `${uniqueSuffix}${fileExtension}`;
    const localFilePath = path.join(uploadDir, localFileName);

    await fs.promises.writeFile(localFilePath, file.buffer);
    return `/uploads/${localFileName}`;
  } catch (err) {
    console.error('Local file write error:', err.message);
    throw new Error('Failed to upload file.');
  }
};

module.exports = {
  upload,
  uploadToStorage,
};
