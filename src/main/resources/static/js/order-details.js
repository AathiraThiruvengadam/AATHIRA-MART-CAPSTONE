/* ==================================================================
   Order details page: status timeline, items, address, totals.
   ================================================================== */

const STATUS_STEPS = ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
const STEP_ICONS = {
  PLACED: 'bi-bag-check',
  CONFIRMED: 'bi-patch-check',
  SHIPPED: 'bi-truck',
  DELIVERED: 'bi-house-check'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  loadOrderDetails();
});

async function loadOrderDetails() {
  const root = document.getElementById('orderRoot');
  const id = queryParam('id');

  if (!id) {
    root.innerHTML = emptyStateHtml('bi-question-circle', 'No order selected',
      'Pick an order from your history to see its details.',
      '<a class="btn btn-primary-am" href="/orders.html">View my orders</a>');
    return;
  }

  try {
    const response = await api('/orders/' + encodeURIComponent(id));
    renderOrder(response.data);
    document.title = 'Order ' + response.data.orderNumber + ' | AATHIRA MART';
  } catch (err) {
    if (err.status === 404 || err.status === 403) {
      root.innerHTML = emptyStateHtml('bi-shield-x', 'Order not available',
        err.status === 403
          ? 'You can only view your own orders.'
          : 'This order could not be found.',
        '<a class="btn btn-primary-am" href="/orders.html">Back to my orders</a>');
    } else {
      root.innerHTML = emptyStateHtml('bi-exclamation-triangle', 'Could not load this order',
        err.message || 'Please try again shortly.',
        '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>');
    }
    handleApiError(err);
  }
}

function renderOrder(order) {
  const root = document.getElementById('orderRoot');
  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const total = Number(order.totalAmount);
  const delivery = Math.max(0, total - subtotal);

  const currentStepIndex = STATUS_STEPS.indexOf(order.status);
  const cancelled = order.status === 'CANCELLED';

  const timelineHtml = cancelled
    ? '<div class="alert alert-danger mb-0"><i class="bi bi-x-octagon me-2"></i>' +
      'This order was cancelled.</div>'
    : '<div class="timeline">' + STATUS_STEPS.map((step, index) =>
        '<div class="tl-step' + (index <= currentStepIndex ? ' done' : '') + '">' +
          '<div class="tl-dot"><i class="bi ' + STEP_ICONS[step] + '"></i></div>' +
          escapeHtml(step.charAt(0) + step.slice(1).toLowerCase()) +
        '</div>'
      ).join('') + '</div>';

  const itemsHtml = items.map(item => {
    const itemStatus = item.status || 'PROCESSING';
    return '<div class="item-row">' +
      '<div class="item-thumb">' +
        (item.productId
          ? '<a href="/product-details.html?id=' + encodeURIComponent(item.productId) + '">' +
            '<img src="' + escapeHtml(item.productImage) + '" alt="' + escapeHtml(item.productName) + '"></a>'
          : '<img src="' + escapeHtml(item.productImage) + '" alt="' + escapeHtml(item.productName) + '">') +
      '</div>' +
      '<div class="flex-grow-1">' +
        '<div class="fw-semibold">' + escapeHtml(item.productName) + '</div>' +
        '<div class="small text-muted">' + formatINR(item.unitPrice) + ' × ' + item.quantity +
          (item.sellerName ? ' · Seller: ' + escapeHtml(item.sellerName) : '') + '</div>' +
        '<span class="status-pill status-' + escapeHtml(itemStatus) + ' mt-1 d-inline-block">' +
          escapeHtml(itemStatus) + '</span>' +
      '</div>' +
      '<div class="fw-bold">' + formatINR(item.subtotal) + '</div>' +
    '</div>';
  }).join('');

  root.innerHTML =
    '<div class="order-card mb-4">' +
      '<div class="order-head">' +
        '<div>' +
          '<div class="order-number fs-5"><i class="bi bi-bag-check me-2 text-primary"></i>' +
            escapeHtml(order.orderNumber) + '</div>' +
          '<div class="order-meta">Placed on ' + formatDate(order.placedAt) +
            ' · Payment: ' + (order.paymentMethod === 'UPI' ? 'UPI (demo)' : 'Cash on Delivery') + '</div>' +
        '</div>' +
        '<span class="status-pill status-' + escapeHtml(order.status) + '">' +
          escapeHtml(order.status) + '</span>' +
      '</div>' +
      timelineHtml +
    '</div>' +

    '<div class="row g-4">' +
      '<div class="col-lg-7">' +
        '<div class="panel">' +
          '<h5><i class="bi bi-box-seam me-2 text-primary"></i>Items (' + items.length + ')</h5>' +
          itemsHtml +
          '<div class="summary-row mt-3"><span>Subtotal</span><span>' + formatINR(subtotal) + '</span></div>' +
          '<div class="summary-row"><span>Delivery</span>' +
            (delivery === 0 ? '<span class="free">FREE</span>' : '<span>' + formatINR(delivery) + '</span>') +
          '</div>' +
          '<div class="summary-row total"><span>Total paid</span><span>' + formatINR(total) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="col-lg-5">' +
        '<div class="panel mb-3">' +
          '<h5><i class="bi bi-geo-alt me-2 text-primary"></i>Delivery Address</h5>' +
          '<p class="mb-1 fw-semibold">' + escapeHtml(order.shipName) + '</p>' +
          '<p class="mb-1 text-muted small">' +
            escapeHtml(order.shipLine1) +
            (order.shipLine2 ? ', ' + escapeHtml(order.shipLine2) : '') + '<br>' +
            escapeHtml(order.shipCity) + ', ' + escapeHtml(order.shipState) +
            ' - <b>' + escapeHtml(order.shipPincode) + '</b></p>' +
          '<p class="mb-0 text-muted small"><i class="bi bi-telephone me-1"></i>' +
            escapeHtml(order.shipPhone) + '</p>' +
        '</div>' +

        '<div class="panel">' +
          '<h5><i class="bi bi-question-circle me-2 text-primary"></i>Need help?</h5>' +
          '<p class="small text-muted mb-3">Questions about this order? Our support team is available 24×7.</p>' +
          '<div class="d-grid gap-2">' +
            '<a class="btn btn-outline-primary btn-sm" href="/orders.html">' +
              '<i class="bi bi-arrow-left me-1"></i>All my orders</a>' +
            '<a class="btn btn-primary-am btn-sm" href="/products.html">' +
              '<i class="bi bi-bag me-1"></i>Continue shopping</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
}
