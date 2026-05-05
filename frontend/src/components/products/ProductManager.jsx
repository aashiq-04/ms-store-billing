// frontend/src/components/products/ProductManager.jsx
import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import Card from '../common/Card';
import ConfirmDialog from '../common/ConfirmDialog';
import { productAPI } from '../../services/api';
import { autoTranslate} from '../../utils/tamilTranslate';
import { smartSearch } from '../../utils/smartSearch';
import { useToast } from '../../context/ToastContext';

export default function ProductManager({ onClose }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { showSuccess, showError } = useToast();
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    product: null,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    tamil_name: '',
    price: '',
    unit: 'piece',
    category: '',
  });

  // Auto-translate when English name changes
  useEffect(() => {
    if (formData.name && !editingProduct) {
      const translated = autoTranslate(formData.name);
      if (translated) {
        setFormData(prev => ({ ...prev, tamil_name: translated }));
      }
    }
  }, [formData.name, editingProduct]);

  // Load products on mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products when search or category changes
  useEffect(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Smart search (supports initials, multi-word, etc.)
    if (searchTerm) {
      filtered = smartSearch(filtered, searchTerm);
    }

    setFilteredProducts(filtered);
  }, [searchTerm, selectedCategory, products]);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const data = await productAPI.getAll();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      showError('Failed to load products: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showError('Please enter product name');
      return;
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      showError('Please enter valid price');
      return;
    }

    try {
      // Convert price to number before sending
      const productData = {
        name: formData.name,
        tamil_name: formData.tamil_name || '',
        price: parseFloat(formData.price),  // ← Convert to number
        unit: formData.unit,
        category: formData.category || '',
      };

      await productAPI.create(productData);
      showSuccess('Product added successfully!');
      setShowAddForm(false);
      resetForm();
      loadProducts();
    } catch (error) {
      showError('Failed to add product: ' + error.message);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();

    try {
      const updates = {
        name: formData.name,
        tamil_name: formData.tamil_name || '',
        price: parseFloat(formData.price),  // ← Convert to number
        unit: formData.unit,
        category: formData.category || '',
      };

      await productAPI.update(editingProduct.id, updates);
      showSuccess('Product updated successfully!');
      setEditingProduct(null);
      resetForm();
      loadProducts();
    } catch (error) {
      showError('Failed to update product: ' + error.message);
    }
  };

  const handleDeleteProduct = async (product) => {
    setConfirmDialog({
      isOpen: true,
      product: product,
    });
  };

  const confirmDelete = async () => {
    const product = confirmDialog.product;
    
    try {
      await productAPI.delete(product.id);
      showSuccess('Product deleted successfully!');
      setConfirmDialog({ isOpen: false, product: null });
      loadProducts();
    } catch (error) {
      showError('Failed to delete product: ' + error.message);
    }
  };

  const cancelDelete = () => {
    setConfirmDialog({ isOpen: false, product: null });
  };

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      tamil_name: product.tamil_name || '',
      price: product.price.toString(),
      unit: product.unit,
      category: product.category || '',
    });
    setShowAddForm(false);
    
    // Scroll to form smoothly
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      tamil_name: '',
      price: '',
      unit: 'piece',
      category: '',
    });
  };

  // Get unique categories
  const categories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📦</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Product Management
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                Manage your product catalog • {products.length} products
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            onClick={onClose}
            className="shadow-md hover:shadow-lg transition-shadow"
          >
            <span className="flex items-center gap-2">
              ← Back to Billing
            </span>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Product List */}
          <div className="lg:col-span-2">
            <div className="card shadow-xl border-2 border-purple-100">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📋</span> Product Catalog
                </h2>
              </div>
              <div className="card-body">
                {/* Search and Filter */}
                <div className="mb-6 space-y-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-xl">🔍</span>
                    </div>
                    <input
                      type="text"
                      placeholder="Search products by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input pl-12 pr-10 shadow-md border-2 border-gray-200 focus:border-purple-400"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                    <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-lg">🏷️</span>
                      Filter by Category
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all transform hover:scale-105 ${
                            selectedCategory === cat
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white shadow-lg'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                          }`}
                        >
                          {cat === 'all' ? '📦 All' : cat}
                          {cat !== 'all' && (
                            <span className="ml-1 text-xs opacity-75">
                              ({products.filter(p => p.category === cat).length})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(searchTerm || selectedCategory !== 'all') && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border-2 border-blue-200">
                      <p className="text-sm text-blue-800 font-medium">
                        📊 Showing {filteredProducts.length} of {products.length} products
                      </p>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('all');
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium underline"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Product Table - Scrollable */}
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
                    <p className="text-gray-500">Loading products...</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📦</div>
                    <p className="text-gray-500 text-lg font-medium mb-2">
                      {searchTerm || selectedCategory !== 'all'
                        ? 'No products match your filters'
                        : 'No products yet'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {searchTerm || selectedCategory !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Add your first product to get started!'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table className="table">
                      <thead className="sticky top-0 bg-white z-10 shadow-sm">
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <th className="w-1/3">Product Name</th>
                          <th className="w-1/6">Price</th>
                          <th className="w-1/6">Unit</th>
                          <th className="w-1/6">Category</th>
                          <th className="w-1/6">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr key={product.id}>
                            <td className="font-medium">
                              {product.name}
                              {product.tamil_name && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {product.tamil_name}
                                </div>
                              )}
                            </td>
                            <td>₹{product.price.toFixed(2)}</td>
                            <td className="text-gray-600">{product.unit}</td>
                            <td>
                              {product.category && (
                                <span className="badge badge-success">
                                  {product.category}
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(product)}
                                  className="px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 active:bg-primary-200 rounded-md font-medium transition-all duration-200 flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(product)}
                                  className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 rounded-md font-medium transition-all duration-200 flex items-center gap-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Add/Edit Form - Sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <Card
                title={
                  editingProduct
                    ? '✏️ Edit Product'
                    : showAddForm
                    ? '➕ Add New Product'
                    : '⚡ Quick Actions'
                }
              >
                {!showAddForm && !editingProduct ? (
                  <div className="space-y-3">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => {
                        setShowAddForm(true);
                        // Small delay to let state update before scrolling
                        setTimeout(() => {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }, 100);
                      }}
                    >
                      ➕ Add New Product
                    </Button>
                    <Button variant="secondary" fullWidth onClick={loadProducts}>
                      🔄 Refresh List
                    </Button>
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 font-medium mb-1">💡 Quick Tip</p>
                      <p className="text-xs text-blue-600">
                        Use different product variants (50g, 100g, 500g) as separate products for flexible pricing
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-4">
                    {editingProduct && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                        <p className="text-sm text-amber-800 font-medium">
                          Editing: {editingProduct.name}
                        </p>
                      </div>
                    )}

                    {/* Scrollable form content */}
                    <div className="space-y-4" style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '7px' }}>
                      <Input
                        label="Product Name (English)"
                        placeholder="e.g., Badam 100g"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />

                      <Input
                        label="Tamil Name (தமிழ் பெயர்)"
                        placeholder="தமிழில் உள்ளிடவும்"
                        value={formData.tamil_name}
                        onChange={(e) =>
                          setFormData({ ...formData, tamil_name: e.target.value })
                        }
                      />
                      {!editingProduct && formData.tamil_name && (
                        <p className="text-xs text-blue-600 -mt-2 mb-2">
                          ✨ Auto-translated (you can edit)
                        </p>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price (₹)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]*\.?[0-9]*"
                          placeholder="0.00"
                          value={formData.price}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Only allow numbers and decimal point
                            if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                              setFormData({ ...formData, price: value });
                            }
                          }}
                          className="input"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <select
                          value={formData.unit}
                          onChange={(e) =>
                            setFormData({ ...formData, unit: e.target.value })
                          }
                          className="input"
                        >
                          <option value="piece">Piece</option>
                          <option value="kg">Kg</option>
                          <option value="gram">Gram</option>
                          <option value="liter">Liter</option>
                          <option value="packet">Packet</option>
                          <option value="dozen">Dozen</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={formData.category}
                          onChange={(e) =>
                            setFormData({ ...formData, category: e.target.value })
                          }
                          className="input"
                        >
                          <option value="all">All</option>
                          <option value="Groceries">Groceries</option>
                          <option value="Dry Fruits">Dry Fruits</option>
                          <option value="Grains">Grains</option>
                          <option value="Pulses">Pulses</option>
                          <option value="Spices">Spices</option>
                          <option value="Other">Other</option>
                       
                        </select>
                      </div>
                    </div>

                    {/* Sticky buttons at bottom of form */}
                    <div className="space-y-2 pt-4 border-t border-gray-200 bg-white">
                      <Button
                        type="submit"
                        variant={editingProduct ? 'success' : 'primary'}
                        fullWidth
                      >
                        {editingProduct ? '✓ Update Product' : '+ Add Product'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        fullWidth
                        onClick={() => {
                          if (editingProduct) {
                            cancelEdit();
                          } else {
                            setShowAddForm(false);
                            resetForm();
                          }
                        }}
                      >
                        ✕ Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Delete Product?"
        message={
          confirmDialog.product
            ? `Are you sure you want to delete "${confirmDialog.product.name}"? This action cannot be undone.`
            : ''
        }
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}