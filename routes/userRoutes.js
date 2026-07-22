const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const {
  getUserProfile,
  getUserPosts,
  toggleFollowUser,
  updateProfile,
  searchUsers,
} = require('../controllers/userController');

const router = express.Router();

router.use(protect);

router.put('/profile', upload.single('profilePic'), updateProfile);

router.get('/search', searchUsers);

router.get('/:id', getUserProfile);

router.get('/:id/posts', getUserPosts);

router.post('/:id/follow', toggleFollowUser);

module.exports = router;
