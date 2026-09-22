/* ==================================================================
   Shared navbar behaviour: auth state, cart badge, categories menu,
   global search, logout and flash messages.
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
});

async function initNavbar() {
  highlightActiveNav();
  refreshAuthUI(getStoredUser());
  updateCartBadge();
  bindSearch();
  bindLogout();

  const flash = consumeFlash();
  if (flash) {
    setTimeout(() => showToast(flash.message, flash.type || 'info'), 250);
  }

  loadNavCategories();

  if (isLoggedIn()) {
    try {
      const user = await api('/account/profile');
      setSession(getToken(), user);
      refreshAuthUI(user);
    } catch (err) {
      // 401 already cleared the session inside api()
      refreshAuthUI(getStoredUser());
    }
  }
}

document.addEventListener('am:session-expired', () => refreshAuthUI(null));

function highlightActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.am-navbar .nav-link[data-nav]').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === page);
  });
}

function refreshAuthUI(user) {
  const guestBox = document.getElementById('authGuest');
  const userBox = document.getElementById('authUser');
  if (!guestBox || !userBox) return;

  const signedIn = !!user && isLoggedIn();
  guestBox.classList.toggle('d-none', signedIn);
  userBox.classList.toggle('d-none', !signedIn);

  if (signedIn) {
    const name = user.fullName || user.email || 'User';
    const role = (user.role || '').toUpperCase();
    const avatar = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatar');
    if (avatar) avatar.textContent = name.split(' ')[0];
    if (emailEl) emailEl.textContent = (user.email || '') + (role ? '  ·  ' + role : '');
    if (avatarEl) avatarEl.textContent = name.trim().charAt(0).toUpperCase();
    ensureDashboardLink(role);
  }
}

/** Injects a role-aware "Dashboard" entry into the user dropdown (all pages). */
function ensureDashboardLink(role) {
  const menu = document.querySelector('#authUser .dropdown-menu');
  if (!menu) return;

  let item = document.getElementById('dashMenuItem');
  if (!item) {
    item = document.createElement('li');
    item.id = 'dashMenuItem';
    const accountItem = menu.querySelector('a[href="/account.html"]');
    if (accountItem && accountItem.parentElement) {
      menu.insertBefore(item, accountItem.parentElement);
    } else {
      menu.appendChild(item);
    }
  }

  const icons = { ADMIN: 'bi-grid-3x3-gap', SELLER: 'bi-shop', BUYER: 'bi-speedometer2' };
  const labels = { ADMIN: 'Admin Dashboard', SELLER: 'Seller Dashboard', BUYER: 'My Dashboard' };
  item.innerHTML = '<a class="dropdown-item" id="dashboardLink" href="' + roleHome(role) + '">' +
    '<i class="bi ' + (icons[role] || icons.BUYER) + ' me-2"></i>' +
    (labels[role] || 'My Dashboard') + '</a>';
}

function bindSearch() {
  const form = document.getElementById('navSearchForm');
  const input = document.getElementById('navSearchInput');
  if (!form || !input) return;

  const current = queryParam('search');
  if (current && (location.pathname.endsWith('products.html') || location.pathname === '/')) {
    input.value = current;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const query = input.value.trim();
    location.href = '/products.html' + (query ? '?search=' + encodeURIComponent(query) : '');
  });
}

function bindLogout() {
  const button = document.getElementById('logoutBtn');
  if (!button) return;
  button.addEventListener('click', () => {
    clearSession();
    setFlash('success', 'You have been logged out successfully');
    location.href = '/index.html';
  });
}

async function loadNavCategories() {
  const dropdown = document.getElementById('navCategoryMenu');
  const footerList = document.getElementById('footerCats');
  try {
    const categories = await api('/categories', { auth: false });
    if (!Array.isArray(categories)) return;

    if (dropdown) {
      dropdown.innerHTML = categories.map(category =>
        '<li><a class="dropdown-item" href="/products.html?category=' +
        encodeURIComponent(category.slug) + '">' +
        escapeHtml(category.name) + '</a></li>'
      ).join('');
    }

    if (footerList) {
      footerList.innerHTML = categories.slice(0, 7).map(category =>
        '<a href="/products.html?category=' + encodeURIComponent(category.slug) + '">' +
        escapeHtml(category.name) + '</a>'
      ).join('');
    }
  } catch (err) {
    // categories are decorative here - ignore failures
  }
}
