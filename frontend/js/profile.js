/**
 * Profile Logic (View other profile, edit my profile, list own posts)
 */

let profileUserId = '';
let isSelfProfile = false;
let socket;
let currentOpenPostIdForComments = null;

document.addEventListener('DOMContentLoaded', () => {
  const me = getCachedUser();
  if (!me) {
    window.location.href = '/login.html';
    return;
  }

  // Parse URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  profileUserId = urlParams.get('id');

  if (!profileUserId || profileUserId === me._id) {
    profileUserId = me._id;
    isSelfProfile = true;
  }

  // Socket setup for real-time notifications
  initSocket(me._id);

  // Load Profile Information
  loadProfile();
  loadUserPosts();

  // Setup Event Listeners
  setupProfileEventListeners();
});

/**
 * Socket.io setup (similar to feed.js for comments & likes)
 */
function initSocket(userId) {
  socket = io();
  socket.emit('joinRoom', userId);

  // Like Updates
  socket.on('likeUpdate', (data) => {
    const postCard = document.getElementById(`post-${data.postId}`);
    if (postCard) {
      const likeTextEl = postCard.querySelector('.like-count-text');
      if (likeTextEl) {
        likeTextEl.textContent = `${data.likeCount} like${data.likeCount === 1 ? '' : 's'}`;
      }
      if (data.userId === userId) {
        const likeBtn = postCard.querySelector('.btn-like-post');
        if (likeBtn) {
          if (data.hasLiked) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '👍 Liked';
          } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '👍 Like';
          }
        }
      }
    }
  });

  // Comments Updates
  socket.on('newComment', (data) => {
    const postCard = document.getElementById(`post-${data.postId}`);
    if (postCard) {
      const commentCountEl = postCard.querySelector('.comment-count-text');
      if (commentCountEl) {
        const text = commentCountEl.textContent;
        const currentCount = parseInt(text) || 0;
        const newCount = currentCount + 1;
        commentCountEl.textContent = `${newCount} comment${newCount === 1 ? '' : 's'}`;
      }
    }

    if (currentOpenPostIdForComments === data.postId) {
      const list = document.getElementById('modal-comments-list');
      if (list) {
        const commentEl = createCommentElement(data.comment);
        list.appendChild(commentEl);
        const body = document.querySelector('.comments-modal-body');
        if (body) body.scrollTop = body.scrollHeight;
      }
    }
  });

  // Delete Updates
  socket.on('deletePost', (postId) => {
    const card = document.getElementById(`post-${postId}`);
    if (card) {
      card.style.transform = 'scale(0.9)';
      card.style.opacity = '0';
      setTimeout(() => card.remove(), 250);
    }
  });
}

/**
 * Load user details
 */
async function loadProfile() {
  const res = await apiFetch(`/users/${profileUserId}`);
  
  if (res && res.success) {
    const user = res.data;
    const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    
    // Set UI elements
    document.getElementById('profile-avatar').src = user.profilePic || defaultAvatar;
    document.getElementById('profile-user-name').textContent = user.name;
    document.getElementById('profile-user-bio').textContent = user.bio || (isSelfProfile ? 'Add a bio to express yourself' : 'No bio yet');
    
    document.getElementById('profile-followers-stat').innerHTML = `<strong>${user.followersCount}</strong> Followers`;
    document.getElementById('profile-following-stat').innerHTML = `<strong>${user.followingCount}</strong> Following`;
    
    document.getElementById('intro-email').textContent = user.email;
    document.getElementById('intro-joined').textContent = new Date(user.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long'
    });

    const followBtn = document.getElementById('btn-follow-toggle');
    const editBtn = document.getElementById('btn-edit-profile-trigger');

    if (isSelfProfile) {
      editBtn.classList.remove('hidden');
      followBtn.classList.add('hidden');
      
      // Update sidebar avatar caches if looking at own profile
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      editBtn.classList.add('hidden');
      followBtn.classList.remove('hidden');

      updateFollowButton(user.isFollowing);
    }
  } else {
    showToast('Failed to load profile details.', 'error');
  }
}

/**
 * Follow/Unfollow UI State toggler
 */
function updateFollowButton(isFollowing) {
  const followBtn = document.getElementById('btn-follow-toggle');
  if (isFollowing) {
    followBtn.classList.remove('btn-primary');
    followBtn.classList.add('btn-secondary');
    followBtn.textContent = 'Unfollow';
  } else {
    followBtn.classList.remove('btn-secondary');
    followBtn.classList.add('btn-primary');
    followBtn.textContent = 'Follow';
  }
}

/**
 * Fetch and Render Profile Posts
 */
async function loadUserPosts() {
  const loader = document.getElementById('profile-posts-loader');
  const container = document.getElementById('profile-posts-container');
  
  const res = await apiFetch(`/users/${profileUserId}/posts`);
  
  if (res && res.success) {
    if (loader) loader.classList.add('hidden');
    container.innerHTML = '';
    
    if (res.data.length === 0) {
      container.innerHTML = `<div class="empty-state">${isSelfProfile ? "You haven't posted anything yet!" : "This user hasn't posted anything yet."}</div>`;
    } else {
      res.data.forEach(post => {
        const card = createPostCard(post);
        container.appendChild(card);
      });
    }
  } else {
    showToast('Failed to load user posts.', 'error');
  }
}

/**
 * Generate Post Card element (same logic as feed.js)
 */
function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `post-${post._id}`;

  const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
  const authorAvatar = post.userId.profilePic || defaultAvatar;
  const authorName = post.userId.name;
  const dateFormatted = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const me = getCachedUser();
  const isMyPost = me && me._id === post.userId._id;

  card.innerHTML = `
    <div class="post-card-header">
      <div class="post-author-info">
        <img src="${authorAvatar}" alt="Avatar" class="avatar">
        <div>
          <span class="post-author-name">${authorName}</span>
          <div class="post-meta-time">${dateFormatted}</div>
        </div>
      </div>
      ${isMyPost ? `<button class="btn-text btn-delete-post" data-id="${post._id}" title="Delete Post">🗑️</button>` : ''}
    </div>
    
    <div class="post-card-content">
      ${escapeHTML(post.content)}
    </div>

    ${post.image ? `
      <div class="post-card-image">
        <img src="${post.image}" alt="Post Media">
      </div>
    ` : ''}

    <div class="post-stats-row">
      <span class="like-count-text">${post.likeCount} like${post.likeCount === 1 ? '' : 's'}</span>
      <span class="comment-count-text">${post.commentCount} comment${post.commentCount === 1 ? '' : 's'}</span>
    </div>

    <div class="post-actions-row">
      <button class="post-action-btn btn-like-post ${post.hasLiked ? 'liked' : ''}" data-id="${post._id}">
        👍 ${post.hasLiked ? 'Liked' : 'Like'}
      </button>
      <button class="post-action-btn btn-comment-trigger" data-id="${post._id}">
        💬 Comment
      </button>
    </div>
  `;

  // Bind Actions inside card
  card.querySelector('.btn-like-post').addEventListener('click', async (e) => {
    const postId = e.target.getAttribute('data-id');
    const res = await apiFetch(`/posts/${postId}/like`, { method: 'POST' });
    if (res && res.success) {
      const isLiked = res.data.liked;
      e.target.classList.toggle('liked', isLiked);
      e.target.innerHTML = isLiked ? '👍 Liked' : '👍 Like';
      
      const countEl = card.querySelector('.like-count-text');
      countEl.textContent = `${res.data.likeCount} like${res.data.likeCount === 1 ? '' : 's'}`;
    }
  });

  card.querySelector('.btn-comment-trigger').addEventListener('click', () => {
    openCommentsModal(post._id);
  });

  if (isMyPost) {
    card.querySelector('.btn-delete-post').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this post?')) {
        const res = await apiFetch(`/posts/${post._id}`, { method: 'DELETE' });
        if (res && res.success) {
          card.remove();
          showToast('Post deleted successfully.', 'success');
        } else {
          showToast(res.message || 'Failed to delete post.', 'error');
        }
      }
    });
  }

  return card;
}

/**
 * Open Comment Drawer Modal (identical to feed.js)
 */
async function openCommentsModal(postId) {
  currentOpenPostIdForComments = postId;
  document.getElementById('modal-comment-post-id').value = postId;
  
  const commentsList = document.getElementById('modal-comments-list');
  commentsList.innerHTML = '<div class="feed-spinner"><div class="spinner"></div><p>Loading comments...</p></div>';
  
  const modal = document.getElementById('comments-modal');
  modal.classList.remove('hidden');

  const res = await apiFetch(`/comments/post/${postId}`);
  if (res && res.success) {
    commentsList.innerHTML = '';
    if (res.data.length === 0) {
      commentsList.innerHTML = '<div class="empty-state">No comments yet. Start the conversation!</div>';
    } else {
      res.data.forEach(comment => {
        const commentEl = createCommentElement(comment);
        commentsList.appendChild(commentEl);
      });
    }
    const body = document.querySelector('.comments-modal-body');
    if (body) body.scrollTop = body.scrollHeight;
  } else {
    commentsList.innerHTML = '<p class="text-center text-muted">Failed to load comments</p>';
  }
}

function createCommentElement(comment) {
  const el = document.createElement('div');
  el.className = 'comment-item';

  const defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
  const avatar = comment.userId.profilePic || defaultAvatar;
  const name = comment.userId.name;
  const dateFormatted = new Date(comment.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  el.innerHTML = `
    <a href="/profile.html?id=${comment.userId._id}"><img src="${avatar}" alt="Avatar" class="avatar"></a>
    <div>
      <div class="comment-bubble">
        <a href="/profile.html?id=${comment.userId._id}" class="comment-author">${name}</a>
        <div class="comment-text">${escapeHTML(comment.commentText)}</div>
      </div>
      <div class="comment-time">${dateFormatted}</div>
    </div>
  `;
  return el;
}

/**
 * Profile page event setups
 */
function setupProfileEventListeners() {
  const followBtn = document.getElementById('btn-follow-toggle');
  const editBtn = document.getElementById('btn-edit-profile-trigger');
  
  // Follow/Unfollow Click
  if (followBtn) {
    followBtn.addEventListener('click', async () => {
      followBtn.disabled = true;
      const res = await apiFetch(`/users/${profileUserId}/follow`, { method: 'POST' });
      if (res && res.success) {
        updateFollowButton(res.data.following);
        document.getElementById('profile-followers-stat').innerHTML = `<strong>${res.data.followersCount}</strong> Followers`;
        document.getElementById('profile-following-stat').innerHTML = `<strong>${res.data.followingCount}</strong> Following`;
        showToast(res.data.following ? 'Following user' : 'Unfollowed user', 'success');
      } else {
        showToast(res.message || 'Action failed.', 'error');
      }
      followBtn.disabled = false;
    });
  }

  // Edit Profile UI triggers
  const editModal = document.getElementById('edit-profile-modal');
  const cancelEditBtn = document.getElementById('btn-cancel-edit');
  const closeEditModalBtn = document.getElementById('btn-close-edit-modal');
  const editForm = document.getElementById('edit-profile-form');
  const bioInput = document.getElementById('edit-bio-textarea');
  const avatarInput = document.getElementById('edit-avatar-input');
  const avatarPreview = document.getElementById('edit-avatar-preview');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const me = getCachedUser();
      if (me) {
        bioInput.value = me.bio || '';
        avatarPreview.src = me.profilePic || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        editModal.classList.remove('hidden');
      }
    });
  }

  // Handle Photo selection and preview in modal
  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarPreview.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  const closeEdit = () => {
    editModal.classList.add('hidden');
    avatarInput.value = '';
  };

  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEdit);
  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEdit);

  // Edit Profile submission
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById('btn-save-profile');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const formData = new FormData();
      formData.append('bio', bioInput.value.trim());
      if (avatarInput.files[0]) {
        formData.append('profilePic', avatarInput.files[0]);
      }

      const res = await apiFetch('/users/profile', {
        method: 'PUT',
        body: formData,
      });

      if (res && res.success) {
        showToast('Profile updated successfully!', 'success');
        closeEdit();
        // Reload details shown on screen
        loadProfile();
        // Update user posts UI in case profile photo is changed
        loadUserPosts();
      } else {
        showToast(res.message || 'Failed to update profile.', 'error');
      }

      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    });
  }

  // Comment Form inside Profile (same comments logic)
  const commentForm = document.getElementById('modal-comment-form');
  const commentInput = document.getElementById('modal-comment-input');
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const postId = document.getElementById('modal-comment-post-id').value;
      const commentText = commentInput.value.trim();

      if (!postId || !commentText) return;
      commentInput.value = '';

      const res = await apiFetch('/comments', {
        method: 'POST',
        body: { postId, commentText },
      });

      if (res && res.success) {
        const emptyState = document.querySelector('#modal-comments-list .empty-state');
        if (emptyState) emptyState.remove();
        // Socket.io 'newComment' appends it.
      } else {
        showToast(res.message || 'Failed to submit comment.', 'error');
      }
    });
  }

  document.getElementById('btn-close-comments-modal').addEventListener('click', () => {
    document.getElementById('comments-modal').classList.add('hidden');
    currentOpenPostIdForComments = null;
  });
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
