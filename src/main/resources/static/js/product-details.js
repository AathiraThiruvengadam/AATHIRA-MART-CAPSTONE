/* ==================================================================
   Product details page: full info, quantity picker, add to cart,
   buy now and related products.
   ================================================================== */

let currentProduct = null;
let selectedQuantity = 1;

document.addEventListener('DOMContentLoaded', () => {
  bindCardActions(document.getElementById('relatedGrid'));
  loadProductDetails();
});

async function loadProductDetails() {
  const container = document.getElementById('productContainer');
  const id = queryParam('id');

  if (!id) {
    container.innerHTML = emptyStateHtml('bi-question-circle', 'No product selected',
      'Pick a gadget from the shop to see its details.',
      '<a class="btn btn-primary-am" href="/products.html">Browse gadgets</a>');
    return;
  }

  try {
    const response = await api('/products/' + encodeURIComponent(id), { auth: false });
    currentProduct = response.data;
    selectedQuantity = 1;
    renderProduct(currentProduct);
    document.title = currentProduct.name + ' | AATHIRA MART';
    loadRelated(currentProduct);
  } catch (err) {
    if (err.status === 404) {
      container.innerHTML = emptyStateHtml('bi-emoji-frown', 'Product not found',
        'This gadget may have been removed from the catalogue.',
        '<a class="btn btn-primary-am" href="/products.html">Browse other gadgets</a>');
    } else {
      container.innerHTML = emptyStateHtml('bi-exclamation-triangle', 'Could not load this product',
        err.message || 'Please try again shortly.',
        '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>');
    }
  }
}

function renderProduct(product) {
  const container = document.getElementById('productContainer');
  const maxQty = Math.max(1, Math.min(10, product.stock || 1));

  const mrpHtml = product.mrp && Number(product.mrp) > Number(product.price)
    ? '<span class="mrp fs-4 ms-2">' + formatINR(product.mrp) + '</span>'
    : '';
  const discountHtml = product.discountPercent > 0
    ? '<span class="badge bg-success ms-2 align-middle">' + product.discountPercent + '% OFF</span>'
    : '';

  const stockHtml = !product.inStock
    ? '<span class="badge text-bg-danger">Out of stock</span>'
    : product.stock <= 5
      ? '<span class="badge text-bg-warning">Only ' + product.stock + ' left - order soon!</span>'
      : '<span class="badge text-bg-success">In stock · ' + product.stock + ' units</span>';

  const actionsHtml = product.inStock
    ? '<div class="d-flex flex-wrap gap-3 align-items-center mt-4">' +
        '<div class="qty-box">' +
          '<button type="button" id="qtyMinus" aria-label="Decrease quantity">&minus;</button>' +
          '<input id="qtyInput" type="text" inputmode="numeric" value="1" readonly aria-label="Quantity">' +
          '<button type="button" id="qtyPlus" aria-label="Increase quantity">+</button>' +
        '</div>' +
        '<button class="btn btn-outline-primary px-4" id="addToCartBtn" type="button">' +
          '<i class="bi bi-cart-plus me-1"></i>Add to Cart</button>' +
        '<button class="btn btn-primary-am px-4" id="buyNowBtn" type="button">' +
          '<i class="bi bi-lightning-charge-fill me-1"></i>Buy Now</button>' +
      '</div>'
    : '<div class="alert alert-danger mt-4 mb-0"><i class="bi bi-x-octagon me-2"></i>' +
      'This product is currently out of stock.</div>';

  container.innerHTML =
    '<div class="breadcrumb-am mb-3">' +
      '<a href="/index.html">Home</a> <span class="mx-1">/</span> ' +
      '<a href="/products.html">Shop</a> <span class="mx-1">/</span> ' +
      '<a href="/products.html?category=' + escapeHtml(product.categorySlug) + '">' +
        escapeHtml(product.categoryName) + '</a> <span class="mx-1">/</span> ' +
      '<span>' + escapeHtml(product.name) + '</span>' +
    '</div>' +

    '<div class="row g-4">' +
      '<div class="col-md-6">' +
        '<div class="detail-gallery">' +
          '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.name) + '">' +
        '</div>' +
        '<div class="row g-2 mt-1">' +
          '<div class="col-4"><div class="trust-card py-3"><div class="t-icon"><i class="bi bi-truck"></i></div>' +
            '<h6 class="small">Free delivery</h6><p class="small mb-0">On orders above ₹999</p></div></div>' +
          '<div class="col-4"><div class="trust-card py-3"><div class="t-icon"><i class="bi bi-arrow-counterclockwise"></i></div>' +
            '<h6 class="small">7-day returns</h6><p class="small mb-0">Easy return policy</p></div></div>' +
          '<div class="col-4"><div class="trust-card py-3"><div class="t-icon"><i class="bi bi-shield-check"></i></div>' +
            '<h6 class="small">Brand warranty</h6><p class="small mb-0">100% genuine items</p></div></div>' +
        '</div>' +
      '</div>' +

      '<div class="col-md-6">' +
        '<div class="detail-panel">' +
          '<div class="product-brand">' + escapeHtml(product.brand) + ' · ' + escapeHtml(product.categoryName) + '</div>' +
          '<h3 class="mt-1">' + escapeHtml(product.name) + '</h3>' +
          '<div class="mb-2">' + stockHtml + '</div>' +
          '<div class="price-row my-3">' +
            '<span class="detail-price">' + formatINR(product.price) + '</span>' + mrpHtml + discountHtml +
          '</div>' +
          '<p class="text-muted mb-3">' + escapeHtml(product.description) + '</p>' +

          '<table class="table table-borderless spec-table small mb-0">' +
            '<tbody>' +
              '<tr><th>Brand</th><td>' + escapeHtml(product.brand) + '</td></tr>' +
              '<tr><th>Category</th><td>' + escapeHtml(product.categoryName) + '</td></tr>' +
              '<tr><th>Availability</th><td>' + (product.inStock ? product.stock + ' units in stock' : 'Out of stock') + '</td></tr>' +
              '<tr><th>Item code</th><td>AM-' + String(product.id).padStart(5, '0') + '</td></tr>' +
              '<tr><th>Delivery</th><td>2-4 business days</td></tr>' +
            '</tbody>' +
          '</table>' +

          actionsHtml +
        '</div>' +
      '</div>' +
    '</div>';

  if (product.inStock) {
    bindProductActions(maxQty);
  }
}

function bindProductActions(maxQty) {
  const input = document.getElementById('qtyInput');

  document.getElementById('qtyMinus').addEventListener('click', () => {
    selectedQuantity = Math.max(1, selectedQuantity - 1);
    input.value = selectedQuantity;
  });

  document.getElementById('qtyPlus').addEventListener('click', () => {
    selectedQuantity = Math.min(maxQty, selectedQuantity + 1);
    input.value = selectedQuantity;
    if (selectedQuantity === maxQty && maxQty < 10) {
      showToast('Only ' + maxQty + ' unit(s) available', 'warning');
    }
  });

  document.getElementById('addToCartBtn').addEventListener('click', () => {
    addToCart(currentProduct, selectedQuantity);
    showToast(selectedQuantity + ' × ' + currentProduct.name + ' added to cart', 'success');
  });

  document.getElementById('buyNowBtn').addEventListener('click', () => {
    addToCart(currentProduct, selectedQuantity);
    location.href = '/checkout.html';
  });
}

async function loadRelated(product) {
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');

  try {
    const related = await api('/products/' + encodeURIComponent(product.id) + '/related', { auth: false });
    if (!Array.isArray(related) || related.length === 0) return;
    grid.innerHTML = related.map(productCardHtml).join('');
    section.classList.remove('d-none');
  } catch (err) {
    // related products are optional
  }
}
