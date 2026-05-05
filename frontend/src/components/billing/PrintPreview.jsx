// frontend/src/components/billing/PrintPreview.jsx
import React, { useState, useEffect } from 'react';
import Button from '../common/Button';

export default function PrintPreview({ bill, onClose }) {
  const [receiptText, setReceiptText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const centerText = (text, width) => {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  };
  
  const truncate = (text, maxLen) => {
    return text.length > maxLen ? text.substring(0, maxLen - 3) + '...' : text;
  };
  
  const formatQty = (qty, unit) => {
    const qtyStr = qty % 1 === 0 ? qty.toString() : qty.toFixed(2);
    const unitShort = unit.substring(0, 2);
    return `${qtyStr}${unitShort}`;
  };
  
  const formatLine = (col1, col2, col3, width) => {
    const c2Start = 17;
    const c3Start = 24;
    
    let line = col1.padEnd(c2Start);
    line += col2.padEnd(c3Start - c2Start);
    line += col3.padStart(width - c3Start);
    
    return line;
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
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(receiptText);
    alert('Receipt copied to clipboard!');
  };
  
  const downloadAsText = () => {
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bill.bill_number}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const generateReceipt = () => {
    setIsLoading(true);
    
    // Generate text receipt (simulating thermal printer output)
    const width = 32; // Standard 58mm thermal printer width
    const receipt = [];

    // Header
    receipt.push('='.repeat(width));
    receipt.push(centerText('MS STORE', width));
    receipt.push(centerText('Chennai, Tamil Nadu', width));
    receipt.push(centerText('Tel: 044-XXXXXXXX', width));
    receipt.push('='.repeat(width));
    receipt.push('');

    // Bill details
    receipt.push(`Bill No: ${bill.bill_number}`);
    receipt.push(`Date: ${formatDate(bill.created_at)}`);
    receipt.push('-'.repeat(width));
    receipt.push('');

    // Items header
    receipt.push(formatLine('Item', 'Qty', 'Amount', width));
    receipt.push('-'.repeat(width));

    // Items
    bill.items.forEach(item => {
      const name = truncate(item.item_name, 16);
      const qty = formatQty(item.quantity, item.unit);
      const amt = `${item.line_total.toFixed(0)}`;
      
      receipt.push(formatLine(name, qty, amt, width));
    });

    receipt.push('-'.repeat(width));
    receipt.push('');

    // Total
    const totalLine = `TOTAL: Rs.${bill.total}/-`;
    receipt.push(centerText(totalLine, width));
    receipt.push('='.repeat(width));
    receipt.push('');

    // Footer
    receipt.push(centerText('Thank You! Visit Again', width));
    receipt.push(centerText('GST: Not Applicable', width));
    receipt.push('');
    receipt.push('');

    setReceiptText(receipt.join('\n'));
    setIsLoading(false);
};

  useEffect(() => {
    if (bill) generateReceipt();
  }, [bill]);



  const printPreview = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Preview - ${bill.bill_number}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              margin: 20px;
              white-space: pre;
              line-height: 1.4;
            }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>${receiptText}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              🖨️ Print Preview
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg px-3 py-1 transition-all"
            >
              ✕
            </button>
          </div>
          <p className="text-green-100 text-sm mt-1">Preview how the receipt will look on thermal printer</p>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <p className="text-gray-500 mt-4">Generating preview...</p>
            </div>
          ) : (
            <>
              {/* Receipt Preview */}
              <div className="mb-6 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <pre className="font-mono text-xs leading-relaxed text-gray-900 whitespace-pre overflow-x-auto">
                    {receiptText}
                  </pre>
                </div>
              </div>

              {/* Info Box */}
              <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-sm text-blue-800 font-medium mb-2">ℹ️ Testing Without Printer</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• This shows exactly how the receipt will print</li>
                  <li>• Standard 58mm thermal printer format (32 characters wide)</li>
                  <li>• Copy to clipboard or download as .txt file for testing</li>
                  <li>• When you get a printer, this will print automatically</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="primary" fullWidth onClick={printPreview}>
                  🖨️ Browser Print
                </Button>
                <Button variant="secondary" fullWidth onClick={copyToClipboard}>
                  📋 Copy Text
                </Button>
                <Button variant="secondary" fullWidth onClick={downloadAsText}>
                  💾 Download .txt
                </Button>
                <Button variant="ghost" fullWidth onClick={onClose}>
                  Close
                </Button>
              </div>

              {/* Tips */}
              <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-800 font-medium mb-2">💡 Tips for Real Printer</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>• Recommended: Munbyn, Rongta, or similar ESC/POS printers</li>
                  <li>• Connect via USB (faster than Bluetooth)</li>
                  <li>• Install Windows drivers before connecting</li>
                  <li>• Set as default printer in Windows settings</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}