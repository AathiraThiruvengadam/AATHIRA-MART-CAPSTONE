/* ==================================================================
   Admin dashboard:
    - stats across the whole platform
    - user management (role change, delete) + seller list
    - full catalogue CRUD
    - all orders with status control (cancel restores stock server-side)
   ================================================================== */

let adminUsers = [];
let adminSellers = [];
let adminProducts = [];
let adminOrders = [];
let adminCategories = [];
let adminEditingProductId = null;
let currentAdminEmail = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireRole('ADMIN')) return;
  initTabs();
  initProductForm();
  loadAdminDashboard();
});

async function loadAdminDashboard() {
  try {
    const [profile, users, sellers, products, orders, categories] = await Promise.all([
      api('/account/profile'),
      api('/admin/users'),
      api('/admin/sellers'),
      api('/admin/products'),
      api('/admin/orders'),
      api('/categories', { auth: false })
    ]);

    currentAdminEmail = profile.email;
    adminUsers = users;
    adminSellers = sellers;
    adminProducts = products;
    adminOrders = orders;
    adminCategories = Array.isArray(categories) ? categories : [];

    renderStats();
    fillCategorySelect();
    renderUsers();
    renderSellers();
    renderProducts();
    renderOrders();
  } catch (err) {
    handleApiError(err);
  }
}

/* ------------------------- tabs ------------------------- */

function initTabs() {
  document.querySelectorAll('[data-dash-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.dashTab;
      document.querySelectorAll('[data-dash-tab]').forEach(b =>
        b.classList.toggle('active', b === button));
      ['users', 'sellers', 'products', 'orders'].forEach(name => {
        const pane = document.getElementById('pane-' + name);
        if (pane) pane.classList.toggle('d-none', name !== target);
      });
    });
  });
}

/* ------------------------- stats ------------------------- */

function renderStats() {
  const revenue = adminOrders
    .filter(o => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  setText('statUsers', String(adminUsers.length));
  setText('statSellers', String(adminSellers.length));
  setText('statProducts', String(adminProducts.length));
  setText('statOrders', String(adminOrders.length));
  setText('statRevenue', formatINR(revenue));
}

/* ------------------------- users ------------------------- */

function renderUsers() {
  const root = document.getElementById('usersRoot');
  if (!root) return;

  if (!adminUsers.length) {
    root.innerHTML = emptyStateHtml('bi-people', 'No users', 'Registered accounts will appear here.');
    return;
  }

  root.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle am-table">' +
      '<thead><tr><th>User</th><th>Phone</th><th>Role</th><th>Joined</th><th class="text-end">Actions</th></tr></thead>' +
      '<tbody>' +
      adminUsers.map(user => {
        const isSelf = user.email === currentAdminEmail;
        return '<tr>' +
          '<td><b>' + escapeHtml(user.fullName) + '</b>' +
            (isSelf ? ' <span class="badge bg-secondary">you</span>' : '') +
            '<div class="small text-muted">' + escapeHtml(user.email) + '</div></td>' +
          '<td>' + escapeHtml(user.phone || '—') + '</td>' +
          '<td>' +
            '<select class="form-select form-select-sm role-select" data-user="' + escapeHtml(user.id) + '"' +
              (isSelf ? ' disabled' : '') + '>' +
              ['BUYER', 'SELLER', 'ADMIN'].map(r =>
                '<option value="' + r + '"' + (user.role === r ? ' selected' : '') + '>' + r + '</option>').join('') +
            '</select>' +
          '</td>' +
          '<td class="small text-muted">' + formatDate(user.createdAt) + '</td>' +
          '<td class="text-end">' +
            '<button class="btn btn-sm btn-outline-danger" data-delete-user="' + escapeHtml(user.id) + '"' +
              (isSelf ? ' disabled' : '') + ' type="button"><i class="bi bi-trash"></i></button>' +
          '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';

  root.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', () => changeRole(select, Number(select.dataset.user), select.value));
  });
  root.querySelectorAll('[data-delete-user]').forEach(button => {
    button.addEventListener('click', () => deleteUser(Number(button.dataset.deleteUser), button));
  });
}

async function changeRole(select, userId, role) {
  const user = adminUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm('Change ' + user.fullName + ' to ' + role + '?')) {
    select.value = user.role;
    return;
  }
  try {
    const response = await api('/admin/users/' + userId + '/role', {
      method: 'PUT',
      body: { role }
    });
    showToast(response.message || 'Role updated', 'success');
    await reloadUsersAndSellers();
  } catch (err) {
    select.value = user.role;
    handleApiError(err);
  }
}

async function deleteUser(userId, button) {
  const user = adminUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm('Delete ' + user.fullName + ' (' + user.email + ')? This cannot be undone.')) return;

  setLoading(button, true, '');
  try {
    const response = await api('/admin/users/' + userId, { method: 'DELETE' });
    showToast(response.message || 'User deleted', 'success');
    await reloadUsersAndSellers();
  } catch (err) {
    handleApiError(err);
  } finally {
    setLoading(button, false);
  }
}

async function reloadUsersAndSellers() {
  adminUsers = await api('/admin/users');
  adminSellers = await api('/admin/sellers');
  renderStats();
  renderUsers();
  renderSellers();
}

/* ------------------------- sellers ------------------------- */

function renderSellers() {
  const root = document.getElementById('sellersRoot');
  if (!root) return;

  if (!adminSellers.length) {
    root.innerHTML = emptyStateHtml('bi-shop', 'No sellers yet',
      'Accounts that register as sellers (or are promoted by you) appear here.');
    return;
  }

  root.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle am-table">' +
      '<thead><tr><th>Seller</th><th>Phone</th><th class="text-center">Products</th><th>Joined</th></tr></thead>' +
      '<tbody>' +
      adminSellers.map(seller => {
        const count = adminProducts.filter(p => p.sellerId === seller.id).length;
        return '<tr>' +
          '<td><b>' + escapeHtml(seller.fullName) + '</b>' +
            '<div class="small text-muted">' + escapeHtml(seller.email) + '</div></td>' +
          '<td>' + escapeHtml(seller.phone || '—') + '</td>' +
          '<td class="text-center"><span class="badge bg-primary rounded-pill">' + count + '</span></td>' +
          '<td class="small text-muted">' + formatDate(seller.createdAt) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
}

/* ------------------------- products ------------------------- */

function fillCategorySelect() {
  const select = document.getElementById('pfCategory');
  if (!select) return;
  select.innerHTML = '<option value="">Select…</option>' +
    adminCategories.map(c =>
      '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.name) + '</option>').join('');
}

function renderProducts() {
  const root = document.getElementById('productsRoot');
  if (!root) return;

  if (!adminProducts.length) {
    root.innerHTML = emptyStateHtml('bi-box-seam', 'No products', 'Add the first listing to populate the store.',
      '<button class="btn btn-primary-am" type="button" onclick="document.getElementById(\'addProductBtn\').click()">' +
      '<i class="bi bi-plus-lg me-1"></i>Add product</button>');
    return;
  }

  root.innerHTML =
    '<div class="table-responsive"><table class="table table-hover align-middle am-table">' +
      '<thead><tr><th>Product</th><th>Seller</th><th>Category</th><th class="text-end">Price</th>' +
      '<th class="text-center">Stock</th><th class="text-end">Actions</th></tr></thead><tbody>' +
      adminProducts.map(p =>
        '<tr>' +
          '<td><div class="d-flex align-items-center gap-2">' +
            '<img class="table-thumb" src="' + escapeHtml(p.image) + '" alt="">' +
            '<div><b>' + escapeHtml(p.name) + '</b>' +
            '<div class="small text-muted">' + escapeHtml(p.brand) +
            (p.featured ? ' · ★ featured' : '') + '</div></div>' +
          '</div></td>' +
          '<td>' + (p.sellerName
            ? '<span class="badge text-bg-success">' + escapeHtml(p.sellerName) + '</span>'
            : '<span class="badge text-bg-secondary">Platform</span>') + '</td>' +
          '<td>' + escapeHtml(p.categoryName || '—') + '</td>' +
          '<td class="text-end">' + formatINR(p.price) + '</td>' +
          '<td class="text-center">' + p.stock + '</td>' +
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

    const submit = document.getElementById('saveProductBtn');
    setLoading(submit, true, 'Saving…');
    try {
      const path = adminEditingProductId
        ? '/admin/products/' + adminEditingProductId
        : '/admin/products';
      const response = await api(path, {
        method: adminEditingProductId ? 'PUT' : 'POST',
        body: payload
      });
      showToast(response.message || 'Product saved', 'success');
      closeProductForm();
      adminProducts = await api('/admin/products');
      renderStats();
      renderProducts();
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
  adminEditingProductId = productId;

  const title = document.getElementById('productFormTitle');
  if (productId === null) {
    title.innerHTML = '<i class="bi bi-plus-circle me-2 text-primary"></i>Add product';
    form.reset();
    form.querySelector('[name="image"]').value = '/images/gadgets/accessories.svg';
  } else {
    const product = adminProducts.find(p => p.id === productId);
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
  adminEditingProductId = null;
}

async function deleteProduct(productId, button) {
  const product = adminProducts.find(p => p.id === productId);
  if (!product) return;
  if (!confirm('Delete "' + product.name + '"? This cannot be undone.')) return;

  setLoading(button, true, '');
  try {
    const response = await api('/admin/products/' + productId, { method: 'DELETE' });
    showToast(response.message || 'Product deleted', 'success');
    adminProducts = await api('/admin/products');
    renderStats();
    renderProducts();
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

  if (!adminOrders.length) {
    root.innerHTML = emptyStateHtml('bi-bag', 'No orders yet', 'Orders placed by buyers will appear here.');
    return;
  }

  root.innerHTML = adminOrders.map((order, index) => {
    const items = (order.items || []).map(item =>
      '<tr>' +
        '<td><div class="d-flex align-items-center gap-2">' +
          '<img class="table-thumb" src="' + escapeHtml(item.productImage || '') + '" alt="">' +
          '<div><b>' + escapeHtml(item.productName) + '</b>' +
          '<div class="small text-muted">' + formatINR(item.unitPrice) + ' × ' + item.quantity +
          (item.sellerName ? ' · ' + escapeHtml(item.sellerName) : '') + '</div></div>' +
        '</div></td>' +
        '<td class="text-center"><span class="status-pill status-' +
          escapeHtml(item.status || 'PROCESSING') + '">' + escapeHtml(item.status || 'PROCESSING') + '</span></td>' +
        '<td class="text-end">' + formatINR(item.subtotal) + '</td>' +
      '</tr>').join('');

    return '' +
      '<div class="order-card mb-3">' +
        '<div class="order-head">' +
          '<div>' +
            '<div class="order-number"><i class="bi bi-bag-check me-2 text-primary"></i>' +
              escapeHtml(order.orderNumber) + '</div>' +
            '<div class="order-meta">' + formatDate(order.placedAt) +
              ' · ' + escapeHtml(order.customerName || '—') +
              ' · ' + escapeHtml((order.shipCity || '')) + '</div>' +
          '</div>' +
          '<div class="d-flex align-items-center gap-2 flex-wrap">' +
            '<span class="fw-bold">' + formatINR(order.totalAmount) + '</span>' +
            '<select class="form-select form-select-sm order-status-select" style="width:auto" data-order="' +
              escapeHtml(order.id) + '">' +
              ['PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(s =>
                '<option value="' + s + '"' + (order.status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
            '</select>' +
            '<button class="btn btn-sm btn-outline-primary" data-toggle-items="' + index + '" type="button">' +
              '<i class="bi bi-chevron-down"></i> Items</button>' +
          '</div>' +
        '</div>' +
        '<div class="d-none mt-2" id="orderItems-' + index + '">' +
          '<div class="table-responsive">' +
            '<table class="table table-sm align-middle mb-0 am-table">' +
              '<thead><tr><th>Item</th><th class="text-center">Fulfilment</th>' +
              '<th class="text-end">Subtotal</th></tr></thead>' +
              '<tbody>' + items + '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
      '</div>';
  }).join('');

  root.querySelectorAll('.order-status-select').forEach(select => {
    select.addEventListener('change', () =>
      updateOrderStatus(select, Number(select.dataset.order), select.value));
  });
  root.querySelectorAll('[data-toggle-items]').forEach(button => {
    button.addEventListener('click', () => {
      const box = document.getElementById('orderItems-' + button.dataset.toggleItems);
      if (box) box.classList.toggle('d-none');
    });
  });
}

async function updateOrderStatus(select, orderId, status) {
  const order = adminOrders.find(o => o.id === orderId);
  if (!order) return;
  if (status === 'CANCELLED' &&
      !confirm('Cancel order ' + order.orderNumber + '? Its items will be returned to stock.')) {
    select.value = order.status;
    return;
  }

  try {
    const response = await api('/admin/orders/' + orderId + '/status', {
      method: 'PUT',
      body: { status }
    });
    showToast(response.message || 'Order updated', 'success');
    adminOrders = await api('/admin/orders');
    renderStats();
    renderOrders();
  } catch (err) {
    select.value = order.status;
    handleApiError(err);
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
