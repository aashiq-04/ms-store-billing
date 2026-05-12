// frontend/src/components/billing/BillingScreen.jsx
import React, { useState, useRef, useEffect } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import { productAPI, billAPI } from '../../services/api';
import { smartSearch } from '../../utils/smartSearch';
import ConfirmDialog from '../common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import PrintPreview from './PrintPreview';

const UNIT_OPTIONS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kg' },
  { value: 'gram', label: 'Gram' },
  { value: 'liter', label: 'Liter' },
  { value: 'packet', label: 'Packet' },
  { value: 'dozen', label: 'Dozen' },
];

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
  /** Index of bill line loaded into the add form for correction (null = adding new) */
  const [editingLineIndex, setEditingLineIndex] = useState(null);
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
          
          setSearchResults(results.slice(0, 40)); // More matches visible without scrolling as much
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

  const lineTotal = (quantity, unitPrice) => {
    const q = Number(quantity);
    const p = Number(unitPrice);
    if (Number.isNaN(q) || Number.isNaN(p)) return 0;
    return q * p;
  };

  // Calculate subtotal
  const calculateSubtotal = () => {
    return billItems.reduce((sum, item) => sum + lineTotal(item.quantity, item.unit_price), 0);
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

    const newItem = {
      line_id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      item_name: itemName.trim(),
      tamil_name: selectedTamilName,
      quantity: qty,
      unit: unit,
      unit_price: unitPrice,
      line_total: lineTotal(qty, unitPrice),
    };

    if (editingLineIndex !== null) {
      setBillItems((prev) =>
        prev.map((it, i) => (i === editingLineIndex ? { ...newItem, line_id: it.line_id } : it))
      );
      setEditingLineIndex(null);
    } else {
      setBillItems((prev) => [...prev, newItem]);
    }

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

  const cancelLineEdit = () => {
    setEditingLineIndex(null);
    setItemName('');
    setQuantity('1');
    setPrice('');
    setSelectedTamilName('');
    setUnit('piece');
    setShowDropdown(false);
    setSearchResults([]);
    itemNameRef.current?.focus();
  };

  const loadLineIntoForm = (index) => {
    const item = billItems[index];
    if (!item) return;
    setEditingLineIndex(index);
    setItemName(item.item_name);
    setSelectedTamilName(item.tamil_name || '');
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setPrice(String(item.unit_price));
    setShowDropdown(false);
    setSearchResults([]);
    setTimeout(() => itemNameRef.current?.focus(), 0);
  };

  const removeBillLine = (index) => {
    setBillItems((prev) => prev.filter((_, i) => i !== index));
    if (editingLineIndex === index) {
      setEditingLineIndex(null);
      setItemName('');
      setQuantity('1');
      setPrice('');
      setSelectedTamilName('');
      setUnit('piece');
      setShowDropdown(false);
      setSearchResults([]);
      itemNameRef.current?.focus();
    } else if (editingLineIndex !== null && editingLineIndex > index) {
      setEditingLineIndex(editingLineIndex - 1);
    }
  };

  const patchBillLine = (index, patch) => {
    setBillItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        if (typeof next.unit_price === 'number' && !Number.isNaN(next.unit_price)) {
          next.unit_price = Math.round(next.unit_price * 100) / 100;
        }
        if (typeof next.quantity === 'number' && !Number.isNaN(next.quantity)) {
          next.quantity = Number(next.quantity.toFixed(4));
        }
        return { ...next, line_total: lineTotal(next.quantity, next.unit_price) };
      })
    );
  };

  const qtyBumpStep = (u) => {
    if (u === 'kg' || u === 'liter') return 0.25;
    if (u === 'gram') return 100;
    return 1;
  };

  const adjustLineQty = (index, direction) => {
    const item = billItems[index];
    if (!item) return;
    const step = qtyBumpStep(item.unit) * direction;
    const nextQty = Math.max(0.001, Number((Number(item.quantity) + step).toFixed(4)));
    patchBillLine(index, { quantity: nextQty });
  };

  const setLineQtyFromInput = (index, raw) => {
    const q = parseFloat(raw);
    if (raw === '' || Number.isNaN(q)) return;
    if (q <= 0) {
      showError('Quantity must be greater than zero');
      return;
    }
    patchBillLine(index, { quantity: q });
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
      setEditingLineIndex(null);
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
      setEditingLineIndex(null);
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
      setEditingLineIndex(null);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 px-3 py-2 sm:px-4 sm:py-2 lg:px-5 lg:py-3" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-[1920px] mx-auto px-1 sm:px-2">
        {/* Header */}
        <div className="mb-2 lg:mb-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-2xl">🛒</span>
            </div>
            <div>
              <h1 className="text-3xl lg:text-[2rem] font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                MS Store - Billing
              </h1>
              <p className="text-gray-600 mt-0.5 text-sm flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Quick billing for customers
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              onClick={onOpenHistory}
              // className="shadow-md hover:shadow-lg transition-shadow"
              className="shadow-md hover:shadow-lg transition-shadow px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                📜 History
              </span>
            </Button>
            <Button 
              variant="secondary" 
              onClick={onOpenProducts}
              // className="shadow-md hover:shadow-lg transition-shadow"
              className="shadow-md hover:shadow-lg transition-shadow px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                📦 Products
              </span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* Left: Item Entry Form */}
          <div className="lg:col-span-5">
            <div className="card shadow-xl border-2 border-primary-100">
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold text-white">Add Item to Bill</h2>
              </div>
              <div className="card-body py-4 px-4">
                {editingLineIndex !== null && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    <span className="font-semibold">
                      Editing cart line {editingLineIndex + 1} — save with the green button or Enter on price
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={cancelLineEdit} className="shrink-0 border border-amber-300">
                      Cancel edit
                    </Button>
                  </div>
                )}
                {/* Category Filter */}
                {categories.length > 1 && (
                  <div className="mb-3 p-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <label className="block text-xs font-semibold text-gray-800 mb-2 uppercase tracking-wide">
                      Category filter
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            selectedCategory === cat
                              ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                          }`}
                        >
                          {cat === 'all' ? 'All' : cat}
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
                    <div className="absolute z-50 w-full mt-1 bg-white border-2 border-primary-500 rounded-lg shadow-2xl max-h-[min(52vh,560px)] overflow-y-auto overscroll-contain">
                      <div className="sticky top-0 z-10 bg-primary-50 px-3 py-1.5 border-b border-primary-200 flex justify-between items-center">
                        <p className="text-xs font-semibold text-primary-800">
                          {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''} — click or Enter on first
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
                          className={`w-full px-3 py-2 text-left hover:bg-primary-50 active:bg-primary-100 border-b border-gray-100 last:border-b-0 text-sm leading-snug ${
                            index === 0 ? 'bg-primary-50/80' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate">
                                {product.name}
                                {product.tamil_name && (
                                  <span className="ml-1 text-gray-600 font-normal">({product.tamil_name})</span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0">
                                <span className="font-semibold text-primary-700 tabular-nums">₹{product.price.toFixed(2)}</span>
                                <span className="text-gray-400">·</span>
                                <span>{product.unit}</span>
                                {product.category && (
                                  <>
                                    <span className="text-gray-400">·</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                      {product.category}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            {index === 0 && (
                              <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                                ↵
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity and Unit */}
                <div className="grid grid-cols-2 gap-3 mb-3">
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
                      {UNIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
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
                    {editingLineIndex !== null ? 'Save line (Enter)' : 'Add to bill (Enter)'}
                  </Button>
                  <Button variant="ghost" onClick={() => {
                    setEditingLineIndex(null);
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
          <div className="lg:col-span-7">
            <div className="card sticky top-4 lg:top-6 shadow-xl border-2 border-green-100 flex flex-col max-h-[calc(100vh-2.5rem)]">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-4 py-3 rounded-t-lg flex-shrink-0">
                <h2 className="text-lg font-bold text-white">Current bill</h2>
                <p className="text-green-100 text-xs mt-0.5 leading-snug">
                  Change qty or rate on any line. Use Edit to fix the name in the form. Scroll to review before print.
                </p>
              </div>
              <div className="card-body flex flex-col min-h-0 flex-1 pt-3 pb-4 px-3 sm:px-4">
                <div
                  className="mb-3 flex-1 min-h-0 max-h-[calc(100vh-11rem)] overflow-auto overscroll-y-contain rounded-lg border border-gray-200 bg-white scrollbar-thin"
                  role="region"
                  aria-label="Bill line items"
                >
                  {billItems.length === 0 ? (
                    <div className="text-center py-8 px-3 text-sm text-gray-500">
                      <p className="font-medium text-gray-700">Cart is empty</p>
                      <p className="mt-1 text-xs">Search on the left, set qty and price, then add lines here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] text-sm border-collapse select-text">
                        <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
                          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                            <th className="px-1.5 py-2 w-8 text-center border-b border-gray-200">#</th>
                            <th className="px-2 py-2 border-b border-gray-200">Item</th>
                            <th className="px-1 py-2 border-b border-gray-200 text-right whitespace-nowrap">Qty</th>
                            <th className="px-1 py-2 border-b border-gray-200 w-[4.5rem]">Unit</th>
                            <th className="px-1 py-2 border-b border-gray-200 text-right whitespace-nowrap">Rate ₹</th>
                            <th className="px-2 py-2 border-b border-gray-200 text-right whitespace-nowrap">Amount</th>
                            <th className="px-1 py-2 border-b border-gray-200 w-[5.5rem] text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billItems.map((item, index) => {
                            const lineAmt = lineTotal(item.quantity, item.unit_price);
                            const isEditingRow = index === editingLineIndex;
                            return (
                              <tr
                                key={item.line_id || `row-${index}`}
                                className={`border-b border-gray-100 ${isEditingRow ? 'bg-amber-50' : index % 2 === 1 ? 'bg-gray-50/70' : ''}`}
                              >
                                <td className="px-1 py-1 text-center text-gray-500 tabular-nums text-xs">{index + 1}</td>
                                <td className="px-2 py-1 align-top min-w-0">
                                  <div className="font-semibold text-gray-900 leading-tight break-words">{item.item_name}</div>
                                  {item.tamil_name ? (
                                    <div className="text-[11px] text-gray-600 leading-tight mt-0.5 break-words">{item.tamil_name}</div>
                                  ) : null}
                                </td>
                                <td className="px-1 py-1.5 align-middle">
                                  <div className="flex items-center justify-end gap-0.5">
                                    <button
                                      type="button"
                                      className="h-8 w-7 shrink-0 rounded border border-gray-300 bg-gray-50 text-base font-bold leading-none text-gray-800 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40"
                                      onClick={() => adjustLineQty(index, -1)}
                                      aria-label={`Decrease quantity for ${item.item_name}`}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0.001}
                                      step={0.001}
                                      className="w-[4.8rem] h-10 text-center text-lg font-bold tabular-nums border-2 border-blue-300 rounded bg-blue-50"
                                      value={item.quantity}
                                      onChange={(e) => setLineQtyFromInput(index, e.target.value)}
                                      aria-label={`Quantity for ${item.item_name}`}
                                    />
                                    <button
                                      type="button"
                                      className="h-9 w-9 tex shrink-0 rounded border border-gray-300 bg-gray-50 text-base font-bold leading-none text-gray-800 hover:bg-gray-100 active:bg-gray-200"
                                      onClick={() => adjustLineQty(index, 1)}
                                      aria-label={`Increase quantity for ${item.item_name}`}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-1 py-1.5 align-middle">
                                  <select
                                    value={item.unit}
                                    onChange={(e) => patchBillLine(index, { unit: e.target.value })}
                                    className="w-full max-w-[5rem] text-xs border border-gray-300 rounded py-1 px-0.5 bg-white"
                                    aria-label={`Unit for ${item.item_name}`}
                                  >
                                    {UNIT_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-1 py-1.5 align-middle">
                                  <input
                                    type="number"
                                    min={0.01}
                                    step={0.01}
                                    className="w-[4.25rem] text-right text-sm tabular-nums border border-gray-300 rounded px-0.5 py-1"
                                    value={item.unit_price}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      if (raw === '') return;
                                      const p = parseFloat(raw);
                                      if (!Number.isNaN(p) && p > 0) patchBillLine(index, { unit_price: p });
                                    }}
                                    aria-label={`Rate per ${item.unit} for ${item.item_name}`}
                                  />
                                </td>
                                <td className="px-2 py-1.5 align-middle text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                                  ₹{lineAmt.toFixed(2)}
                                </td>
                                <td className="px-1 py-1.5 align-middle">
                                  <div className="flex gap-1">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      className="!px-2 !py-1 text-[11px]"
                                      onClick={() => loadLineIntoForm(index)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="danger"
                                      size="sm"
                                      className="!px-1 !py-1 text-xs min-h-0"
                                      onClick={() => removeBillLine(index)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t border-gray-200 pt-3 space-y-2 flex-shrink-0 select-text">
                  <div className="flex justify-between text-gray-600 text-sm">
                    <span>Subtotal</span>
                    <span className="font-semibold tabular-nums">₹{calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2.5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-green-700 tabular-nums">₹{calculateTotal()}</span>
                  </div>
                  {billItems.length > 0 && (
                    <p className="text-[11px] text-center text-gray-500">
                      {billItems.length} line{billItems.length !== 1 ? 's' : ''} · rounded up to whole rupee
                    </p>
                  )}
                </div>

                <div className="mt-3 space-y-2 flex-shrink-0">
                  <Button
                    variant="success"
                    fullWidth
                    onClick={saveBill}
                    disabled={billItems.length === 0 || isProcessing}
                    className="text-base py-3 min-h-[2.75rem] shadow-md"
                  >
                    {isProcessing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                        Processing…
                      </span>
                    ) : (
                      <span>
                        <span className="font-bold">Print bill</span>
                        <span className="text-sm font-normal opacity-90"> (F9)</span>
                      </span>
                    )}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      fullWidth
                      onClick={removeLastItem}
                      disabled={billItems.length === 0}
                      className="text-sm py-2.5 font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                    >
                      Undo last line
                      <span className="block text-[10px] font-normal text-amber-800/90">Ctrl+D</span>
                    </Button>
                    <Button
                      variant="danger"
                      fullWidth
                      onClick={clearBill}
                      disabled={billItems.length === 0}
                      className="text-sm py-2.5 font-semibold"
                    >
                      Clear all lines
                    </Button>
                  </div>
                </div>

                
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