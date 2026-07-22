const express = require('express');
const { check, validationResult } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const {
  createPost,
  getFeedPosts,
  getSinglePost,
  deletePost,
  toggleLikePost,
} = require('../controllers/postController');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// All post routes are protected
router.use(protect);

router.post('/', upload.single('image'), createPost);

router.get('/', getFeedPosts);

router.get('/:id', getSinglePost);

router.delete('/:id', deletePost);

router.post('/:id/like', toggleLikePost);

module.exports = router;
