# Facebook Lite Clone (Mini Social Media Web Application)

A lightweight, responsive social media platform clone built with Node.js/Express, MongoDB, and Vanilla JavaScript/CSS. The project features real-time interactions using Socket.io (for likes, comments, and follow notifications) and multi-factor authentication paths including standard email/password, Firebase Google OAuth, and Phone OTP validation.

---

## Key Features

### 1. User Authentication
* **Standard Authentication**: Secure registration and login with email, name, and password. Password hashing is handled using `bcryptjs` on the server before saving to the database.
* **Google OAuth**: Integrated Firebase Google Sign-In on the client-side, verified securely by the backend utilizing Firebase Admin SDK token validation.
* **Phone Auth (OTP)**: Integrated Firebase Phone Auth on the client-side to sign in using Phone OTP, verified on the backend.
* **Session Management**: JSON Web Token (JWT) based stateless authorization stored in the browser's local storage and sent in headers (`Authorization: Bearer <token>`).

### 2. Interactive News Feed
* **Feed Display**: Paginated news feed loading posts dynamically with a "Load More" trigger.
* **Post Creation**: Users can create text posts or upload images. Image upload logic is handled via a local storage pipeline utilizing `multer` on the backend.
* **Likes & Comments**: Interactive like buttons and a side drawer comments section. Updates update instantly without page reloads using Socket.io events.

### 3. User Profiles & Follow System
* **Dynamic Profiles**: Separate profile page for each user displaying their customized bio, profile avatar, follower/following statistics, and timeline of posts.
* **Follow/Unfollow**: Users can follow or unfollow other accounts, which updates their status and feeds in real-time.
* **Profile Editing**: An interactive edit profile modal allowing users to change their bio and upload new profile pictures.

### 4. Real-time Notifications
* Real-time socket events notify users instantly when:
  * Someone likes their post.
  * Someone comments on their post.
  * Someone starts following them.
* Unread count badges are displayed on the notification bell, with options to view dropdown lists and mark all notifications as read.

### 5. Custom Search Bar
* A debounced global search bar in the header to find users by their name, redirecting directly to their profile pages.

---

## Tech Stack

* **Backend**: Node.js, Express.js
* **Database**: MongoDB, Mongoose (ODM)
* **Real-time Communication**: Socket.io (Server & Client)
* **Security & Optimization**: Helmet, CORS, Express-Rate-Limit (to prevent spam/brute-force attacks)
* **Frontend**: HTML5, CSS3 (Vanilla CSS with CSS variables for custom styling/themes), Vanilla ES6 JavaScript, Firebase Client SDK

---

## Folder Structure

```text
├── backend/
│   ├── config/             # Database connection & Firebase admin configs
│   ├── controllers/        # Core business logic handlers (auth, post, user, etc.)
│   ├── middleware/         # Auth guarding, rate limiting, and multer uploads
│   ├── models/             # Mongoose schemas (User, Post, Like, Comment, Follower, Notification)
│   ├── routes/             # Express route mappings
│   ├── uploads/            # Local directory to store uploaded profile pics/post images
│   └── server.js           # Server entry point, express app setup, and Socket.io configuration
│
└── frontend/
    ├── css/                # App styling sheets (including responsive layout rules)
    ├── js/                 # Client side modules (api.js, auth.js, feed.js, profile.js, notifications.js)
    ├── feed.html           # Main user homepage/feed template
    ├── index.html          # Entry/root router page
    ├── login.html          # Authentication screens (Login/Registration/OTP)
    └── profile.html        # Public and personal profile screens
```

---

## Setup & Installation

### Prerequisites
* **Node.js** (v16.x or higher)
* **MongoDB** (Running locally or MongoDB Atlas connection string)

### Steps

1. **Clone the repository and go to the project root directory**:
   ```bash
   cd "Internship Project"
   ```

2. **Navigate to the backend directory and install dependencies**:
   ```bash
   cd backend
   ```
   Install required packages:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file inside the `backend/` directory and configure the following variables:
   ```env
   PORT=5050
   MONGO_URI=mongodb://127.0.0.1:27017/mini_social_db
   JWT_SECRET=your_super_secret_jwt_key
   NODE_ENV=development
   ```

4. **Run the Application**:
   * For production/standard execution:
     ```bash
     npm start
     ```
   * For development execution:
     ```bash
     npm run dev
     ```

5. **Access the application**:
   Open your browser and navigate to: `http://localhost:5050`

---

## API Endpoints Reference

### Authentication
* `POST /api/auth/register` - Create a new user account
* `POST /api/auth/login` - Authenticate user credentials and return a token
* `POST /api/auth/google` - Exchange Firebase ID token for Google authentication
* `POST /api/auth/phone` - Authenticate using Phone OTP Firebase verification
* `GET /api/auth/me` - Get profile details of the currently authenticated user

### Users
* `GET /api/users/:id` - Get user details by ID (includes follower stats)
* `PUT /api/users/profile` - Update user bio and profile picture
* `GET /api/users/:id/posts` - Fetch posts created by a specific user
* `POST /api/users/:id/follow` - Toggle follow/unfollow status for a target user
* `GET /api/users/search` - Search users by name

### Posts
* `GET /api/posts` - Fetch posts for the news feed (paginated)
* `POST /api/posts` - Create a new post (supports text/images)
* `POST /api/posts/:id/like` - Toggle like/unlike on a post
* `DELETE /api/posts/:id` - Delete a post (requires authorship)

### Comments
* `GET /api/comments/post/:postId` - Get comments for a post
* `POST /api/comments` - Post a new comment

### Notifications
* `GET /api/notifications` - Retrieve list of notifications for the logged-in user
* `PUT /api/notifications/read` - Mark all notifications as read
