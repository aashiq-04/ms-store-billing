// internal/handlers/printer.go
package handlers

import (
    "net/http"
    "runtime"
    "strconv"
    "strings"

    "ms-store-billing/internal/db"
    "ms-store-billing/internal/printer"
)

// PrintHandler handles print requests
// POST /api/print - Print a bill
func PrintHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodPost {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    // Parse request
    var req struct {
        BillID      int64  `json:"bill_id"`
        PrinterName string `json:"printer_name"`
    }

    if err := parseJSONBody(r, &req); err != nil {
        respondError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
        return
    }

    // Get bill from database
    bill, err := db.GetBillByID(req.BillID)
    if err != nil {
        handleError(w, err)
        return
    }

    // Generate receipt
    receipt := printer.GenerateReceipt(bill)

    // Print based on OS
    var printErr error
    if runtime.GOOS == "windows" {
        // Use printer name or default
        printerName := req.PrinterName
        if printerName == "" {
            printerName, err = printer.GetDefaultPrinter()
            if err != nil {
                respondError(w, http.StatusInternalServerError, "No printer configured. Please set default printer in Windows.")
                return
            }
        }

        printErr = printer.PrintToWindowsPrinter(printerName, receipt)
    } else {
        printErr = printer.PrintToUSB(req.PrinterName, []byte(receipt))
    }

    if printErr != nil {
        respondError(w, http.StatusInternalServerError, "Print failed: "+printErr.Error())
        return
    }

    respondSuccess(w, map[string]interface{}{
        "success": true,
        "message": "Receipt printed successfully",
        "bill_number": bill.BillNumber,
    })
}

// PrintersHandler lists available printers
// GET /api/printers
func PrintersHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodGet {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    var printers []string
    var defaultPrinter string
    var err error

    if runtime.GOOS == "windows" {
        printers, err = printer.ListWindowsPrinters()
        if err != nil {
            respondError(w, http.StatusInternalServerError, "Failed to list printers: "+err.Error())
            return
        }

        defaultPrinter, _ = printer.GetDefaultPrinter()
    } else {
        printers = []string{"USB", "COM1"}
        defaultPrinter = "USB"
    }

    respondSuccess(w, map[string]interface{}{
        "printers": printers,
        "default":  defaultPrinter,
    })
}

// PreviewHandler generates receipt preview without printing
// GET /api/preview/:billId
func PreviewHandler(w http.ResponseWriter, r *http.Request) {
    enableCORS(w)

    if r.Method == http.MethodOptions {
        w.WriteHeader(http.StatusOK)
        return
    }

    if r.Method != http.MethodGet {
        respondError(w, http.StatusMethodNotAllowed, "method not allowed")
        return
    }

    // Extract bill ID from URL
    path := strings.TrimPrefix(r.URL.Path, "/api/preview/")
    billID, err := strconv.ParseInt(path, 10, 64)
    if err != nil {
        respondError(w, http.StatusBadRequest, "invalid bill ID")
        return
    }

    // Get bill
    bill, err := db.GetBillByID(billID)
    if err != nil {
        handleError(w, err)
        return
    }

    // Generate receipt preview
    receipt := printer.GenerateReceipt(bill)

    // Return as plain text
    w.Header().Set("Content-Type", "text/plain; charset=utf-8")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(receipt))
}