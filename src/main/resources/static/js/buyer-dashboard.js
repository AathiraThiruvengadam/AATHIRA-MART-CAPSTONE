/* ==================================================================
   Buyer dashboard: profile summary, shopping stats, recent orders.
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  loadBuyerDashboard();
});

async function loadBuyerDashboard() {
  try {
    const [profile, orders] = await Promise.all([
      api('/account/profile'),
      api('/orders')
    ]);

    renderProfile(profile);
    renderStats(orders);
    renderRecentOrders(orders);
  } catch (err) {
    const box = document.getElementById('recentOrders');
    if (box) {
      box.innerHTML = emptyStateHtml('bi-exclamation-triangle', 'Could not load your dashboard',
        err.message || 'Please try again shortly.',
        '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>');
    }
    handleApiError(err);
  }
}

function renderProfile(profile) {
  const firstName = (profile.fullName || profile.email || '').split(' ')[0];
  setText('buyerName', firstName);
  setText('profName', profile.fullName || '—');
  setText('profEmail', profile.email || '—');
  setText('profRole', profile.role || '—');
  setText('profSince', profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—');
}

function renderStats(orders) {
  const totalSpent = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const active = orders.filter(order =>
    order.status !== 'DELIVERED' && order.status !== 'CANCELLED').length;

  setText('statOrders', String(orders.length));
  setText('statSpent', formatINR(totalSpent));
  setText('statCart', String(cartCount()));
  setText('statActive', String(active));
}

function renderRecentOrders(orders) {
  const box = document.getElementById('recentOrders');
  if (!box) return;

  if (!orders.length) {
    box.innerHTML = emptyStateHtml('bi-box-seam', 'No orders yet',
      'Your placed orders will show up here with live status updates.',
      '<a class="btn btn-primary-am" href="/products.html"><i class="bi bi-bag me-1"></i>Start shopping</a>');
    return;
  }

  box.innerHTML = orders.slice(0, 4).map(order =>
    '<div class="order-card mb-3">' +
      '<div class="order-head">' +
        '<div>' +
          '<div class="order-number"><i class="bi bi-bag-check me-2 text-primary"></i>' +
            escapeHtml(order.orderNumber) + '</div>' +
          '<div class="order-meta">' + formatDate(order.placedAt) + ' · ' +
            order.itemCount + ' item' + (order.itemCount === 1 ? '' : 's') + '</div>' +
        '</div>' +
        '<div class="d-flex align-items-center gap-3 flex-wrap">' +
          '<span class="status-pill status-' + escapeHtml(order.status) + '">' +
            escapeHtml(order.status) + '</span>' +
          '<span class="fw-bold">' + formatINR(order.totalAmount) + '</span>' +
          '<a class="btn btn-sm btn-outline-primary" href="/order-details.html?id=' +
            encodeURIComponent(order.id) + '">Details</a>' +
        '</div>' +
      '</div>' +
    '</div>'
  ).join('');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
