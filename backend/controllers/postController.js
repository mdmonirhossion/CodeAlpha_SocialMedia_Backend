const mongoose = require('mongoose');
const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { uploadToStorage } = require('../middleware/uploadMiddleware');

/**
 * @desc    Create a new post
 * @route   POST /api/posts
 * @access  Private
 */
const createPost = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content && !req.file) {
      return res.status(400).json({ success: false, message: 'Post content or image is required' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = await uploadToStorage(req.file, 'posts');
    }

    const post = await Post.create({
      userId: req.user.id,
      content: content || '',
      image: imageUrl,
    });

    // Populate user info for frontend rendering
    const populatedPost = await Post.findById(post._id).populate('userId', 'name profilePic');

    // Socket.io Real-time Feed Update: broadcast new post
    const io = req.app.get('io');
    if (io) {
      io.emit('newPost', {
        ...populatedPost.toObject(),
        likeCount: 0,
        hasLiked: false,
        commentCount: 0,
      });
    }

    return res.status(201).json({ success: true, data: populatedPost });
  } catch (error) {
    console.error('Create Post Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get feed posts (with pagination & likes/comments counts)
 * @route   GET /api/posts
 * @access  Private
 */
const getFeedPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('userId', 'name profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Hydrate posts with extra fields (likeCount, hasLiked, commentCount)
    const postList = await Promise.all(
      posts.map(async (post) => {
        const likeCount = await Like.countDocuments({ postId: post._id });
        const hasLiked = !!(await Like.findOne({ postId: post._id, userId: req.user.id }));
        const commentCount = await Comment.countDocuments({ postId: post._id });

        return {
          ...post.toObject(),
          likeCount,
          hasLiked,
          commentCount,
        };
      })
    );

    return res.json({
      success: true,
      count: postList.length,
      page,
      data: postList,
    });
  } catch (error) {
    console.error('Get Feed Posts Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get a single post details
 * @route   GET /api/posts/:id
 * @access  Private
 */
const getSinglePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const post = await Post.findById(req.params.id).populate('userId', 'name profilePic');

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const likeCount = await Like.countDocuments({ postId: post._id });
    const hasLiked = !!(await Like.findOne({ postId: post._id, userId: req.user.id }));
    const commentCount = await Comment.countDocuments({ postId: post._id });

    return res.json({
      success: true,
      data: {
        ...post.toObject(),
        likeCount,
        hasLiked,
        commentCount,
      },
    });
  } catch (error) {
    console.error('Get Single Post Error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(444).json({ success: false, message: 'Post not found' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Delete a post
 * @route   DELETE /api/posts/:id
 * @access  Private
 */
const deletePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Verify post ownership
    if (post.userId.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authorized to delete this post' });
    }

    // Delete post
    await Post.deleteOne({ _id: req.params.id });

    // Clean up related likes and comments
    await Like.deleteMany({ postId: req.params.id });
    await Comment.deleteMany({ postId: req.params.id });
    await Notification.deleteMany({ postId: req.params.id });

    // Emit delete event to clients
    const io = req.app.get('io');
    if (io) {
      io.emit('deletePost', req.params.id);
    }

    return res.json({ success: true, message: 'Post removed' });
  } catch (error) {
    console.error('Delete Post Error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(444).json({ success: false, message: 'Post not found' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Toggle Like / Unlike on a post
 * @route   POST /api/posts/:id/like
 * @access  Private
 */
const toggleLikePost = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if post already liked by this user
    const existingLike = await Like.findOne({
      postId: req.params.id,
      userId: req.user.id,
    });

    let liked = false;

    if (existingLike) {
      // Unlike post
      await Like.deleteOne({ _id: existingLike._id });
    } else {
      // Like post
      await Like.create({
        postId: req.params.id,
        userId: req.user.id,
      });
      liked = true;

      // Create notification (if the user liking is NOT the post creator)
      if (post.userId.toString() !== req.user.id.toString()) {
        const notification = await Notification.create({
          recipientId: post.userId,
          senderId: req.user.id,
          type: 'like',
          postId: post._id,
        });

        // Emit real-time notification
        const io = req.app.get('io');
        if (io) {
          const populatedNotif = await Notification.findById(notification._id)
            .populate('senderId', 'name profilePic')
            .populate('postId', 'content');
          io.to(post.userId.toString()).emit('notification', populatedNotif);
        }
      }
    }

    // Fetch updated like count
    const likeCount = await Like.countDocuments({ postId: req.params.id });

    // Emit real-time like count toggle
    const io = req.app.get('io');
    if (io) {
      io.emit('likeUpdate', {
        postId: req.params.id,
        likeCount,
        hasLiked: liked,
        userId: req.user.id,
      });
    }

    return res.json({
      success: true,
      data: {
        liked,
        likeCount,
      },
    });
  } catch (error) {
    console.error('Toggle Like Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  createPost,
  getFeedPosts,
  getSinglePost,
  deletePost,
  toggleLikePost,
};
