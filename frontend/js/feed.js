/**
 * Feed Logic and Socket.io Real-time Client
 */

let socket;
let currentPage = 1;
const limit = 10;
let loadingPosts = false;
let allPostsLoaded = false;
let currentOpenPostIdForComments = null;

document.addEventListener('DOMContentLoaded', () => {
  const me = getCachedUser();
  if (!me) {
    window.location.href = '/login.html';
    return;
  }

  // Set local UI avatar and name elements
  updateSidebarUI(me);

  // Initialize Socket.io Connection
  initSocket(me._id);

  // Load Feed Data
  loadFeed();
  loadSuggestions();

  // Load latest profile info from server to sync cache
  refreshUserProfile();

  // Setup Event Listeners
  setupFeedEventListeners();
});

/**
 * Sync UI sidebar details
 */
function updateSidebarUI(user) {
  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0aec0'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";
  const sidebarAvatar = document.getElementById('sidebar-user-avatar');
  const sidebarName = document.getElementById('sidebar-user-name');
  const sidebarBio = document.getElementById('sidebar-user-bio');
  const createPostAvatar = document.getElementById('create-post-user-avatar');

  if (sidebarAvatar) sidebarAvatar.src = user.profilePic || defaultAvatar;
  if (createPostAvatar) createPostAvatar.src = user.profilePic || defaultAvatar;
  if (sidebarName) sidebarName.textContent = user.name;
  if (sidebarBio) sidebarBio.textContent = user.bio || 'Add a bio';

  const viewProfileBtn = document.getElementById('sidebar-view-profile-btn');
  if (viewProfileBtn) {
    viewProfileBtn.addEventListener('click', () => {
      window.location.href = `/profile.html?id=${user._id}`;
    });
  }
}

/**
 * Fetch fresh profile and update localStorage
 */
async function refreshUserProfile() {
  const res = await apiFetch('/auth/me');
  if (res && res.success) {
    localStorage.setItem('user', JSON.stringify(res.data));
    updateSidebarUI(res.data);
  }
}

/**
 * Socket.io Real-time Setup
 */
function initSocket(userId) {
  // socket.io is loaded via script tag in feed.html. It connects back to same host.
  socket = io();

  // Register room
  socket.emit('joinRoom', userId);

  // Real-time Post Prepend
  socket.on('newPost', (post) => {
    const feedContainer = document.getElementById('posts-feed-container');
    if (feedContainer) {
      // Check if post already rendered
      if (!document.getElementById(`post-${post._id}`)) {
        const postElement = createPostCard(post);
        // Prepend new post card right after loader or at top
        const loader = document.getElementById('feed-loader');
        if (loader) {
          loader.insertAdjacentElement('afterend', postElement);
        } else {
          feedContainer.prepend(postElement);
        }
      }
    }
  });

  // Real-time Like Update
  socket.on('likeUpdate', (data) => {
    const postCard = document.getElementById(`post-${data.postId}`);
    if (postCard) {
      // Update like count text
      const likeTextEl = postCard.querySelector('.like-count-text');
      if (likeTextEl) {
        likeTextEl.textContent = `${data.likeCount} like${data.likeCount === 1 ? '' : 's'}`;
      }

      // If this socket update is for the current user, toggle visual liked class
      const me = getCachedUser();
      if (me && data.userId === me._id) {
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

  // Real-time Comment Update
  socket.on('newComment', (data) => {
    // 1. Update comment count on feed card
    const postCard = document.getElementById(`post-${data.postId}`);
    if (postCard) {
      const commentCountEl = postCard.querySelector('.comment-count-text');
      if (commentCountEl) {
        // Read current count
        const text = commentCountEl.textContent;
        const currentCount = parseInt(text) || 0;
        const newCount = currentCount + 1;
        commentCountEl.textContent = `${newCount} comment${newCount === 1 ? '' : 's'}`;
      }
    }

    // 2. If comments modal is active for this post, append comment in real-time
    if (currentOpenPostIdForComments === data.postId) {
      const list = document.getElementById('modal-comments-list');
      if (list) {
        const commentEl = createCommentElement(data.comment);
        list.appendChild(commentEl);
        // Scroll comments body to bottom
        const body = document.querySelector('.comments-modal-body');
        if (body) body.scrollTop = body.scrollHeight;
      }
    }
  });

  // Real-time Post Delete
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
 * Fetch and Render Feed Posts (Paginated)
 */
async function loadFeed(page = 1) {
  if (loadingPosts || allPostsLoaded) return;
  loadingPosts = true;

  const res = await apiFetch(`/posts?page=${page}&limit=${limit}`);
  const loader = document.getElementById('feed-loader');
  const feedContainer = document.getElementById('posts-feed-container');

  if (res && res.success) {
    if (loader) loader.classList.add('hidden');

    if (res.data.length === 0) {
      allPostsLoaded = true;
      if (page === 1) {
        feedContainer.innerHTML = '<div class="empty-state">No posts to show yet. Be the first to share something!</div>';
      }
      document.getElementById('btn-load-more-posts').classList.add('hidden');
    } else {
      res.data.forEach(post => {
        // Double check it's not already rendered
        if (!document.getElementById(`post-${post._id}`)) {
          const card = createPostCard(post);
          feedContainer.appendChild(card);
        }
      });

      if (res.data.length < limit) {
        allPostsLoaded = true;
        document.getElementById('btn-load-more-posts').classList.add('hidden');
      } else {
        document.getElementById('btn-load-more-posts').classList.remove('hidden');
      }
      currentPage = page;
    }
  } else {
    showToast('Failed to load news feed posts.', 'error');
  }
  loadingPosts = false;
}

/**
 * Suggest people list
 */
async function loadSuggestions() {
  const list = document.getElementById('suggestions-list');
  if (!list) return;

  // Search users with wildcard character 'a' or empty
  const res = await apiFetch('/users/search?q=a');
  if (res && res.success && res.data.length > 0) {
    list.innerHTML = '';
    res.data.slice(0, 5).forEach(user => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      const avatarSrc = user.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0aec0'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";

      li.innerHTML = `
        <div class="suggest-profile">
          <img src="${avatarSrc}" alt="Avatar" class="avatar">
          <div class="suggest-name">${user.name}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="window.location.href='/profile.html?id=${user._id}'">View</button>
      `;
      list.appendChild(li);
    });
  } else {
    list.innerHTML = '<li class="empty-state">No suggestions found</li>';
  }
}

/**
 * Generate Post Card element
 */
function createPostCard(post) {
  const card = document.createElement('div');
  card.className = 'card';
  card.id = `post-${post._id}`;

  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0aec0'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";
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
        <a href="/profile.html?id=${post.userId._id}"><img src="${authorAvatar}" alt="Avatar" class="avatar"></a>
        <div>
          <a href="/profile.html?id=${post.userId._id}" class="post-author-name">${authorName}</a>
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
      // Toggle button visual state immediately
      const isLiked = res.data.liked;
      e.target.classList.toggle('liked', isLiked);
      e.target.innerHTML = isLiked ? '👍 Liked' : '👍 Like';
      
      // Update count text
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
 * Open Comment Drawer Modal
 */
async function openCommentsModal(postId) {
  currentOpenPostIdForComments = postId;
  document.getElementById('modal-comment-post-id').value = postId;
  
  const commentsList = document.getElementById('modal-comments-list');
  commentsList.innerHTML = '<div class="feed-spinner"><div class="spinner"></div><p>Loading comments...</p></div>';
  
  // Show Modal Overlay
  const modal = document.getElementById('comments-modal');
  modal.classList.remove('hidden');

  // Load comments
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
    // Scroll comments list to bottom
    const body = document.querySelector('.comments-modal-body');
    if (body) body.scrollTop = body.scrollHeight;
  } else {
    commentsList.innerHTML = '<p class="text-center text-muted">Failed to load comments</p>';
  }
}

/**
 * Generate individual Comment element
 */
function createCommentElement(comment) {
  const el = document.createElement('div');
  el.className = 'comment-item';

  const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0aec0'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";
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
 * Bind all standard UI feed listeners
 */
function setupFeedEventListeners() {
  const postInput = document.getElementById('post-image-input');
  const previewContainer = document.getElementById('post-image-preview-container');
  const previewImage = document.getElementById('post-image-preview');
  const btnRemovePreview = document.getElementById('btn-remove-preview');
  const btnSubmitPost = document.getElementById('btn-submit-post');
  const txtContent = document.getElementById('create-post-textarea');

  // Preview selected image
  postInput.addEventListener('change', () => {
    const file = postInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  // Remove image preview
  btnRemovePreview.addEventListener('click', () => {
    postInput.value = '';
    previewImage.src = '';
    previewContainer.classList.add('hidden');
  });

  // Submit Post handler
  btnSubmitPost.addEventListener('click', async () => {
    const content = txtContent.value.trim();
    const imageFile = postInput.files[0];

    if (!content && !imageFile) {
      showToast('Please type something or choose an image.', 'error');
      return;
    }

    // Disable post submission during loading
    btnSubmitPost.disabled = true;
    btnSubmitPost.textContent = 'Posting...';

    // Use FormData for file upload compatibility
    const formData = new FormData();
    formData.append('content', content);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    const res = await apiFetch('/posts', {
      method: 'POST',
      body: formData,
    });

    if (res && res.success) {
      txtContent.value = '';
      postInput.value = '';
      previewImage.src = '';
      previewContainer.classList.add('hidden');
      showToast('Post shared successfully!', 'success');
      // Note: socket.io emits `newPost` which will render the post at the top automatically
    } else {
      showToast(res.message || 'Failed to submit post.', 'error');
    }

    btnSubmitPost.disabled = false;
    btnSubmitPost.textContent = 'Post';
  });

  // Comments Form Submission
  const commentForm = document.getElementById('modal-comment-form');
  const commentInput = document.getElementById('modal-comment-input');
  
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
      // Remove empty state if present
      const emptyState = document.querySelector('#modal-comments-list .empty-state');
      if (emptyState) emptyState.remove();

      // Comment is dynamically appended by socket.io 'newComment' listener!
      // In case socket fails, fallback manually append can be done, but socket handles it globally.
    } else {
      showToast(res.message || 'Failed to post comment.', 'error');
    }
  });

  // Close Comments Modal
  document.getElementById('btn-close-comments-modal').addEventListener('click', () => {
    document.getElementById('comments-modal').classList.add('hidden');
    currentOpenPostIdForComments = null;
  });

  // Close comments modal when clicking background overlay
  document.getElementById('comments-modal').addEventListener('click', (e) => {
    if (e.target.id === 'comments-modal') {
      document.getElementById('comments-modal').classList.add('hidden');
      currentOpenPostIdForComments = null;
    }
  });

  // Load More Posts
  const btnLoadMore = document.getElementById('btn-load-more-posts');
  btnLoadMore.addEventListener('click', () => {
    loadFeed(currentPage + 1);
  });
}

/**
 * Escapes characters to prevent XSS vulnerability
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
