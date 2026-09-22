/* ==================================================================
   Seller dashboard:
    - stats (products, orders, revenue, low stock)
    - product CRUD for listings owned by this seller
    - orders containing the seller's items + per-item status updates
   ================================================================== */

let sellerCategories = [];
let sellerProducts = [];
let sellerOrders = [];
let editingProductId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireRole('SELLER', 'ADMIN')) return;
  initTabs();
  initProductForm();
  loadSellerDashboard();
});

async function loadSellerDashboard() {
  try {
    const [categories, products, orders] = await Promise.all([
      api('/categories', { auth: false }),
      api('/seller/products'),
      api('/seller/orders')
    ]);
    sellerCategories = Array.isArray(categories) ? categories : [];
    sellerProducts = Array.isArray(products) ? products : [];
    sellerOrders = Array.isArray(orders) ? orders : [];

    fillCategorySelect();
    renderStats();
    renderProducts();
    renderOrders();
  } catch (err) {
    handleApiError(err);
    const box = document.getElementById('productsRoot');
    if (box) {
      box.innerHTML = emptyStateHtml('bi-exclamation-triangle', 'Could not load the dashboard',
        err.message || 'Please try again shortly.',
        '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>');
    }
  }
}

/* ------------------------- tabs ------------------------- */

function initTabs() {
  document.querySelectorAll('[data-dash-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.dashTab;
      document.querySelectorAll('[data-dash-tab]').forEach(b =>
        b.classList.toggle('active', b === button));
      document.getElementById('pane-products').classList.toggle('d-none', target !== 'products');
      document.getElementById('pane-orders').classList.toggle('d-none', target !== 'orders');
    });
  });
}

function showOrdersTab() {
  const btn = document.getElementById('tab-orders');
  if (btn) btn.click();
}

/* ------------------------- stats ------------------------- */

function renderStats() {
  const revenue = sellerOrders.reduce((sum, order) =>
    sum + (order.items || []).reduce((s, item) => s + Number(item.subtotal || 0), 0), 0);
  const lowStock = sellerProducts.filter(p => p.stock <= 5).length;
  const openOrders = sellerOrders.filter(o => o.status !== 'CANCELLED').length;

  setText('statProducts', String(sellerProducts.length));
  setText('statOrders', String(openOrders));
  setText('statRevenue', formatINR(revenue));
  setText('statLow', String(lowStock));
}

/* ------------------------- products ------------------------- */

function fillCategorySelect() {
  const select = document.getElementById('pfCategory');
  if (!select) return;
  select.innerHTML = '<option value="">Select…</option>' +
    sellerCategories.map(c =>
      '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>').join('');
}

function renderProducts() {
  const root = document.getElementById('productsRoot');
  if (!root) return;

  if (!sellerProducts.length) {
    root.innerHTML = emptyStateHtml('bi-box-seam', 'No products yet',
      'Add your first gadget listing — it will appear in the storefront instantly.',
      '<button class="btn btn-primary-am" type="button" onclick="document.getElementById(\'addProductBtn\').click()">' +
      '<i class="bi bi-plus-lg me-1"></i>Add product</button>');
    return;
  }

  root.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle am-table">' +
      '<thead><tr>' +
        '<th>Product</th><th>Category</th><th class="text-end">Price</th>' +
        '<th class="text-center">Stock</th><th class="text-center">Status</th><th class="text-end">Actions</th>' +
      '</tr></thead><tbody>' +
      sellerProducts.map(p =>
        '<tr>' +
          '<td><div class="d-flex align-items-center gap-2">' +
            '<img class="table-thumb" src="' + escapeHtml(p.image) + '" alt="">' +
            '<div><b>' + escapeHtml(p.name) + '</b>' +
            '<div class="small text-muted">' + escapeHtml(p.brand) + '</div></div>' +
          '</div></td>' +
          '<td>' + escapeHtml(p.categoryName || '—') + '</td>' +
          '<td class="text-end">' + formatINR(p.price) + '</td>' +
          '<td class="text-center">' + p.stock + '</td>' +
          '<td class="text-center">' +
            (p.stock === 0
              ? '<span class="status-pill status-CANCELLED">OUT OF STOCK</span>'
              : p.stock <= 5
                ? '<span class="status-pill status-CONFIRMED">LOW</span>'
                : '<span class="status-pill status-DELIVERED">ACTIVE</span>') +
          '</td>' +
          '<td class="text-end">' +
            '<button class="btn btn-sm btn-outline-primary me-1" data-edit="' + escapeHtml(p.id) + '" type="button">' +
              '<i class="bi bi-pencil"></i></button>' +
            '<button class="btn btn-sm btn-outline-danger" data-delete="' + escapeHtml(p.id) + '" type="button">' +
              '<i class="bi bi-trash"></i></button>' +
          '</td>' +
        '</tr>').join('') +
      '</tbody></table></div>';

  root.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openProductForm(Number(btn.dataset.edit))));
  root.querySelectorAll('[data-delete]').forEach(btn =>
    btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.delete), btn)));
}

function initProductForm() {
  const form = document.getElementById('productForm');
  const addBtn = document.getElementById('addProductBtn');
  const cancelBtn = document.getElementById('cancelProductBtn');
  if (!form) return;

  if (addBtn) addBtn.addEventListener('click', () => openProductForm(null));
  if (cancelBtn) cancelBtn.addEventListener('click', closeProductForm);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearFieldErrors(form);

    const payload = {
      name: valueOfForm(form, 'name'),
      brand: valueOfForm(form, 'brand'),
      description: valueOfForm(form, 'description'),
      price: valueOfForm(form, 'price'),
      mrp: valueOfForm(form, 'mrp') || null,
      stock: valueOfForm(form, 'stock'),
      image: valueOfForm(form, 'image'),
      categoryId: valueOfForm(form, 'categoryId'),
      featured: form.querySelector('[name="featured"]').checked
    };

    if (!payload.name || !payload.brand || !payload.description) {
      applyServerErrors(form, {
        name: payload.name ? undefined : 'Product name is required',
        brand: payload.brand ? undefined : 'Brand is required',
        description: payload.description ? undefined : 'Description is required'
      });
      return;
    }

    const submit = document.getElementById('saveProductBtn');
    setLoading(submit, true, 'Saving…');
    try {
      const path = editingProductId
        ? '/seller/products/' + editingProductId
        : '/seller/products';
      const response = await api(path, {
        method: editingProductId ? 'PUT' : 'POST',
        body: payload
      });
      showToast(response.message || 'Product saved', 'success');
      closeProductForm();
      await reloadProducts();
    } catch (err) {
      applyServerErrors(form, err.errors);
      handleApiError(err);
    } finally {
      setLoading(submit, false);
    }
  });
}

function openProductForm(productId) {
  const panel = document.getElementById('productFormPanel');
  const form = document.getElementById('productForm');
  if (!panel || !form) return;
  clearFieldErrors(form);
  editingProductId = productId;

  const title = document.getElementById('productFormTitle');
  if (productId === null) {
    title.innerHTML = '<i class="bi bi-plus-circle me-2 text-primary"></i>Add product';
    form.reset();
    form.querySelector('[name="image"]').value = '/images/gadgets/accessories.svg';
  } else {
    const product = sellerProducts.find(p => p.id === productId);
    if (!product) return;
    title.innerHTML = '<i class="bi bi-pencil me-2 text-primary"></i>Edit product';
    form.querySelector('[name="name"]').value = product.name;
    form.querySelector('[name="brand"]').value = product.brand;
    form.querySelector('[name="description"]').value = product.description;
    form.querySelector('[name="price"]').value = product.price;
    form.querySelector('[name="mrp"]').value = product.mrp || '';
    form.querySelector('[name="stock"]').value = product.stock;
    form.querySelector('[name="image"]').value = product.image || '/images/gadgets/accessories.svg';
    form.querySelector('[name="categoryId"]').value = product.categoryId || '';
    form.querySelector('[name="featured"]').checked = !!product.featured;
  }

  panel.classList.remove('d-none');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.querySelector('[name="name"]').focus();
}

function closeProductForm() {
  const panel = document.getElementById('productFormPanel');
  if (panel) panel.classList.add('d-none');
  editingProductId = null;
}

async function reloadProducts() {
  sellerProducts = await api('/seller/products');
  renderStats();
  renderProducts();
}

async function deleteProduct(productId, button) {
  const product = sellerProducts.find(p => p.id === productId);
  if (!product) return;
  if (!confirm('Delete "' + product.name + '"? This cannot be undone.')) return;

  setLoading(button, true, '');
  try {
    const response = await api('/seller/products/' + productId, { method: 'DELETE' });
    showToast(response.message || 'Product deleted', 'success');
    await reloadProducts();
  } catch (err) {
    handleApiError(err);
  } finally {
    setLoading(button, false);
  }
}

/* ------------------------- orders ------------------------- */

function renderOrders() {
  const root = document.getElementById('ordersRoot');
  if (!root) return;

  if (!sellerOrders.length) {
    root.innerHTML = emptyStateHtml('bi-bag', 'No orders yet',
      'Orders that include your products will appear here for fulfilment.');
    return;
  }

  root.innerHTML = sellerOrders.map(order => {
    const items = order.items || [];
    const itemRows = items.map(item =>
      '<tr>' +
        '<td><div class="d-flex align-items-center gap-2">' +
          '<img class="table-thumb" src="' + escapeHtml(item.productImage || '') + '" alt="">' +
          '<b>' + escapeHtml(item.productName) + '</b>' +
        '</div></td>' +
        '<td class="text-center">' + item.quantity + '</td>' +
        '<td class="text-end">' + formatINR(item.subtotal) + '</td>' +
        '<td class="text-center">' +
          '<select class="form-select form-select-sm item-status-select" data-item="' +
            escapeHtml(item.id) + '">' +
            ['PROCESSING', 'SHIPPED', 'DELIVERED'].map(s =>
              '<option value="' + s + '"' + (item.status === s ? ' selected' : '') + '>' +
              s + '</option>').join('') +
          '</select>' +
        '</td>' +
      '</tr>').join('');

    return '' +
      '<div class="order-card mb-3">' +
        '<div class="order-head">' +
          '<div>' +
            '<div class="order-number"><i class="bi bi-bag-check me-2 text-primary"></i>' +
              escapeHtml(order.orderNumber) + '</div>' +
            '<div class="order-meta">' + formatDate(order.placedAt) +
              ' · Buyer: ' + escapeHtml(order.customerName || order.shipName || '—') + '</div>' +
          '</div>' +
          '<div class="d-flex align-items-center gap-3 flex-wrap">' +
            '<span class="status-pill status-' + escapeHtml(order.status) + '">' +
              escapeHtml(order.status) + '</span>' +
            '<span class="small text-muted">Order total ' + formatINR(order.totalAmount) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="table-responsive mt-2">' +
          '<table class="table table-sm align-middle mb-0 am-table">' +
            '<thead><tr><th>My item</th><th class="text-center">Qty</th>' +
            '<th class="text-end">Line total</th><th class="text-center">Fulfilment</th></tr></thead>' +
            '<tbody>' + itemRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }).join('');

  root.querySelectorAll('.item-status-select').forEach(select => {
    select.addEventListener('change', () => updateItemStatus(select.dataset.item, select.value));
  });
}

async function updateItemStatus(itemId, status) {
  try {
    const response = await api('/seller/order-items/' + itemId + '/status', {
      method: 'PUT',
      body: { status }
    });
    showToast(response.message || 'Item status updated', 'success');
    sellerOrders = await api('/seller/orders');
    renderStats();
    renderOrders();
    showOrdersTab();
  } catch (err) {
    handleApiError(err);
    renderOrders(); // reset selects to server truth
  }
}

/* ------------------------- shared helpers ------------------------- */

function valueOfForm(form, name) {
  const field = form.querySelector('[name="' + name + '"]');
  return field ? String(field.value).trim() : '';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
