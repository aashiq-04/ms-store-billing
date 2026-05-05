// frontend/src/services/api.js
// API service layer for communication with Go backend

const API_BASE = '/api';

// Generic fetch wrapper with error handling
async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data; // Return the data field from APIResponse
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================
// PRODUCT APIs
// ============================================

export const productAPI = {
  // Get all products
  getAll: () => fetchAPI('/products'),

  // Search products by name
  search: (searchTerm) => fetchAPI(`/products?search=${encodeURIComponent(searchTerm)}`),

  // Get products by category
  getByCategory: (category) => fetchAPI(`/products?category=${encodeURIComponent(category)}`),

  // Get single product by ID
  getById: (id) => fetchAPI(`/products/${id}`),

  // Create new product
  create: (product) =>
    fetchAPI('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    }),

  // Update product
  update: (id, updates) =>
    fetchAPI(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  // Delete product
  delete: (id) =>
    fetchAPI(`/products/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================
// BILL APIs
// ============================================

export const billAPI = {
  // Get recent bills
  getRecent: (limit = 20) => fetchAPI(`/bills?limit=${limit}`),

  // Get bill by ID or bill number
  getById: (id) => fetchAPI(`/bills/${id}`),

  // Create new bill
  create: (billData) =>
    fetchAPI('/bills', {
      method: 'POST',
      body: JSON.stringify(billData),
    }),
};

// ============================================
// STATS API
// ============================================

export const statsAPI = {
  // Get system statistics
  get: () => fetchAPI('/stats'),
};

// ============================================
// HEALTH CHECK
// ============================================

export const healthAPI = {
  check: () => fetch(`${API_BASE}/health`).then((r) => r.json()),
};
// ============================================
// PRINTER APIs
// ============================================

export const printerAPI = {
  // Get available printers
  list: () => fetchAPI('/printers'),

  // Print a bill
  print: (billId, printerName = '') =>
    fetchAPI('/print', {
      method: 'POST',
      body: JSON.stringify({
        bill_id: billId,
        printer_name: printerName,
      }),
    }),

  // Get receipt preview
  preview: (billId) =>
    fetch(`/api/preview/${billId}`)
      .then((r) => r.text())
      .catch((err) => {
        console.error('Preview failed:', err);
        throw err;
      }),
};
// ============================================
// BILL HISTORY APIs
// ============================================

export const billHistoryAPI = {
  // Get bills for last N days
  getHistory: (days = 7) => fetchAPI(`/bills/history?days=${days}`),

  // Search bills by bill number or date
  search: (query) => fetchAPI(`/bills/search?q=${encodeURIComponent(query)}`),
};