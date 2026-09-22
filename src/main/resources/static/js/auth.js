/* ==================================================================
   Auth pages: login, registration, forgot password, reset password.
   The right handler is chosen from the form present on the page.
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  bindPasswordToggles();

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');
  const resetForm = document.getElementById('resetForm');

  if (loginForm) initLogin(loginForm);
  if (registerForm) initRegister(registerForm);
  if (forgotForm) initForgot(forgotForm);
  if (resetForm) initReset(resetForm);
});

function bindPasswordToggles() {
  document.querySelectorAll('.toggle-pass').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const showing = target.type === 'text';
      target.type = showing ? 'password' : 'text';
      button.classList.toggle('bi-eye', showing);
      button.classList.toggle('bi-eye-slash', !showing);
    });
  });
}

function valueOf(form, name) {
  const field = form.querySelector('[name="' + name + '"]');
  return field ? field.value.trim() : '';
}

/** Where to send a user after login/registration: ?next= wins, else their dashboard. */
function afterAuthDestination() {
  const next = queryParam('next');
  if (next && next.startsWith('/')) return next;
  return roleHome(userRole());
}

/* ------------------------- login ------------------------- */

function initLogin(form) {
  if (isLoggedIn()) {
    location.href = afterAuthDestination();
    return;
  }

  const flash = consumeFlash();
  if (flash) showToast(flash.message, flash.type || 'info');

  const alertBox = document.getElementById('loginAlert');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFieldErrors(form);
    if (alertBox) alertBox.classList.add('d-none');

    const email = valueOf(form, 'email');
    const password = valueOf(form, 'password');
    let valid = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(form, 'email', 'Enter a valid email address');
      valid = false;
    }
    if (!password) {
      setFieldError(form, 'password', 'Password is required');
      valid = false;
    }
    if (!valid) return;

    const submit = form.querySelector('[type="submit"]');
    setLoading(submit, true, 'Signing in…');

    try {
      const response = await api('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      setSession(response.token, response.user);
      showToast(response.message || 'Logged in successfully', 'success');
      location.href = afterAuthDestination();
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = err.message || 'Login failed. Please try again.';
        alertBox.classList.remove('d-none');
      } else {
        showToast(err.message, 'error');
      }
      applyServerErrors(form, err.errors);
      setLoading(submit, false);
    }
  });
}

/* ------------------------- registration ------------------------- */

function initRegister(form) {
  if (isLoggedIn()) {
    location.href = afterAuthDestination();
    return;
  }

  const alertBox = document.getElementById('registerAlert');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFieldErrors(form);
    if (alertBox) alertBox.classList.add('d-none');

    const fullName = valueOf(form, 'fullName');
    const email = valueOf(form, 'email');
    const phone = valueOf(form, 'phone');
    const password = valueOf(form, 'password');
    const confirmPassword = valueOf(form, 'confirmPassword');
    const terms = form.querySelector('[name="terms"]');
    const roleInput = form.querySelector('[name="role"]:checked');
    const role = roleInput ? roleInput.value : 'BUYER';

    let valid = true;

    if (fullName.length < 2) {
      setFieldError(form, 'fullName', 'Enter your full name (at least 2 characters)');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(form, 'email', 'Enter a valid email address');
      valid = false;
    }
    if (phone && !/^[6-9][0-9]{9}$/.test(phone)) {
      setFieldError(form, 'phone', 'Enter a valid 10-digit mobile number');
      valid = false;
    }
    if (password.length < 8) {
      setFieldError(form, 'password', 'Use at least 8 characters');
      valid = false;
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setFieldError(form, 'password', 'Include at least one letter and one number');
      valid = false;
    }
    if (confirmPassword !== password) {
      setFieldError(form, 'confirmPassword', 'Passwords do not match');
      valid = false;
    }
    if (terms && !terms.checked) {
      setFieldError(form, 'terms', 'Please accept the terms to continue');
      valid = false;
    }
    if (!valid) return;

    const submit = form.querySelector('[type="submit"]');
    setLoading(submit, true, 'Creating account…');

    try {
      const response = await api('/auth/register', {
        method: 'POST',
        auth: false,
        body: { fullName, email, password, phone, role }
      });
      setSession(response.token, response.user);
      setFlash('success', 'Welcome to AATHIRA MART, ' + response.user.fullName.split(' ')[0] + '!');
      location.href = roleHome(response.user.role);
    } catch (err) {
      if (alertBox) {
        alertBox.textContent = err.message || 'Registration failed. Please try again.';
        alertBox.classList.remove('d-none');
      }
      applyServerErrors(form, err.errors);
      setLoading(submit, false);
    }
  });
}

/* ------------------------- forgot password ------------------------- */

function initForgot(form) {
  const resultBox = document.getElementById('forgotResult');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFieldErrors(form);
    if (resultBox) resultBox.classList.add('d-none');

    const email = valueOf(form, 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError(form, 'email', 'Enter a valid email address');
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    setLoading(submit, true, 'Generating link…');

    try {
      const response = await api('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email }
      });

      form.classList.add('d-none');
      if (resultBox) {
        const link = response.data;
        resultBox.innerHTML =
          '<div class="alert alert-success alert-msg"><i class="bi bi-envelope-check me-2"></i>' +
          escapeHtml(response.message) + '</div>' +
          (link
            ? '<div class="alert alert-warning alert-msg">' +
              '<b> Demo mode:</b> email delivery is not configured, so use this link directly:</div>' +
              '<a class="btn btn-primary-am w-100 mb-2" href="' + escapeHtml(link) + '">' +
              '<i class="bi bi-key me-1"></i>Open password reset page</a>' +
              '<code class="d-block text-center small text-muted">' + escapeHtml(link) + '</code>'
            : '') +
          '<div class="auth-alt"><a href="/login.html">Back to login</a></div>';
        resultBox.classList.remove('d-none');
      }
      showToast(response.message, 'success');
    } catch (err) {
      applyServerErrors(form, err.errors);
      handleApiError(err);
      setLoading(submit, false);
    }
  });
}

/* ------------------------- reset password ------------------------- */

function initReset(form) {
  const tokenField = form.querySelector('[name="token"]');
  const tokenFromUrl = queryParam('token');
  const missingBox = document.getElementById('resetTokenMissing');

  if (tokenField && tokenFromUrl) tokenField.value = tokenFromUrl;

  if (!tokenField.value) {
    form.classList.add('d-none');
    if (missingBox) missingBox.classList.remove('d-none');
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFieldErrors(form);

    const token = valueOf(form, 'token');
    const newPassword = valueOf(form, 'newPassword');
    const confirmPassword = valueOf(form, 'confirmPassword');
    let valid = true;

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setFieldError(form, 'newPassword', 'Use 8+ characters with at least one letter and one number');
      valid = false;
    }
    if (confirmPassword !== newPassword) {
      setFieldError(form, 'confirmPassword', 'Passwords do not match');
      valid = false;
    }
    if (!valid) return;

    const submit = form.querySelector('[type="submit"]');
    setLoading(submit, true, 'Updating password…');

    try {
      const response = await api('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, newPassword }
      });
      setFlash('success', response.message || 'Password updated. Please log in.');
      location.href = '/login.html';
    } catch (err) {
      applyServerErrors(form, err.errors);
      handleApiError(err);
      setLoading(submit, false);
    }
  });
}
