/* ==================================================================
   Home page: category tiles + featured gadgets
   ================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const categoryGrid = document.getElementById('homeCategories');
  const featuredGrid = document.getElementById('featuredGrid');

  bindCardActions(featuredGrid);
  loadHomeCategories(categoryGrid);
  loadFeatured(featuredGrid);
});

async function loadHomeCategories(grid) {
  if (!grid) return;
  try {
    const categories = await api('/categories', { auth: false });
    if (!Array.isArray(categories) || categories.length === 0) {
      grid.innerHTML = '<div class="col-12">' +
        emptyStateHtml('bi-grid', 'No categories yet',
          'Run database.sql or restart the application to seed gadget categories.', '') +
        '</div>';
      return;
    }

    grid.innerHTML = categories.map(category =>
      '<div class="col-6 col-md-4 col-lg-2">' +
        '<a class="cat-card" href="/products.html?category=' + encodeURIComponent(category.slug) + '">' +
          '<div class="cat-icon"><i class="bi ' + escapeHtml(category.icon || 'bi-box') + '"></i></div>' +
          '<h6>' + escapeHtml(category.name) + '</h6>' +
          '<small>' + category.productCount + ' product' + (category.productCount === 1 ? '' : 's') + '</small>' +
        '</a>' +
      '</div>'
    ).join('');
  } catch (err) {
    grid.innerHTML = '<div class="col-12">' +
      emptyStateHtml('bi-wifi-off', 'Could not load categories',
        err.message || 'Please try again shortly.', '') + '</div>';
  }
}

async function loadFeatured(grid) {
  if (!grid) return;
  const emptyBox = document.getElementById('featuredEmpty');
  grid.innerHTML = skeletonGrid(8);

  try {
    const response = await api('/products/featured?size=8', { auth: false });
    const products = response.content || [];

    if (products.length === 0) {
      grid.innerHTML = '';
      if (emptyBox) {
        emptyBox.innerHTML = emptyStateHtml('bi-box-seam', 'No products yet',
          'The catalogue is empty. Start the application to seed sample gadgets.',
          '<a class="btn btn-primary-am" href="/products.html">Go to shop</a>');
        emptyBox.classList.remove('d-none');
      }
      return;
    }

    grid.innerHTML = products.map(productCardHtml).join('');
  } catch (err) {
    grid.innerHTML = '<div class="col-12">' +
      emptyStateHtml('bi-exclamation-triangle', 'Could not load products',
        err.message || 'Please try again shortly.', '') + '</div>';
  }
}
