/**
 * Common API Helper functions for Facebook Lite Clone
 */

const API_BASE = '/api';

// Theme toggling utilities (shared globally)
document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = activeTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
});

/**
 * Universal wrapper for fetch API
 */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  options.headers = options.headers || {};
  
  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  // If the body is not FormData, set Content-Type to JSON
  if (options.body && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    if (typeof options.body === 'object') {
      options.body = JSON.stringify(options.body);
    }
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (response.status === 401) {
      // Token is invalid/expired - force logout
      if (!window.location.pathname.includes('/login.html')) {
        logout();
        return;
      }
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    return { success: false, message: 'Network error. Please try again.' };
  }
}

/**
 * Log out of the application
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

/**
 * Fetch and return local cached user object
 */
function getCachedUser() {
  const userStr = localStorage.getItem('user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Helper to display temporary toast notifications
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon mapping
  let icon = '🔔';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `
    <span>${icon}</span>
    <div>${message}</div>
  `;

  container.appendChild(toast);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Attach logout to logout button if it exists
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Hook search bar logic if elements exist
  const searchInput = document.getElementById('global-search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  const searchResultsList = document.getElementById('search-results-list');

  if (searchInput && searchDropdown && searchResultsList) {
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const query = e.target.value.trim();

      if (!query) {
        searchDropdown.classList.add('hidden');
        return;
      }

      debounceTimer = setTimeout(async () => {
        const res = await apiFetch(`/users/search?q=${encodeURIComponent(query)}`);
        if (res && res.success && res.data.length > 0) {
          searchResultsList.innerHTML = '';
          res.data.forEach(user => {
            const li = document.createElement('li');
            li.className = 'search-item';
            const avatarSrc = user.profilePic || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a0aec0'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";
            
            li.innerHTML = `
              <img src="${avatarSrc}" alt="Avatar" class="avatar">
              <div>
                <div class="suggest-name">${user.name}</div>
                <div class="text-muted" style="font-size: 11px;">${user.bio || 'No bio yet'}</div>
              </div>
            `;
            li.addEventListener('click', () => {
              window.location.href = `/profile.html?id=${user._id}`;
            });
            searchResultsList.appendChild(li);
          });
          searchDropdown.classList.remove('hidden');
        } else {
          searchResultsList.innerHTML = '<li class="empty-state">No users found</li>';
          searchDropdown.classList.remove('hidden');
        }
      }, 300);
    });

    // Close search list on clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.classList.add('hidden');
      }
    });
  }

  // Hook my profile link
  const myProfileLink = document.getElementById('nav-profile-link');
  if (myProfileLink) {
    myProfileLink.addEventListener('click', (e) => {
      e.preventDefault();
      const me = getCachedUser();
      if (me) {
        window.location.href = `/profile.html?id=${me._id}`;
      }
    });
  }
});
