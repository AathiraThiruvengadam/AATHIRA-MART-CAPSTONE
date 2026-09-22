/* ==================================================================
   Order history page
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  loadOrders();
});

async function loadOrders() {
  const root = document.getElementById('ordersRoot');

  try {
    const orders = await api('/orders');

    if (!Array.isArray(orders) || orders.length === 0) {
      root.innerHTML = emptyStateHtml('bi-box-seam', 'No orders yet',
        'You haven\'t ordered anything yet. Your placed orders will appear here.',
        '<a class="btn btn-primary-am" href="/products.html"><i class="bi bi-bag me-1"></i>Start shopping</a>');
      return;
    }

    root.innerHTML = orders.map(order => {
      const preview = (order.items || []).slice(0, 2)
        .map(item => escapeHtml(item.productName) + ' × ' + item.quantity)
        .join(', ');
      const extra = (order.items || []).length > 2
        ? ' +' + ((order.items.length - 2)) + ' more' : '';

      return '' +
        '<div class="order-card mb-3">' +
          '<div class="order-head">' +
            '<div>' +
              '<div class="order-number"><i class="bi bi-bag-check me-2 text-primary"></i>' +
                escapeHtml(order.orderNumber) + '</div>' +
              '<div class="order-meta">Placed on ' + formatDate(order.placedAt) +
                ' · ' + order.itemCount + ' item' + (order.itemCount === 1 ? '' : 's') + '</div>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-3 flex-wrap">' +
              '<span class="status-pill status-' + escapeHtml(order.status) + '">' +
                escapeHtml(order.status) + '</span>' +
              '<span class="fw-bold">' + formatINR(order.totalAmount) + '</span>' +
              '<a class="btn btn-sm btn-outline-primary" href="/order-details.html?id=' +
                encodeURIComponent(order.id) + '">View details</a>' +
            '</div>' +
          '</div>' +
          '<div class="small text-muted mt-2"><i class="bi bi-box me-1"></i>' +
            preview + extra + '</div>' +
        '</div>';
    }).join('');
  } catch (err) {
    root.innerHTML = emptyStateHtml('bi-exclamation-triangle', 'Could not load your orders',
      err.message || 'Please try again shortly.',
      '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>');
    handleApiError(err);
  }
}
