const Notification = require('../models/Notification');

/**
 * @desc    Get user notifications
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.id })
      .populate('senderId', 'name profilePic')
      .populate('postId', 'content')
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    console.error('Get Notifications Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read
 * @access  Private
 */
const markNotificationsAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark Notifications Read Error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getNotifications,
  markNotificationsAsRead,
};
