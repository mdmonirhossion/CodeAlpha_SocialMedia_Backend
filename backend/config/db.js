const mongoose = require('mongoose');

// Disable query buffering so database operations fail instantly instead of hanging when offline
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mini_social_db';
    console.log(`Connecting to Mongoose URI: ${uri}`);
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.warn('WARNING: Server starting without an active MongoDB connection. Database features will be unavailable.');
  }
};

module.exports = connectDB;
