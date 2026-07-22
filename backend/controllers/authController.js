const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user (password is automatically hashed by pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      return res.status(201).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          profilePic: user.profilePic,
          token: generateToken(user._id),
        },
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register User Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and explicitly select password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profilePic: user.profilePic,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login User Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Get Me Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Authenticate with Google OAuth
 * @route   POST /api/auth/google
 * @access  Public
 */
const googleAuth = async (req, res) => {
  try {
    const { idToken, name, email, firebaseUid, profilePic } = req.body;

    let userEmail = email;
    let userName = name;
    let userUid = firebaseUid;
    let userPic = profilePic;

    // Verify token using Firebase Admin if available
    const firebaseConf = require('../config/firebase');
    if (firebaseConf.useFirebase && firebaseConf.admin && idToken) {
      try {
        const decodedToken = await firebaseConf.admin.auth().verifyIdToken(idToken);
        userEmail = decodedToken.email;
        userName = decodedToken.name || userName;
        userUid = decodedToken.uid;
        userPic = decodedToken.picture || userPic;
      } catch (tokenErr) {
        console.error('Firebase ID token verification failed:', tokenErr.message);
        return res.status(401).json({ success: false, message: 'Invalid Firebase ID Token' });
      }
    }

    if (!userUid) {
      return res.status(400).json({ success: false, message: 'firebaseUid or idToken is required' });
    }

    // Try to find user by firebaseUid or email
    const query = [];
    if (userUid) query.push({ firebaseUid: userUid });
    if (userEmail) query.push({ email: userEmail });

    let user = null;
    if (query.length > 0) {
      user = await User.findOne({ $or: query });
    }

    if (user) {
      // Update firebaseUid if it was found by email but didn't have firebaseUid set
      if (!user.firebaseUid) {
        user.firebaseUid = userUid;
        await user.save();
      }
    } else {
      // Create new user profile
      user = await User.create({
        name: userName || 'Google User',
        email: userEmail,
        firebaseUid: userUid,
        profilePic: userPic || '',
      });
    }

    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        profilePic: user.profilePic,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Google Auth Controller Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Authenticate with Phone OTP
 * @route   POST /api/auth/phone
 * @access  Public
 */
const phoneAuth = async (req, res) => {
  try {
    const { idToken, phone, firebaseUid, name } = req.body;

    let userPhone = phone;
    let userUid = firebaseUid;
    let userName = name;

    const firebaseConf = require('../config/firebase');
    if (firebaseConf.useFirebase && firebaseConf.admin && idToken) {
      try {
        const decodedToken = await firebaseConf.admin.auth().verifyIdToken(idToken);
        userPhone = decodedToken.phone_number || userPhone;
        userUid = decodedToken.uid;
      } catch (tokenErr) {
        console.error('Firebase ID token verification failed:', tokenErr.message);
        return res.status(401).json({ success: false, message: 'Invalid Firebase ID Token' });
      }
    }

    if (!userUid) {
      return res.status(400).json({ success: false, message: 'firebaseUid or idToken is required' });
    }

    // Try to find user by firebaseUid or phone number
    const query = [];
    if (userUid) query.push({ firebaseUid: userUid });
    if (userPhone) query.push({ phone: userPhone });

    let user = null;
    if (query.length > 0) {
      user = await User.findOne({ $or: query });
    }

    if (user) {
      if (!user.firebaseUid) {
        user.firebaseUid = userUid;
        await user.save();
      }
    } else {
      // Create new user profile
      user = await User.create({
        name: userName || `User ${userPhone ? userPhone.slice(-4) : 'Phone'}`,
        phone: userPhone,
        firebaseUid: userUid,
      });
    }

    return res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        profilePic: user.profilePic,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Phone Auth Controller Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  googleAuth,
  phoneAuth,
};
