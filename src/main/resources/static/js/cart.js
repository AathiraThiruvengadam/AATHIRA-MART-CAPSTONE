/* ==================================================================
   Cart page: quantity editing, removal, totals and checkout entry.
   ================================================================== */

const DELIVERY_CHARGE = 49;
const FREE_DELIVERY_ABOVE = 999;

function deliveryCharge(subtotal) {
  return subtotal === 0 || subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_CHARGE;
}

document.addEventListener('DOMContentLoaded', () => {
  renderCart();

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (getCart().length === 0) return;
    if (!requireAuth()) return;
    location.href = '/checkout.html';
  });

  document.addEventListener('am:cart-changed', renderCart);
});

function renderCart() {
  const panel = document.getElementById('cartPanel');
  const cart = getCart();

  const count = cartCount();
  document.getElementById('cartCountLabel').textContent = count > 0
    ? count + ' item' + (count === 1 ? '' : 's') + ' in your cart'
    : 'Review your gadgets before checkout';

  if (cart.length === 0) {
    panel.innerHTML = emptyStateHtml('bi-cart-x', 'Your cart is empty',
      'Browse the gadget catalogue and add products you love to the cart.',
      '<a class="btn btn-primary-am" href="/products.html"><i class="bi bi-bag me-1"></i>Start shopping</a>');
    updateSummary(0);
    document.getElementById('checkoutBtn').disabled = true;
    return;
  }

  panel.innerHTML = cart.map(item => {
    const max = Math.max(1, Math.min(10, Number(item.stock) || 10));
    const lowStock = Number(item.stock) <= 5
      ? '<div class="stock-note stock-low"><i class="bi bi-exclamation-circle me-1"></i>Only ' + item.stock + ' left</div>'
      : '';
    const outStock = Number(item.stock) <= 0
      ? '<div class="stock-note stock-out"><i class="bi bi-x-octagon me-1"></i>Out of stock</div>' : '';

    return '' +
      '<div class="cart-item" data-cart-id="' + escapeHtml(item.id) + '">' +
        '<div class="cart-thumb">' +
          '<a href="/product-details.html?id=' + encodeURIComponent(item.id) + '">' +
            '<img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.name) + '">' +
          '</a>' +
        '</div>' +
        '<div class="flex-grow-1">' +
          '<div class="d-flex justify-content-between gap-2 flex-wrap">' +
            '<div>' +
              '<a class="cart-item-title" href="/product-details.html?id=' + encodeURIComponent(item.id) + '">' +
                escapeHtml(item.name) + '</a>' +
              '<div class="small text-muted">' + escapeHtml(item.brand) + '</div>' +
            '</div>' +
            '<div class="text-end">' +
              '<div class="price fw-bold">' + formatINR(item.price * item.quantity) + '</div>' +
              (Number(item.mrp) > Number(item.price)
                ? '<div class="small text-muted text-decoration-line-through">' + formatINR(item.mrp * item.quantity) + '</div>'
                : '') +
            '</div>' +
          '</div>' +
          '<div class="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">' +
            '<div class="qty-box">' +
              '<button type="button" data-cart-action="dec" data-id="' + escapeHtml(item.id) + '" ' +
                (item.quantity <= 1 ? 'disabled' : '') + ' aria-label="Decrease">&minus;</button>' +
              '<input type="text" value="' + escapeHtml(item.quantity) + '" readonly aria-label="Quantity">' +
              '<button type="button" data-cart-action="inc" data-id="' + escapeHtml(item.id) + '" ' +
                (item.quantity >= max ? 'disabled' : '') + ' aria-label="Increase">+</button>' +
            '</div>' +
            '<div class="d-flex align-items-center gap-3">' +
              lowStock + outStock +
              '<button class="btn btn-sm btn-outline-danger" data-cart-action="remove" data-id="' +
                escapeHtml(item.id) + '"><i class="bi bi-trash me-1"></i>Remove</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }).join('');

  panel.querySelectorAll('[data-cart-action]').forEach(button => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.id);
      const action = button.dataset.cartAction;
      const item = getCart().find(entry => entry.id === id);
      if (!item) return;

      if (action === 'inc') setCartQuantity(id, item.quantity + 1);
      if (action === 'dec') setCartQuantity(id, item.quantity - 1);
      if (action === 'remove') {
        removeFromCart(id);
        showToast(item.name + ' removed from cart', 'info');
      }
    });
  });

  updateSummary(cartSubtotal());
  document.getElementById('checkoutBtn').disabled = false;
}

function updateSummary(subtotal) {
  const delivery = deliveryCharge(subtotal);
  document.getElementById('sumSubtotal').textContent = formatINR(subtotal);
  document.getElementById('sumDelivery').innerHTML = delivery === 0
    ? '<span class="free">FREE</span>'
    : formatINR(delivery);
  document.getElementById('sumTotal').textContent = formatINR(subtotal + delivery);
}
