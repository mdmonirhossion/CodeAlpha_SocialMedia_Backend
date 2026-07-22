const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

/**
 * @desc    Add a comment to a post
 * @route   POST /api/comments
 * @access  Private
 */
const addComment = async (req, res) => {
  try {
    const { postId, commentText } = req.body;

    if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (!postId || !commentText) {
      return res.status(400).json({ success: false, message: 'postId and commentText are required' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const comment = await Comment.create({
      postId,
      userId: req.user.id,
      commentText,
    });

    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name profilePic');

    // Notify post creator (if comment author is not the post creator)
    if (post.userId.toString() !== req.user.id.toString()) {
      const notification = await Notification.create({
        recipientId: post.userId,
        senderId: req.user.id,
        type: 'comment',
        postId: post._id,
      });

      // Emit real-time notification to the post creator
      const io = req.app.get('io');
      if (io) {
        const populatedNotif = await Notification.findById(notification._id)
          .populate('senderId', 'name profilePic')
          .populate('postId', 'content');
        io.to(post.userId.toString()).emit('notification', populatedNotif);
      }
    }

    // Socket.io Real-time Comments: Notify active feed viewers
    const io = req.app.get('io');
    if (io) {
      io.emit('newComment', {
        postId,
        comment: populatedComment,
      });
    }

    return res.status(201).json({ success: true, data: populatedComment });
  } catch (error) {
    console.error('Add Comment Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get comments by Post ID
 * @route   GET /api/comments/post/:postId
 * @access  Private
 */
const getCommentsByPostId = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const comments = await Comment.find({ postId: req.params.postId })
      .populate('userId', 'name profilePic')
      .sort({ createdAt: 1 }); // Oldest first

    return res.json({ success: true, count: comments.length, data: comments });
  } catch (error) {
    console.error('Get Comments Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  addComment,
  getCommentsByPostId,
};
