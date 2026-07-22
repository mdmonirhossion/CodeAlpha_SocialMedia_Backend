const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Like = require('../models/Like');
const Comment = require('../models/Comment');
const Follower = require('../models/Follower');
const Notification = require('../models/Notification');
const { uploadToStorage } = require('../middleware/uploadMiddleware');

/**
 * @desc    Get user profile details
 * @route   GET /api/users/:id
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const followersCount = await Follower.countDocuments({ followingId: req.params.id });
    const followingCount = await Follower.countDocuments({ followerId: req.params.id });

    // Check if current logged-in user is following this user
    const isFollowing = !!(await Follower.findOne({
      followerId: req.user.id,
      followingId: req.params.id,
    }));

    return res.json({
      success: true,
      data: {
        ...user.toObject(),
        followersCount,
        followingCount,
        isFollowing,
      },
    });
  } catch (error) {
    console.error('Get User Profile Error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Get all posts by a specific user
 * @route   GET /api/users/:id/posts
 * @access  Private
 */
const getUserPosts = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const posts = await Post.find({ userId: req.params.id })
      .populate('userId', 'name profilePic')
      .sort({ createdAt: -1 });

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

    return res.json({ success: true, count: postList.length, data: postList });
  } catch (error) {
    console.error('Get User Posts Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Toggle follow/unfollow a user
 * @route   POST /api/users/:id/follow
 * @access  Private
 */
const toggleFollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(404).json({ success: false, message: 'User to follow not found' });
    }

    // Cannot follow self
    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User to follow not found' });
    }

    const existingFollow = await Follower.findOne({
      followerId: req.user.id,
      followingId: targetUserId,
    });

    let following = false;

    if (existingFollow) {
      // Unfollow
      await Follower.deleteOne({ _id: existingFollow._id });
    } else {
      // Follow
      await Follower.create({
        followerId: req.user.id,
        followingId: targetUserId,
      });
      following = true;

      // Create real-time notification
      const notification = await Notification.create({
        recipientId: targetUserId,
        senderId: req.user.id,
        type: 'follow',
      });

      // Emit Notification via socket
      const io = req.app.get('io');
      if (io) {
        const populatedNotif = await Notification.findById(notification._id)
          .populate('senderId', 'name profilePic');
        io.to(targetUserId).emit('notification', populatedNotif);
      }
    }

    const followersCount = await Follower.countDocuments({ followingId: targetUserId });
    const followingCount = await Follower.countDocuments({ followerId: targetUserId });

    return res.json({
      success: true,
      data: {
        following,
        followersCount,
        followingCount,
      },
    });
  } catch (error) {
    console.error('Toggle Follow Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Update user bio & profile picture
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { bio } = req.body;
    const updateFields = {};

    if (bio !== undefined) {
      updateFields.bio = bio;
    }

    if (req.file) {
      const profilePicUrl = await uploadToStorage(req.file, 'profiles');
      updateFields.profilePic = profilePicUrl;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update Profile Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Search users by name
 * @route   GET /api/users/search
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const users = await User.find({
      name: { $regex: query, $options: 'i' },
      _id: { $ne: req.user.id }, // Exclude self
    })
      .select('name email profilePic bio')
      .limit(10);

    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('Search Users Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getUserProfile,
  getUserPosts,
  toggleFollowUser,
  updateProfile,
  searchUsers,
};
