// frontend/src/components/billing/BillHistory.jsx
import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import { billHistoryAPI, billAPI, printerAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
export default function BillHistory({ onClose }) {
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBill, setSelectedBill] = useState(null);
  const { showSuccess, showError } = useToast();
  useEffect(() => {
    loadHistory(selectedDays);
  }, [selectedDays]);

  const loadHistory = async (days) => {
    setIsLoading(true);
    try {
      const data = await billHistoryAPI.getHistory(days);
      setBills(data.bills || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Failed to load history:', error);
      showError('Failed to load bill history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadHistory(selectedDays);
      return;
    }

    setIsLoading(true);
    try {
      const results = await billHistoryAPI.search(searchQuery);
      setBills(results || []);
      setStats(null); // Clear stats when searching
    } catch (error) {
      console.error('Search failed:', error);
      showError('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  const viewBillDetails = async (billId) => {
    try {
      const bill = await billAPI.getById(billId);
      setSelectedBill(bill);
    } catch (error) {
      console.error('Failed to load bill details:', error);
      showError('Failed to load bill details');
    }
  };

  const reprintBill = async (billId) => {
    try {
      await printerAPI.print(billId);
      showSuccess('Bill sent to printer!');
    } catch (error) {
      console.error('Print failed:', error);
      showError('Print failed: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">📜</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Bill History
              </h1>
              <p className="text-gray-600 mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                Last {selectedDays} days • Auto-deleted after 180 days
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={onClose} className="shadow-md">
            ← Back to Billing
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left: Filters & Stats */}
          <div className="lg:col-span-1">
            {/* Period Selector */}
            <div className="card shadow-xl border-2 border-indigo-100 mb-6">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 rounded-t-lg">
                <h2 className="text-lg font-bold text-white">Period</h2>
              </div>
              <div className="card-body space-y-2">
                {[7, 15, 30,120,180].map((days) => (
                  <button
                    key={days}
                    onClick={() => setSelectedDays(days)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                      selectedDays === days
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Last {days} days
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="card shadow-xl border-2 border-green-100">
                <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 rounded-t-lg">
                  <h2 className="text-lg font-bold text-white">Statistics</h2>
                </div>
                <div className="card-body space-y-4">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Bills</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total_bills}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Sales</p>
                    <p className="text-2xl font-bold text-green-700">₹{stats.total_sales?.toFixed(0)}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <p className="text-sm text-gray-600">Avg. Bill</p>
                    <p className="text-2xl font-bold text-purple-700">₹{stats.avg_bill_amount?.toFixed(0)}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg">
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-2xl font-bold text-amber-700">{stats.total_items}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Bills List */}
          <div className="lg:col-span-3">
            <div className="card shadow-xl border-2 border-indigo-100">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 rounded-t-lg">
                <h2 className="text-xl font-bold text-white">Bills</h2>
              </div>
              <div className="card-body">
                {/* Search */}
                <div className="mb-6 flex gap-2">
                  <input
                    type="text"
                    placeholder="Search by bill number (e.g., 0042 or MS-0042)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="input flex-1"
                  />
                  <Button onClick={handleSearch} variant="primary">
                    🔍 Search
                  </Button>
                  {searchQuery && (
                    <Button
                      onClick={() => {
                        setSearchQuery('');
                        loadHistory(selectedDays);
                      }}
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Bills Table */}
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="text-gray-500 mt-4">Loading bills...</p>
                  </div>
                ) : bills.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-gray-500 text-lg font-medium">No bills found</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {searchQuery ? 'Try a different search term' : `No bills in last ${selectedDays} days`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bills.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-4 bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 border-gray-200 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold text-indigo-700">{bill.bill_number}</span>
                              <span className="text-sm text-gray-500">{formatDate(bill.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span>{bill.item_count} item{bill.item_count !== 1 ? 's' : ''}</span>
                              <span className="text-2xl font-bold text-green-700">₹{bill.total}</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => viewBillDetails(bill.id)}
                              className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-all text-sm"
                            >
                              👁️ View
                            </button>
                            <button
                              onClick={() => reprintBill(bill.id)}
                              className="px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-all text-sm"
                            >
                              🖨️ Reprint
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bill Details Modal */}
        {selectedBill && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="bg-gradient-to-r from-indigo-600 to-purple-700 px-6 py-4 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-white">{selectedBill.bill_number}</h2>
                  <button
                    onClick={() => setSelectedBill(null)}
                    className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-3 py-1 transition-all"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-indigo-100 text-sm mt-1">{formatDate(selectedBill.created_at)}</p>
              </div>
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  {selectedBill.items.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="font-semibold text-gray-900">{item.item_name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {item.quantity} {item.unit} × ₹{item.unit_price.toFixed(2)} = ₹{item.line_total.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t-2 pt-4 space-y-2">
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">₹{selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-2xl font-bold">
                    <span>Total:</span>
                    <span className="text-green-700">₹{selectedBill.total}</span>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Button variant="success" fullWidth onClick={() => reprintBill(selectedBill.id)}>
                    🖨️ Reprint Bill
                  </Button>
                  <Button variant="ghost" fullWidth onClick={() => setSelectedBill(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}