const express = require('express');
const { check, validationResult } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const { addComment, getCommentsByPostId } = require('../controllers/commentController');

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

router.use(protect);

router.post(
  '/',
  [
    check('postId', 'Post ID is required').not().isEmpty().trim(),
    check('commentText', 'Comment text is required').not().isEmpty().trim(),
  ],
  validate,
  addComment
);

router.get('/post/:postId', getCommentsByPostId);

module.exports = router;
