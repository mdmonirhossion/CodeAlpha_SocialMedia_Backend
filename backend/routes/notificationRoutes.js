const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getNotifications, markNotificationsAsRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);

router.put('/read', markNotificationsAsRead);

module.exports = router;
