// frontend/src/components/billing/BillingScreen.jsx
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import { productAPI, billAPI } from '../../services/api';
import { smartSearch } from '../../utils/smartSearch';
import ConfirmDialog from '../common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import PrintPreview from './PrintPreview';
export default function BillingScreen({ onOpenProducts, onOpenHistory }) {
  // Form state
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('piece');
  const [price, setPrice] = useState('');
  const [selectedTamilName, setSelectedTamilName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all'); // ← ADD
  const [allProducts, setAllProducts] = useState([]);
  const { showSuccess, showError } = useToast();

  // Bill state
  const [billItems, setBillItems] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [categories, setCategories] = useState([]); // ← ADD
  const [showDropdown, setShowDropdown] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);  
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [lastCreatedBill, setLastCreatedBill] = useState(null);
  // Refs
  const itemNameRef = useRef(null);
  const quantityRef = useRef(null);
  const priceRef = useRef(null);
  const dropdownRef = useRef(null);

  // Focus item name field on mount
  useEffect(() => {
    itemNameRef.current?.focus();
    loadAllProducts();
  }, []);

  // Load all products once at startup for fast searching
  const loadAllProducts = async () => {
    try {
      const products = await productAPI.getAll();
      setAllProducts(products);
      
      // Extract unique categories
      const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
      setCategories(['all', ...uniqueCategories]);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          itemNameRef.current && !itemNameRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search products as user types (INSTANT LOCAL SEARCH)
  useEffect(() => {
    const searchProducts = () => {
      // Don't search if dropdown is being closed after selection
      if (itemName.length >= 1 && showDropdown !== false) {
        try {
          // Filter by category first
          let productsToSearch = allProducts;
          if (selectedCategory !== 'all') {
            productsToSearch = allProducts.filter(p => p.category === selectedCategory);
          }
          
          // Use smart search (instant, no API call)
          const results = smartSearch(productsToSearch, itemName);
          
          setSearchResults(results.slice(0, 20)); // Top 20 results
          if (results.length > 0) {
            setShowDropdown(true);
          } else {
            setShowDropdown(false);
          }
        } catch (error) {
          console.error('Search failed:', error);
          setSearchResults([]);
          setShowDropdown(false);
        }
      } else if (itemName.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
      }
    };

    // Instant search - no debounce needed since it's local
    searchProducts();
  }, [itemName, selectedCategory, allProducts]);

  // Select product from autocomplete
  const selectProduct = (product) => {
    // Immediately hide dropdown and clear results
    setShowDropdown(false);
    setSearchResults([]);
    
    // Set values
    setItemName(product.name);
    setSelectedTamilName(product.tamil_name || '');
    setPrice(product.price.toString());
    setUnit(product.unit);
    
    // Focus next field after a small delay
    setTimeout(() => {
      quantityRef.current?.focus();
      quantityRef.current?.select();
    }, 100);
  };

  // Calculate subtotal
  const calculateSubtotal = () => {
    return billItems.reduce((sum, item) => sum + item.line_total, 0);
  };

  // Calculate total (rounded up)
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return Math.ceil(subtotal);
  };

  // Add item to bill
  const addItem = () => {
    // Validation
    if (!itemName.trim()) {
      showError('Please enter item name');
      itemNameRef.current?.focus();
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      showError('Please enter valid quantity');
      quantityRef.current?.focus();
      return;
    }

    const unitPrice = parseFloat(price);
    if (isNaN(unitPrice) || unitPrice <= 0) {
      showError('Please enter valid price');
      priceRef.current?.focus();
      return;
    }

    // Add item
    const newItem = {
      item_name: itemName,
      tamil_name: selectedTamilName,
      quantity: qty,
      unit: unit,
      unit_price: unitPrice,
      line_total: qty * unitPrice, // For UI display only, not sent to backend
    };

    setBillItems([...billItems, newItem]);

    // Reset form
    setItemName('');
    setQuantity('1');
    setPrice('');
    setSelectedTamilName('');
    setUnit('piece');
    setShowDropdown(false);
    setSearchResults([]); // Clear search results
    itemNameRef.current?.focus();
  };

  // Remove last item
  const removeLastItem = () => {
    if (billItems.length > 0) {
      setBillItems(billItems.slice(0, -1));
    }
  };

  // Clear entire bill
  const clearBill = () => {
    if (billItems.length > 0) {
      setShowClearConfirm(true);
    }
  };

  const confirmClearBill = () => {
    if (billItems.length > 0) {
      setBillItems([]);
      setItemName('');
      setQuantity('1');
      setPrice('');
      setSelectedTamilName('');
      setUnit('piece');
      setSearchResults([]); // Clear search results
      itemNameRef.current?.focus();
    }
  };

  // Save and print bill
  const saveBill = async () => {
    if (billItems.length === 0) {
      showError('Please add at least one item');
      return;
    }

    setIsProcessing(true);

    try {
      // Remove line_total from items before sending to backend
      const itemsToSend = billItems.map(item => ({
        item_name: item.item_name,
        tamil_name: item.tamil_name || '',
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
      }));

      const billData = {
        items: itemsToSend,
      };

      const createdBill = await billAPI.create(billData);
      
      showSuccess(`Bill ${createdBill.bill_number} created successfully!\nTotal: ₹${createdBill.total}`);
      setLastCreatedBill(createdBill);
      setShowPrintPreview(true);
      // TODO: Trigger print
      console.log('Bill to print:', createdBill);

      // Clear for next customer
      setBillItems([]);
      setItemName('');
      setQuantity('1');
      setPrice('');
      setSelectedTamilName('');
      setUnit('piece');
      setSearchResults([]); // Clear search results
      itemNameRef.current?.focus();
    } catch (error) {
      showError('Failed to create bill: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    // F9 - Save bill
    if (e.key === 'F9') {
      e.preventDefault();
      saveBill();
    }
    // Escape - Clear current item
    if (e.key === 'Escape') {
      setItemName('');
      setQuantity('1');
      setPrice('');
      setSelectedTamilName('');
      setShowDropdown(false);
      setSearchResults([]); // Clear search results
      itemNameRef.current?.focus();
    }
    // Ctrl+D - Delete last item
    if (e.ctrlKey && e.key === 'd') {
      e.preventDefault();
      removeLastItem();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 sm:p-5 lg:p-7" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-[1920px] mx-auto px-1 sm:px-2">
        {/* Header */}
        <div className="mb-4 lg:mb-5 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🛒</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                MS Store - Billing
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Quick billing for customers
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={onOpenHistory}
              className="shadow-md hover:shadow-lg transition-shadow"
            >
              <span className="flex items-center gap-2">
                📜 History
              </span>
            </Button>
            <Button 
              variant="secondary" 
              onClick={onOpenProducts}
              className="shadow-md hover:shadow-lg transition-shadow"
            >
              <span className="flex items-center gap-2">
                📦 Products
              </span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* Left: Item Entry Form */}
          <div className="lg:col-span-7">
            <div className="card shadow-xl border-2 border-primary-100">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold text-white">Add Item to Bill</h2>
              </div>
              <div className="card-body">
                {/* Category Filter */}
                {categories.length > 1 && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                    <label className="block text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      Quick Category Filter
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all transform hover:scale-105 ${
                            selectedCategory === cat
                              ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                          }`}
                        >
                          {cat === 'all' ? '📦 All' : cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Name with Autocomplete */}
                <div className="mb-4 relative" ref={dropdownRef}>
                  <Input
                    label="Item Name"
                    placeholder="Type product name or initials (e.g., 'T' or 'TD' for Toor Dal)..."
                    value={itemName}
                    onChange={(e) => {
                      setItemName(e.target.value);
                      if (e.target.value.length >= 1) {
                        setShowDropdown(true); // Re-enable dropdown when typing
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (showDropdown && searchResults.length > 0) {
                          // Select first result
                          selectProduct(searchResults[0]);
                        } else {
                          quantityRef.current?.focus();
                        }
                      }
                      if (e.key === 'Tab' && !e.shiftKey) {
                        setShowDropdown(false);
                      }
                      if (e.key === 'ArrowDown' && searchResults.length > 0) {
                        e.preventDefault();
                        setShowDropdown(true);
                      }
                      if (e.key === 'Escape') {
                        setShowDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (searchResults.length > 0 && itemName.length >= 1) {
                        setShowDropdown(true);
                      }
                    }}
                    inputRef={itemNameRef}
                    autoFocus
                  />
                  {itemName.length > 0 && searchResults.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      💡 Try typing initials like "TD" for Toor Dal
                    </p>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-primary-500 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-slide-up">
                      <div className="sticky top-0 bg-gradient-to-r from-primary-50 to-blue-50 px-4 py-2 border-b border-primary-200">
                        <p className="text-xs font-semibold text-primary-700">
                          ✨ {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''} found
                        </p>
                      </div>
                      {searchResults.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectProduct(product);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-primary-50 active:bg-primary-100 border-b border-gray-100 last:border-b-0 transition-all cursor-pointer ${
                            index === 0 ? 'bg-primary-25' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">
                                {product.name}
                                {product.tamil_name && (
                                  <span className="ml-2 text-gray-600 font-normal">({product.tamil_name})</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                                <span className="font-semibold text-primary-700">₹{product.price.toFixed(2)}</span>
                                <span className="text-gray-400">•</span>
                                <span>{product.unit}</span>
                                {product.category && (
                                  <>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                      {product.category}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {index === 0 && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                                Press ↵
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity and Unit */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Input
                    label="Quantity"
                    type="number"
                    step="0.01"
                    placeholder="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        priceRef.current?.focus();
                      }
                    }}
                    inputRef={quantityRef}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
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
                </div>

                {/* Price */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (per unit)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers and decimal point
                      if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                        setPrice(value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                    ref={priceRef}
                    className="input"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="primary" onClick={addItem} fullWidth>
                    Add Item (Enter)
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    setItemName('');
                    setQuantity('1');
                    setPrice('');
                    setSelectedTamilName('');
                    setSearchResults([]); // Clear search results
                    itemNameRef.current?.focus();
                  }}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Current Bill */}
          <div className="lg:col-span-5">
            <div className="card sticky top-4 lg:top-6 shadow-xl border-2 border-green-100 flex flex-col max-h-[calc(100vh-3rem)] lg:max-h-[calc(100vh-4rem)]">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-5 sm:px-6 py-4 rounded-t-lg flex-shrink-0">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span aria-hidden>🧾</span> Current Bill
                </h2>
                <p className="text-green-100 text-sm mt-1 font-medium">Scroll the list below when you add many items</p>
              </div>
              <div className="card-body flex flex-col min-h-0 flex-1 pt-4 pb-5">
                {/* Bill Items List — tall scroll region for long carts */}
                <div
                  className="mb-4 flex-1 min-h-[12rem] max-h-[min(65vh,680px)] overflow-y-auto overscroll-y-contain scroll-smooth scrollbar-thin pr-1 sm:pr-2 rounded-xl border border-green-100/80 bg-white/60 touch-pan-y"
                  role="region"
                  aria-label="Bill line items"
                >
                  {billItems.length === 0 ? (
                    <div className="text-center py-10 sm:py-12 px-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300 min-h-[min(40vh,320px)] flex flex-col items-center justify-center">
                      <div className="text-5xl sm:text-6xl mb-3" aria-hidden>🛒</div>
                      <p className="text-gray-600 font-semibold text-lg">No items added yet</p>
                      <p className="text-base text-gray-500 mt-2 max-w-xs">Use the form on the left to search and add products</p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-2 sm:p-3">
                      {billItems.map((item, index) => (
                        <div
                          key={index}
                          className="select-text p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-primary-300 transition-colors shadow-sm"
                          title={`Line ${index + 1}: ${item.item_name}`}
                        >
                          <div className="flex justify-between items-start gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-lg sm:text-xl font-bold text-gray-900 leading-snug break-words">{item.item_name}</div>
                              {item.tamil_name && (
                                <div className="text-base text-gray-600 mt-1 leading-snug break-words">{item.tamil_name}</div>
                              )}
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-primary-700 whitespace-nowrap tabular-nums shrink-0">
                              ₹{item.line_total.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-base text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                            <span className="px-3 py-1.5 bg-blue-100 text-blue-900 rounded-lg font-bold text-base tabular-nums">
                              {item.quantity} {item.unit}
                            </span>
                            <span className="text-gray-400 font-bold text-lg" aria-hidden>×</span>
                            <span className="font-semibold text-base tabular-nums">₹{item.unit_price.toFixed(2)} each</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t-2 border-gray-200 pt-4 space-y-3 flex-shrink-0 select-text">
                  <div className="flex justify-between text-gray-600 text-lg">
                    <span>Subtotal:</span>
                    <span className="font-semibold">₹{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                    <span className="text-2xl font-bold text-gray-900">Total:</span>
                    <span className="text-3xl font-bold text-green-700">₹{calculateTotal()}</span>
                  </div>
                  {billItems.length > 0 && (
                    <p className="text-xs text-center text-gray-500">
                      {billItems.length} item{billItems.length !== 1 ? 's' : ''} • Rounded to nearest rupee
                    </p>
                  )}
                </div>

                {/* Bill Actions — full words, large tap targets (no icon-only controls) */}
                <div className="mt-4 space-y-3 flex-shrink-0">
                  <Button
                    variant="success"
                    fullWidth
                    onClick={saveBill}
                    disabled={billItems.length === 0 || isProcessing}
                    className="text-lg py-4 min-h-[3.25rem] shadow-lg hover:shadow-xl transition-shadow"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                        Processing…
                      </span>
                    ) : (
                      <span className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2">
                        <span className="font-bold">Print bill</span>
                        <span className="text-sm font-normal opacity-95">(keyboard F9)</span>
                      </span>
                    )}
                  </Button>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={removeLastItem}
                      disabled={billItems.length === 0}
                      className="min-h-[3.5rem] py-3 px-3 font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border-2 border-amber-300 hover:border-amber-400"
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5 text-center leading-tight">
                        <span className="text-base sm:text-lg">Remove last item</span>
                        <span className="text-xs font-semibold text-amber-800/90 normal-case">Keyboard: Ctrl+D</span>
                      </span>
                    </Button>
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={clearBill}
                      disabled={billItems.length === 0}
                      className="min-h-[3.5rem] py-3 px-3 font-bold shadow-md"
                    >
                      <span className="flex flex-col items-center justify-center gap-0.5 text-center leading-tight">
                        <span className="text-base sm:text-lg">Clear entire bill</span>
                        <span className="text-xs font-semibold opacity-95 normal-case">Removes every line</span>
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Keyboard Shortcuts */}
                {billItems.length === 0 && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-2">Keyboard shortcuts</p>
                    <div className="space-y-1.5 text-sm text-blue-800">
                      <div className="flex justify-between">
                        <span>Enter</span>
                        <span>→ Add item</span>
                      </div>
                      <div className="flex justify-between">
                        <span>F9</span>
                        <span>→ Print bill</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ctrl+D</span>
                        <span>→ Remove last</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Esc</span>
                        <span>→ Clear entry</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Preview Modal */}
      {showPrintPreview && lastCreatedBill && (
        <PrintPreview
          bill={lastCreatedBill}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      {/* Clear Bill Confirmation */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Bill?"
        message={`Remove all ${billItems.length} item${billItems.length !== 1 ? 's' : ''} from current bill?`}
        confirmText="Yes, Clear"
        cancelText="Cancel"
        variant="warning"
        onConfirm={confirmClearBill}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
    
  );
}