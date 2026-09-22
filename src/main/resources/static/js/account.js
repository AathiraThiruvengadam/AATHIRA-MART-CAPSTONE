/* ==================================================================
   My Account: profile view/edit, password change, logout.
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;

  // password visibility toggles (same helper used by auth pages)
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

  document.getElementById('accountLogoutBtn').addEventListener('click', () => {
    clearSession();
    setFlash('success', 'You have been logged out successfully');
    location.href = '/index.html';
  });

  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('passwordForm').addEventListener('submit', changePassword);

  loadProfile();
});

async function loadProfile() {
  try {
    const profile = await api('/account/profile');
    setSession(getToken(), profile);
    if (typeof refreshAuthUI === 'function') refreshAuthUI(profile);

    document.getElementById('profileName').textContent = profile.fullName;
    document.getElementById('profileEmail').textContent = profile.email;
    document.getElementById('profileRole').textContent = profile.role;
    document.getElementById('profileAvatar').textContent =
      (profile.fullName || '?').trim().charAt(0).toUpperCase();
    document.getElementById('profileSince').textContent = profile.createdAt
      ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        })
      : '—';

    document.getElementById('accFullName').value = profile.fullName || '';
    document.getElementById('accPhone').value = profile.phone || '';
    document.getElementById('accEmail').value = profile.email || '';

    try {
      const orders = await api('/orders');
      document.getElementById('profileOrders').textContent =
        Array.isArray(orders) ? String(orders.length) : '0';
    } catch (e) {
      document.getElementById('profileOrders').textContent = '—';
    }
  } catch (err) {
    handleApiError(err);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearFieldErrors(form);

  const fullName = form.querySelector('[name="fullName"]').value.trim();
  const phone = form.querySelector('[name="phone"]').value.trim();

  let valid = true;
  if (fullName.length < 2) {
    setFieldError(form, 'fullName', 'Enter your full name');
    valid = false;
  }
  if (phone && !/^[6-9][0-9]{9}$/.test(phone)) {
    setFieldError(form, 'phone', 'Enter a valid 10-digit mobile number');
    valid = false;
  }
  if (!valid) return;

  const button = document.getElementById('saveProfileBtn');
  setLoading(button, true, 'Saving…');

  try {
    const updated = await api('/account/profile', {
      method: 'PUT',
      body: { fullName, phone }
    });
    setSession(getToken(), updated);
    if (typeof refreshAuthUI === 'function') refreshAuthUI(updated);
    document.getElementById('profileName').textContent = updated.fullName;
    showToast('Profile updated successfully', 'success');
  } catch (err) {
    applyServerErrors(form, err.errors);
    handleApiError(err);
  } finally {
    setLoading(button, false);
  }
}

async function changePassword(event) {
  event.preventDefault();
  const form = event.currentTarget;
  clearFieldErrors(form);

  const currentPassword = form.querySelector('[name="currentPassword"]').value;
  const newPassword = form.querySelector('[name="newPassword"]').value;
  const confirmPassword = form.querySelector('[name="confirmPassword"]').value;

  let valid = true;
  if (!currentPassword) {
    setFieldError(form, 'currentPassword', 'Enter your current password');
    valid = false;
  }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    setFieldError(form, 'newPassword', 'Use 8+ characters with a letter and a number');
    valid = false;
  }
  if (confirmPassword !== newPassword) {
    setFieldError(form, 'confirmPassword', 'Passwords do not match');
    valid = false;
  }
  if (!valid) return;

  const button = document.getElementById('changePasswordBtn');
  setLoading(button, true, 'Updating…');

  try {
    const response = await api('/account/password', {
      method: 'PUT',
      body: { currentPassword, newPassword }
    });
    form.reset();
    showToast(response.message || 'Password changed successfully', 'success');
  } catch (err) {
    applyServerErrors(form, err.errors);
    handleApiError(err);
  } finally {
    setLoading(button, false);
  }
}
