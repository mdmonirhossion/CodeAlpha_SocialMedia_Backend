/**
 * Auth JavaScript for Facebook Lite Clone with Firebase Integration
 */

const firebaseConfig = {
  apiKey: "AIzaSyCRKCNrWVVPVk6ArxXMHgYAYWvZD0wdnn0",
  authDomain: "mini-social-platform-7bdd1.firebaseapp.com",
  projectId: "mini-social-platform-7bdd1",
  storageBucket: "mini-social-platform-7bdd1.firebasestorage.app",
  messagingSenderId: "309394054582",
  appId: "1:309394054582:web:088eecb2e9261c13a3b517",
  measurementId: "G-SGHFR11M0V"
};

// Initialize Firebase client-side SDK
if (typeof firebase !== 'undefined') {
  // Configure Firebase App Check Debug token for test environments
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = "Ae0iMNduB8VzlHzI7Al_wD4s5MF03P59LpZSemno4cNAJJWIG3Wpw_KYBZZp2e8kn8chQsn6FbXUaFCBDTPzR8FeIcj1fFFDwPkDibJ9TgGU5QG2P1iLSZ8BtRvHxUPS5pwqjwoJvErWZXmcCGWn2CXZ";
  
  firebase.initializeApp(firebaseConfig);
  
  // Enable phone authentication bypass settings for debug verification
  firebase.auth().settings.appVerificationDisabledForTesting = true;
}

document.addEventListener('DOMContentLoaded', () => {
  // Check if token exists, redirect if so
  if (localStorage.getItem('token')) {
    window.location.href = '/feed.html';
    return;
  }

  // Handle redirect result if user returns from Google Auth redirect
  if (typeof firebase !== 'undefined') {
    firebase.auth().getRedirectResult()
      .then(async (result) => {
        if (result && result.user) {
          const loginError = document.getElementById('login-error');
          const btnGoogleLogin = document.getElementById('btn-google-login');
          if (loginError) loginError.classList.add('hidden');
          
          if (btnGoogleLogin) {
            btnGoogleLogin.disabled = true;
            btnGoogleLogin.textContent = 'Connecting to Google...';
          }

          const firebaseUser = result.user;
          const idToken = await firebaseUser.getIdToken();

          // Exchange Firebase token for Backend JWT
          const res = await apiFetch('/auth/google', {
            method: 'POST',
            body: {
              idToken,
              name: firebaseUser.displayName,
              email: firebaseUser.email,
              firebaseUid: firebaseUser.uid,
              profilePic: firebaseUser.photoURL
            }
          });

          if (res && res.success) {
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify({
              _id: res.data._id,
              name: res.data.name,
              email: res.data.email,
              bio: res.data.bio,
              profilePic: res.data.profilePic,
            }));
            window.location.href = '/feed.html';
          } else {
            if (loginError) {
              loginError.innerText = res.message || 'Google sign-in verification failed on server.';
              loginError.classList.remove('hidden');
            }
          }

          if (btnGoogleLogin) {
            btnGoogleLogin.disabled = false;
            btnGoogleLogin.textContent = 'Continue with Google';
          }
        }
      })
      .catch((error) => {
        console.error('Google Redirect Auth Error:', error);
        const loginError = document.getElementById('login-error');
        if (loginError) {
          loginError.innerText = error.message || 'Google redirect login failed.';
          loginError.classList.remove('hidden');
        }
      });
  }

  // Cards
  const loginCard = document.getElementById('login-card');
  const registerCard = document.getElementById('register-card');
  const phoneCard = document.getElementById('phone-card');

  // Toggle Buttons
  const btnShowRegister = document.getElementById('btn-show-register');
  const btnShowLogin = document.getElementById('btn-show-login');
  const btnShowPhone = document.getElementById('btn-show-phone');
  const btnPhoneCancel = document.getElementById('btn-phone-cancel');

  // Forms
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const phoneSendForm = document.getElementById('phone-send-form');
  const phoneVerifyForm = document.getElementById('phone-verify-form');

  // Error Areas
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const phoneError = document.getElementById('phone-error');

  // Switch to Register Card
  btnShowRegister.addEventListener('click', () => {
    loginCard.classList.add('hidden');
    loginCard.classList.remove('active');
    registerCard.classList.remove('hidden');
    registerCard.classList.add('active');
    registerError.classList.add('hidden');
  });

  // Switch to Login Card
  btnShowLogin.addEventListener('click', () => {
    registerCard.classList.add('hidden');
    registerCard.classList.remove('active');
    loginCard.classList.remove('hidden');
    loginCard.classList.add('active');
    loginError.classList.add('hidden');
  });

  // Switch to Phone Card
  if (btnShowPhone) {
    btnShowPhone.addEventListener('click', () => {
      loginCard.classList.add('hidden');
      phoneCard.classList.remove('hidden');
      phoneError.classList.add('hidden');
      
      // Reset forms
      phoneSendForm.classList.remove('hidden');
      phoneVerifyForm.classList.add('hidden');
      document.getElementById('phone-number').value = '';
      document.getElementById('phone-otp').value = '';
      
      const btnSend = document.getElementById('btn-send-code');
      btnSend.disabled = false;
      btnSend.textContent = 'Send Verification Code';
    });
  }

  // Cancel Phone Sign In
  if (btnPhoneCancel) {
    btnPhoneCancel.addEventListener('click', () => {
      phoneCard.classList.add('hidden');
      loginCard.classList.remove('hidden');
    });
  }

  // Password Visibility Toggle Logic
  const passwordGroups = document.querySelectorAll('.form-group-password');
  passwordGroups.forEach(group => {
    const input = group.querySelector('input');
    const toggleBtn = group.querySelector('.password-toggle-btn');
    
    if (input && toggleBtn) {
      // Show/Hide toggle button based on input length
      input.addEventListener('input', () => {
        if (input.value.length > 0) {
          toggleBtn.classList.remove('hidden');
        } else {
          toggleBtn.classList.add('hidden');
        }
      });

      // Toggle input type on click
      toggleBtn.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          toggleBtn.textContent = '🙈'; // Monkey covering eyes (Hide)
        } else {
          input.type = 'password';
          toggleBtn.textContent = '👁️'; // Open eye (Show)
        }
      });
    }
  });

  // Handle Login Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (res && res.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify({
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        bio: res.data.bio,
        profilePic: res.data.profilePic,
      }));
      window.location.href = '/feed.html';
    } else {
      loginError.innerText = res.message || 'Login failed. Invalid credentials.';
      loginError.classList.remove('hidden');
    }
  });

  // Handle Register Submission
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.classList.add('hidden');

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });

    if (res && res.success) {
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify({
        _id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        bio: res.data.bio,
        profilePic: res.data.profilePic,
      }));
      window.location.href = '/feed.html';
    } else {
      if (res.errors) {
        registerError.innerText = res.errors.map(err => err.msg).join(', ');
      } else {
        registerError.innerText = res.message || 'Registration failed.';
      }
      registerError.classList.remove('hidden');
    }
  });

  // ==========================================
  // FIREBASE OAUTH & PHONE OTP INTEGRATION
  // ==========================================

  if (typeof firebase !== 'undefined') {
    // 1. Google OAuth Authentication
    const btnGoogleLogin = document.getElementById('btn-google-login');
    if (btnGoogleLogin) {
      const googleProvider = new firebase.auth.GoogleAuthProvider();
      
      btnGoogleLogin.addEventListener('click', async () => {
        loginError.classList.add('hidden');
        btnGoogleLogin.disabled = true;
        btnGoogleLogin.textContent = 'Connecting to Google...';

        try {
          // Trigger Google sign-in redirect flow
          await firebase.auth().signInWithRedirect(googleProvider);
        } catch (error) {
          console.error('Google Auth Error:', error);
          loginError.innerText = error.message || 'Google authentication encountered an error.';
          loginError.classList.remove('hidden');
          btnGoogleLogin.disabled = false;
          btnGoogleLogin.textContent = 'Continue with Google';
        }
      });
    }

    // 2. Phone Verification (OTP) authentication
    let confirmationResult = null;

    // Initialize invisible reCAPTCHA Verifier
    const recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      }
    });

    // Step 1: Submit Phone Number & Send OTP Code
    phoneSendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      phoneError.classList.add('hidden');
      
      const btnSend = document.getElementById('btn-send-code');
      btnSend.disabled = true;
      btnSend.textContent = 'Sending SMS...';

      let phoneNumber = document.getElementById('phone-number').value.trim();

      // Auto-prefix country code (+88) for standard Bangladeshi formats
      if (phoneNumber.startsWith('0') && phoneNumber.length === 11) {
        phoneNumber = '+88' + phoneNumber;
      } else if (phoneNumber.startsWith('880') && phoneNumber.length === 13) {
        phoneNumber = '+' + phoneNumber;
      }

      try {
        confirmationResult = await firebase.auth().signInWithPhoneNumber(phoneNumber, recaptchaVerifier);
        showToast('Verification OTP code sent successfully!', 'success');
        
        // Toggle view
        phoneSendForm.classList.add('hidden');
        phoneVerifyForm.classList.remove('hidden');
      } catch (error) {
        console.error('Phone Sign-In Error:', error);
        phoneError.innerText = error.message || 'Error occurred while sending SMS. Ensure format is +[country_code][number].';
        phoneError.classList.remove('hidden');
        btnSend.disabled = false;
        btnSend.textContent = 'Send Verification Code';
      }
    });

    // Step 2: Submit OTP Verification Code & Auth with Backend
    phoneVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      phoneError.classList.add('hidden');
      
      const btnVerify = document.getElementById('btn-verify-otp');
      btnVerify.disabled = true;
      btnVerify.textContent = 'Verifying Code...';

      const code = document.getElementById('phone-otp').value.trim();

      try {
        const result = await confirmationResult.confirm(code);
        const firebaseUser = result.user;
        const idToken = await firebaseUser.getIdToken();

        // Exchange for backend authentication JWT token
        const res = await apiFetch('/auth/phone', {
          method: 'POST',
          body: {
            idToken,
            phone: firebaseUser.phoneNumber,
            firebaseUid: firebaseUser.uid,
            name: firebaseUser.displayName || `User ${firebaseUser.phoneNumber.slice(-4)}`
          }
        });

        if (res && res.success) {
          localStorage.setItem('token', res.data.token);
          localStorage.setItem('user', JSON.stringify({
            _id: res.data._id,
            name: res.data.name,
            email: res.data.email,
            phone: res.data.phone,
            bio: res.data.bio,
            profilePic: res.data.profilePic,
          }));
          window.location.href = '/feed.html';
        } else {
          phoneError.innerText = res.message || 'Phone verification failed on server.';
          phoneError.classList.remove('hidden');
          btnVerify.disabled = false;
          btnVerify.textContent = 'Verify & Log In';
        }
      } catch (error) {
        console.error('OTP Verification Code Error:', error);
        phoneError.innerText = error.message || 'Invalid code entered. Please try again.';
        phoneError.classList.remove('hidden');
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verify & Log In';
      }
    });
  } else {
    console.warn('Firebase client SDK failed to load. Federated authentications disabled.');
  }
});
