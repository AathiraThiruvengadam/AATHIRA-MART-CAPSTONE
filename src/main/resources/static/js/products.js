/* ==================================================================
   Shop page: search, category filter, price filter, sorting,
   pagination and URL synchronisation.
   ================================================================== */

const shopState = {
  search: queryParam('search') || '',
  category: queryParam('category') || '',
  minPrice: queryParam('minPrice') || '',
  maxPrice: queryParam('maxPrice') || '',
  sort: queryParam('sort') || 'newest',
  page: parseInt(queryParam('page') || '0', 10) || 0
};

let shopCategories = [];

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('productGrid');
  bindCardActions(grid);

  document.getElementById('sortSelect').value = shopState.sort;
  const searchInput = document.getElementById('shopSearchInput');
  if (searchInput) searchInput.value = shopState.search;
  if (shopState.minPrice) document.getElementById('minPrice').value = shopState.minPrice;
  if (shopState.maxPrice) document.getElementById('maxPrice').value = shopState.maxPrice;

  bindShopEvents();
  loadShopCategories();
  loadProducts();
});

function bindShopEvents() {
  const searchForm = document.getElementById('shopSearchForm');
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    shopState.search = document.getElementById('shopSearchInput').value.trim();
    shopState.page = 0;
    refreshShop();
  });

  document.getElementById('priceFilterForm').addEventListener('submit', event => {
    event.preventDefault();
    shopState.minPrice = document.getElementById('minPrice').value.trim();
    shopState.maxPrice = document.getElementById('maxPrice').value.trim();
    shopState.page = 0;
    refreshShop();
  });

  document.querySelectorAll('[data-price-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const [min, max] = chip.dataset.priceChip.split(',');
      shopState.minPrice = min;
      shopState.maxPrice = max;
      document.getElementById('minPrice').value = min;
      document.getElementById('maxPrice').value = max;
      shopState.page = 0;
      refreshShop();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', event => {
    shopState.sort = event.target.value;
    shopState.page = 0;
    refreshShop();
  });

  document.getElementById('clearFilters').addEventListener('click', () => {
    shopState.search = '';
    shopState.category = '';
    shopState.minPrice = '';
    shopState.maxPrice = '';
    shopState.sort = 'newest';
    shopState.page = 0;

    document.getElementById('shopSearchInput').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('sortSelect').value = 'newest';
    const navInput = document.getElementById('navSearchInput');
    if (navInput) navInput.value = '';

    refreshShop();
    showToast('All filters cleared', 'info');
  });
}

function refreshShop() {
  syncShopUrl();
  highlightCategory();
  loadProducts();
}

function syncShopUrl() {
  const params = new URLSearchParams();
  if (shopState.search) params.set('search', shopState.search);
  if (shopState.category) params.set('category', shopState.category);
  if (shopState.minPrice) params.set('minPrice', shopState.minPrice);
  if (shopState.maxPrice) params.set('maxPrice', shopState.maxPrice);
  if (shopState.sort && shopState.sort !== 'newest') params.set('sort', shopState.sort);
  if (shopState.page > 0) params.set('page', String(shopState.page));
  const query = params.toString();
  history.replaceState(null, '', '/products.html' + (query ? '?' + query : ''));
}

async function loadShopCategories() {
  const box = document.getElementById('categoryFilter');
  try {
    shopCategories = await api('/categories', { auth: false });

    const links = [
      '<a class="filter-link" href="#" data-category="">' +
        '<span><i class="bi bi-shop me-2"></i>All Gadgets</span>' +
        '<span class="count">All</span></a>'
    ].concat(shopCategories.map(category =>
      '<a class="filter-link" href="#" data-category="' + escapeHtml(category.slug) + '">' +
        '<span><i class="bi ' + escapeHtml(category.icon || 'bi-box') + ' me-2"></i>' +
        escapeHtml(category.name) + '</span>' +
        '<span class="count">' + category.productCount + '</span></a>'
    ));

    box.innerHTML = links.join('');

    box.querySelectorAll('[data-category]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        shopState.category = link.dataset.category;
        shopState.page = 0;
        refreshShop();
      });
    });

    highlightCategory();
  } catch (err) {
    box.innerHTML = '<p class="text-muted small mb-0">Could not load categories.</p>';
  }
}

function highlightCategory() {
  document.querySelectorAll('#categoryFilter [data-category]').forEach(link => {
    link.classList.toggle('active', link.dataset.category === shopState.category);
  });

  const active = shopCategories.find(category => category.slug === shopState.category);
  const title = document.getElementById('shopTitle');
  const subtitle = document.getElementById('shopSubtitle');
  const crumb = document.getElementById('breadcrumbCurrent');

  if (shopState.search) {
    title.textContent = 'Results for “' + shopState.search + '”';
    subtitle.textContent = 'Showing gadgets matching your search';
    crumb.textContent = 'Search: ' + shopState.search;
  } else if (active) {
    title.textContent = active.name;
    subtitle.textContent = active.description || 'Browse gadgets in this category';
    crumb.textContent = active.name;
  } else {
    title.textContent = 'All Gadgets';
    subtitle.textContent = 'Search, filter and sort the full gadget catalogue';
    crumb.textContent = 'Shop';
  }
}

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  const count = document.getElementById('resultCount');
  grid.innerHTML = skeletonGrid(9);
  count.textContent = 'Loading products…';

  const params = new URLSearchParams();
  if (shopState.search) params.set('search', shopState.search);
  if (shopState.category) params.set('category', shopState.category);
  if (shopState.minPrice) params.set('minPrice', shopState.minPrice);
  if (shopState.maxPrice) params.set('maxPrice', shopState.maxPrice);
  params.set('sort', shopState.sort);
  params.set('page', String(shopState.page));
  params.set('size', '12');

  try {
    const response = await api('/products?' + params.toString(), { auth: false });
    const products = response.content || [];

    count.textContent = response.totalElements + ' product' + (response.totalElements === 1 ? '' : 's') + ' found';

    if (products.length === 0) {
      grid.innerHTML = '<div class="col-12">' +
        emptyStateHtml('bi-search-heart', 'No gadgets match your filters',
          'Try a different search term, category or price range.',
          '<button class="btn btn-primary-am" id="emptyClear">Clear filters</button>') +
        '</div>';
      const clear = document.getElementById('emptyClear');
      if (clear) clear.addEventListener('click', () => document.getElementById('clearFilters').click());
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    grid.innerHTML = products.map(productCardHtml).join('');
    renderPagination(response.totalPages, response.page);
  } catch (err) {
    grid.innerHTML = '<div class="col-12">' +
      emptyStateHtml('bi-exclamation-triangle', 'Could not load products',
        err.message || 'Please try again shortly.',
        '<button class="btn btn-primary-am" onclick="location.reload()">Retry</button>') +
      '</div>';
    count.textContent = 'Loading failed';
    document.getElementById('pagination').innerHTML = '';
  }
}

function renderPagination(totalPages, currentPage) {
  const pagination = document.getElementById('pagination');
  if (!pagination || totalPages <= 1) {
    if (pagination) pagination.innerHTML = '';
    return;
  }

  const pageItem = (label, page, disabled, active) =>
    '<li class="page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '') + '">' +
      '<a class="page-link" href="#" data-page="' + page + '">' + label + '</a></li>';

  let html = pageItem('&laquo;', currentPage - 1, currentPage === 0, false);

  const windowSize = 5;
  let start = Math.max(0, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize);
  start = Math.max(0, end - windowSize);

  for (let page = start; page < end; page++) {
    html += pageItem(String(page + 1), page, false, page === currentPage);
  }

  html += pageItem('&raquo;', currentPage + 1, currentPage >= totalPages - 1, false);
  pagination.innerHTML = html;

  pagination.querySelectorAll('[data-page]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const page = parseInt(link.dataset.page, 10);
      if (isNaN(page) || page < 0 || page >= totalPages || page === currentPage) return;
      shopState.page = page;
      refreshShop();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}
