/* ==================================================================
   AATHIRA MART - core helpers
   JWT session, fetch() wrapper with error handling, cart storage,
   toasts, loading states, formatting and product card rendering.
   ================================================================== */

const API_BASE = '/api';
const TOKEN_KEY = 'am_token';
const USER_KEY = 'am_user';
const CART_KEY = 'am_cart';
const FLASH_KEY = 'am_flash';

/* ------------------------- errors ------------------------- */

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 0;
    this.errors = errors || null;
  }
}

/* ------------------------- session ------------------------- */

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
  return !!getToken();
}

function redirectToLogin(nextUrl) {
  const next = nextUrl || (location.pathname + location.search);
  if (location.pathname.endsWith('login.html')) return;
  location.href = '/login.html?next=' + encodeURIComponent(next);
}

/** Guard for pages that require a signed-in user. */
function requireAuth() {
  if (isLoggedIn()) return true;
  setFlash('warning', 'Please sign in to continue');
  redirectToLogin();
  return false;
}

/* ------------------------- roles ------------------------- */

/** Home page for each role's dashboard. */
function roleHome(role) {
  if (role === 'ADMIN') return '/admin-dashboard.html';
  if (role === 'SELLER') return '/seller-dashboard.html';
  return '/buyer-dashboard.html';
}

function userRole() {
  const user = getStoredUser();
  return user && user.role ? String(user.role).toUpperCase() : null;
}

/**
 * Guard for role-specific pages.
 * Usage: if (!requireRole('SELLER', 'ADMIN')) return;
 */
function requireRole() {
  const allowed = Array.prototype.slice.call(arguments);
  if (!isLoggedIn()) {
    setFlash('warning', 'Please sign in to continue');
    redirectToLogin();
    return false;
  }
  const role = userRole();
  if (allowed.indexOf(role) === -1) {
    setFlash('warning', 'You do not have permission to open that page');
    location.href = roleHome(role);
    return false;
  }
  return true;
}

/* ------------------------- flash messages ------------------------- */

function setFlash(type, message) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ type, message }));
  } catch (e) { /* ignore */ }
}

function consumeFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/* ------------------------- toasts ------------------------- */

function ensureToastContainer() {
  let container = document.querySelector('.am-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'am-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type, title) {
  const icons = {
    success: 'bi-check-circle-fill text-success',
    error: 'bi-exclamation-triangle-fill text-danger',
    warning: 'bi-exclamation-circle-fill text-warning',
    info: 'bi-info-circle-fill text-primary'
  };
  const titles = { success: 'Success', error: 'Error', warning: 'Attention', info: 'Info' };

  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = 'am-toast ' + (type || 'info');
  toast.innerHTML =
    '<i class="bi ' + (icons[type] || icons.info) + ' mt-1"></i>' +
    '<div><b>' + escapeHtml(title || titles[type] || 'Info') + '</b>' + escapeHtml(message || '') + '</div>' +
    '<button class="t-close" aria-label="Close">&times;</button>';

  const remove = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = '.25s';
    setTimeout(() => toast.remove(), 250);
  };
  toast.querySelector('.t-close').addEventListener('click', remove);
  container.appendChild(toast);
  setTimeout(remove, 4200);
}

/* ------------------------- fetch wrapper ------------------------- */

async function api(path, options) {
  const opts = Object.assign({ method: 'GET', body: null, auth: true }, options || {});
  const headers = { 'Accept': 'application/json' };

  if (opts.body !== null && opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token && opts.auth !== false) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  let response;
  try {
    response = await fetch(API_BASE + path, {
      method: opts.method,
      headers: headers,
      body: opts.body !== null && opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) {
    throw new ApiError('Cannot reach the server. Please check your connection and try again.', 0);
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      const hadSession = !!token;
      clearSession();
      document.dispatchEvent(new CustomEvent('am:session-expired'));
      const message = data && data.message
        ? data.message
        : (hadSession ? 'Your session has expired. Please log in again.' : 'Please log in to continue');
      throw new ApiError(message, 401, data && data.errors);
    }

    const message = data && data.message
      ? data.message
      : 'Request failed (' + response.status + '). Please try again.';
    throw new ApiError(message, response.status, data && data.errors);
  }

  return data;
}

/** Default error handling used by every page. */
function handleApiError(err) {
  if (!err) return;
  if (err.status === 401) {
    showToast(err.message || 'Please log in to continue', 'warning');
    setTimeout(() => redirectToLogin(), 700);
    return;
  }
  if (err.status === 403) {
    showToast('You do not have permission to perform this action', 'error');
    return;
  }
  showToast(err.message || 'Something went wrong. Please try again.', 'error');
}

/* ------------------------- field validation UI ------------------------- */

function clearFieldErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach(el => { el.textContent = ''; });
  form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function setFieldError(form, name, message) {
  const box = form.querySelector('[data-error-for="' + name + '"]');
  if (box) box.textContent = message || '';
  const input = form.querySelector('[name="' + name + '"]');
  if (input && message) input.classList.add('is-invalid');
}

function applyServerErrors(form, errors) {
  if (!errors) return;
  Object.keys(errors).forEach(field => setFieldError(form, field, errors[field]));
  const first = form.querySelector('.is-invalid');
  if (first) first.focus();
}

/* ------------------------- loading states ------------------------- */

function setLoading(button, loading, loadingText) {
  if (!button) return;
  if (loading) {
    if (button.dataset.loading === '1') return;
    button.dataset.loading = '1';
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML =
      '<span class="spinner-border spinner-border-sm spinner-border-sm-am me-1" role="status"></span>' +
      (loadingText || 'Please wait…');
  } else {
    if (button.dataset.loading !== '1') return;
    button.dataset.loading = '0';
    button.disabled = false;
    if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
  }
}

function showPageLoading(container, message) {
  if (!container) return;
  container.innerHTML =
    '<div class="page-loading">' +
    '<div class="spinner-border text-primary" role="status"></div>' +
    '<div>' + escapeHtml(message || 'Loading…') + '</div>' +
    '</div>';
}

function skeletonGrid(count) {
  let html = '';
  for (let i = 0; i < (count || 8); i++) {
    html +=
      '<div class="col-6 col-md-4 col-lg-3"><div class="skeleton-card">' +
      '<div class="skeleton skeleton-thumb"></div>' +
      '<div class="skeleton-body">' +
      '<div class="skeleton skeleton-line w40"></div>' +
      '<div class="skeleton skeleton-line w80"></div>' +
      '<div class="skeleton skeleton-line w60"></div>' +
      '</div></div></div>';
  }
  return html;
}

/* ------------------------- formatting ------------------------- */

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function formatINR(value) {
  const amount = Number(value);
  return INR_FORMATTER.format(isNaN(amount) ? 0 : amount);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function queryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

/* ------------------------- cart (localStorage) ------------------------- */

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
  document.dispatchEvent(new CustomEvent('am:cart-changed'));
}

function cartCount() {
  return getCart().reduce((total, item) => total + (item.quantity || 0), 0);
}

function cartSubtotal() {
  return getCart().reduce((total, item) => total + (Number(item.price) || 0) * (item.quantity || 0), 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const count = cartCount();
  badge.textContent = count > 99 ? '99+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function addToCart(product, quantity) {
  const qty = Math.max(1, quantity || 1);
  const cart = getCart();
  const existing = cart.find(item => item.id === product.id);
  const max = Math.max(1, Math.min(10, Number(product.stock) || 10));

  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, max);
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      brand: product.brand || '',
      price: Number(product.price) || 0,
      mrp: product.mrp ? Number(product.mrp) : null,
      image: product.image || '/images/gadgets/accessories.svg',
      stock: Number(product.stock) || 0,
      categorySlug: product.categorySlug || '',
      quantity: Math.min(qty, max)
    });
  }
  saveCart(cart);
}

function setCartQuantity(id, quantity) {
  const cart = getCart();
  const item = cart.find(entry => entry.id === id);
  if (!item) return;
  const max = Math.max(1, Math.min(10, Number(item.stock) || 10));
  item.quantity = Math.max(1, Math.min(quantity, max));
  saveCart(cart);
}

function removeFromCart(id) {
  saveCart(getCart().filter(item => item.id !== id));
}

function clearCart() {
  saveCart([]);
}

/* ------------------------- product cards ------------------------- */

function productCardHtml(product) {
  const badges = [];
  if (product.discountPercent > 0) {
    badges.push('<span class="badge badge-discount">' + product.discountPercent + '% OFF</span>');
  }
  if (product.featured) {
    badges.push('<span class="badge badge-featured"><i class="bi bi-star-fill me-1"></i>Featured</span>');
  }

  let stockNote;
  if (!product.inStock) {
    stockNote = '<div class="stock-note stock-out"><i class="bi bi-x-octagon me-1"></i>Out of stock</div>';
  } else if (product.stock <= 5) {
    stockNote = '<div class="stock-note stock-low"><i class="bi bi-exclamation-circle me-1"></i>Hurry! Only ' + product.stock + ' left</div>';
  } else {
    stockNote = '<div class="stock-note stock-ok"><i class="bi bi-check-circle me-1"></i>In stock</div>';
  }

  const mrpHtml = product.mrp && Number(product.mrp) > Number(product.price)
    ? '<span class="mrp">' + formatINR(product.mrp) + '</span>'
    : '';
  const offHtml = product.discountPercent > 0
    ? '<span class="off">' + product.discountPercent + '% off</span>'
    : '';

  const addButton = product.inStock
    ? '<button class="btn btn-outline-primary" data-add-to-cart' +
      ' data-id="' + escapeHtml(product.id) + '"' +
      ' data-name="' + escapeHtml(product.name) + '"' +
      ' data-brand="' + escapeHtml(product.brand) + '"' +
      ' data-price="' + escapeHtml(product.price) + '"' +
      ' data-mrp="' + escapeHtml(product.mrp || '') + '"' +
      ' data-image="' + escapeHtml(product.image) + '"' +
      ' data-stock="' + escapeHtml(product.stock) + '"' +
      ' data-category="' + escapeHtml(product.categorySlug) + '">' +
      '<i class="bi bi-cart-plus me-1"></i>Add</button>'
    : '<button class="btn btn-outline-secondary" disabled> Sold out</button>';

  return '' +
    '<div class="product-card">' +
      '<div class="product-thumb">' +
        (badges.length ? '<div class="thumb-badges">' + badges.join('') + '</div>' : '') +
        '<a href="/product-details.html?id=' + encodeURIComponent(product.id) + '">' +
          '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">' +
        '</a>' +
      '</div>' +
      '<div class="product-body">' +
        '<div class="product-brand">' + escapeHtml(product.brand) + ' · ' + escapeHtml(product.categoryName || '') + '</div>' +
        '<a class="product-title" href="/product-details.html?id=' + encodeURIComponent(product.id) + '">' +
          escapeHtml(product.name) +
        '</a>' +
        '<div class="price-row">' +
          '<span class="price">' + formatINR(product.price) + '</span>' + mrpHtml + offHtml +
        '</div>' +
        stockNote +
        '<div class="card-actions">' +
          addButton +
          '<a class="btn btn-primary-am" href="/product-details.html?id=' + encodeURIComponent(product.id) + '">' +
            'Details</a>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/** Delegated "Add to cart" handling for any rendered card grid. */
function bindCardActions(container) {
  if (!container || container.dataset.bound === '1') return;
  container.dataset.bound = '1';
  container.addEventListener('click', event => {
    const button = event.target.closest('[data-add-to-cart]');
    if (!button) return;
    event.preventDefault();
    addToCart({
      id: Number(button.dataset.id),
      name: button.dataset.name,
      brand: button.dataset.brand,
      price: button.dataset.price,
      mrp: button.dataset.mrp,
      image: button.dataset.image,
      stock: Number(button.dataset.stock),
      categorySlug: button.dataset.category
    }, 1);
    showToast('Added to cart', 'success');
  });
}

function emptyStateHtml(icon, title, message, actionHtml) {
  return '' +
    '<div class="empty-state">' +
      '<div class="empty-icon"><i class="bi ' + icon + '"></i></div>' +
      '<h5>' + escapeHtml(title) + '</h5>' +
      '<p>' + escapeHtml(message) + '</p>' +
      (actionHtml || '') +
    '</div>';
}
