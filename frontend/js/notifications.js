/**
 * Notifications Logic & Real-time Integration
 */

document.addEventListener('DOMContentLoaded', () => {
  const me = getCachedUser();
  if (!me) return;

  // Initialize socket listener if socket is not already initialized
  // Both feed.js and profile.js initialize global socket client
  // We can attach a timer or immediately check if socket object exists
  const checkSocketInterval = setInterval(() => {
    if (window.socket || (typeof socket !== 'undefined' && socket)) {
      clearInterval(checkSocketInterval);
      const activeSocket = window.socket || socket;
      setupSocketNotificationListener(activeSocket);
    }
  }, 100);

  // Fetch initial notifications on load to set count badge
  loadNotificationsList(false); // don't open dropdown, just update badge

  // Bind dropdown display trigger
  setupNotificationUIDropdown();
});

/**
 * Listen for real-time notification events
 */
function setupSocketNotificationListener(socketInstance) {
  socketInstance.on('notification', (notif) => {
    // 1. Show Toast Alert
    const senderName = notif.senderId.name;
    let message = '';
    
    if (notif.type === 'like') {
      message = `<strong>${senderName}</strong> liked your post.`;
    } else if (notif.type === 'comment') {
      message = `<strong>${senderName}</strong> commented on your post.`;
    } else if (notif.type === 'follow') {
      message = `<strong>${senderName}</strong> started following you.`;
    }

    showToast(message, 'info');

    // 2. Play subtle notification sound if desired (optional)
    
    // 3. Prepend notification to list if list exists
    const list = document.getElementById('notifications-list');
    if (list) {
      // Remove empty state
      const empty = list.querySelector('.empty-state');
      if (empty) empty.remove();

      const notifEl = createNotificationItem(notif);
      list.prepend(notifEl);
    }

    // 4. Increment count badge
    incrementBadgeCount();
  });
}

/**
 * Increment badge element counter
 */
function incrementBadgeCount() {
  const badge = document.getElementById('notif-count-badge');
  if (badge) {
    let count = parseInt(badge.textContent) || 0;
    count += 1;
    badge.textContent = count;
    badge.classList.remove('hidden');
  }
}

/**
 * Retrieve notifications from Express backend
 */
async function loadNotificationsList(markAsRead = false) {
  const res = await apiFetch('/notifications');
  const badge = document.getElementById('notif-count-badge');
  const list = document.getElementById('notifications-list');

  if (res && res.success) {
    // 1. Update Badge
    const unreadCount = res.data.filter(n => !n.isRead).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // 2. Build list elements in dropdown
    if (list) {
      list.innerHTML = '';
      if (res.data.length === 0) {
        list.innerHTML = '<li class="empty-state">No notifications yet</li>';
      } else {
        res.data.forEach(notif => {
          const item = createNotificationItem(notif);
          list.appendChild(item);
        });
      }
    }

    // 3. If requested, hit API to mark all read
    if (markAsRead && unreadCount > 0) {
      await apiFetch('/notifications/read', { method: 'PUT' });
      if (badge) {
        setTimeout(() => {
          badge.classList.add('hidden');
          badge.textContent = '0';
        }, 1500); // Visual delay for effect
      }
    }
  }
}

/**
 * Create notification LI node
 */
function createNotificationItem(notif) {
  const li = document.createElement('li');
  li.className = `notif-item ${notif.isRead ? '' : 'unread'}`;
  
  const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
  const avatar = notif.senderId.profilePic || defaultAvatar;
  const senderName = notif.senderId.name;
  
  let text = '';
  if (notif.type === 'like') {
    text = `liked your post: "${escapeHTML(notif.postId?.content || '')}"`;
  } else if (notif.type === 'comment') {
    text = `commented on your post: "${escapeHTML(notif.postId?.content || '')}"`;
  } else if (notif.type === 'follow') {
    text = `started following you`;
  }

  const dateFormatted = new Date(notif.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  li.innerHTML = `
    <img src="${avatar}" alt="Avatar" class="avatar">
    <div class="notif-content">
      <div><strong>${senderName}</strong> ${text}</div>
      <div class="notif-time">${dateFormatted}</div>
    </div>
  `;

  // Clicking a notification routes user appropriately
  li.addEventListener('click', () => {
    if (notif.type === 'follow') {
      window.location.href = `/profile.html?id=${notif.senderId._id}`;
    } else if (notif.postId) {
      // If we are already on profile/feed we can just scroll or route
      // For simplicity, route to profile of the post creator or view post details
      window.location.href = `/profile.html?id=${getCachedUser()._id}`;
    }
  });

  return li;
}

/**
 * Setup notification clicks and toggle dropdown states
 */
function setupNotificationUIDropdown() {
  const btn = document.getElementById('nav-notifications-btn');
  const dropdown = document.getElementById('notifications-dropdown');
  const markReadBtn = document.getElementById('btn-mark-all-read');

  if (btn && dropdown) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.contains('hidden');
      
      // Close search if open
      const searchDropdown = document.getElementById('search-dropdown');
      if (searchDropdown) searchDropdown.classList.add('hidden');

      if (isHidden) {
        dropdown.classList.remove('hidden');
        loadNotificationsList(true); // Load & Mark as Read
      } else {
        dropdown.classList.add('hidden');
      }
    });

    // Close dropdown on clicking outside
    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  if (markReadBtn) {
    markReadBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await apiFetch('/notifications/read', { method: 'PUT' });
      if (res && res.success) {
        const unreadItems = document.querySelectorAll('.notif-item.unread');
        unreadItems.forEach(item => item.classList.remove('unread'));
        const badge = document.getElementById('notif-count-badge');
        if (badge) {
          badge.classList.add('hidden');
          badge.textContent = '0';
        }
        showToast('All notifications marked as read', 'success');
      }
    });
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
