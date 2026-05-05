// internal/printer/escpos.go
package printer

import (
    "fmt"
    "strings"

    "ms-store-billing/internal/models"
)

// ESC/POS Command Constants
const (
    ESC          = "\x1B"
    GS           = "\x1D"
    INIT         = ESC + "@"      // Initialize printer
    ALIGN_LEFT   = ESC + "a\x00"  // Left align
    ALIGN_CENTER = ESC + "a\x01"  // Center align
    ALIGN_RIGHT  = ESC + "a\x02"  // Right align
    BOLD_ON      = ESC + "E\x01"  // Bold on
    BOLD_OFF     = ESC + "E\x00"  // Bold off
    SIZE_NORMAL  = ESC + "!\x00"  // Normal size
    SIZE_DOUBLE  = ESC + "!\x30"  // Double height and width
    SIZE_TALL    = ESC + "!\x10"  // Double height
    SIZE_WIDE    = ESC + "!\x20"  // Double width
    CUT_FULL     = GS + "V\x00"   // Full cut
    CUT_PARTIAL  = GS + "V\x01"   // Partial cut
    DRAWER_OPEN  = ESC + "p\x00\x19\xFA" // Open cash drawer
)

// GenerateReceipt creates ESC/POS formatted receipt for thermal printer
func GenerateReceipt(bill *models.Bill) string {
    var receipt strings.Builder

    // Initialize printer
    receipt.WriteString(INIT)

    // Header - Shop Name (Large, Bold, Centered)
    receipt.WriteString(ALIGN_CENTER)
    receipt.WriteString(SIZE_DOUBLE)
    receipt.WriteString(BOLD_ON)
    receipt.WriteString("MS STORE")
    receipt.WriteString("\n")
    receipt.WriteString(SIZE_NORMAL)
    receipt.WriteString(BOLD_OFF)
    
    receipt.WriteString("Neighborhood Grocery Store")
    receipt.WriteString("\n")
    receipt.WriteString("Chennai, Tamil Nadu")
    receipt.WriteString("\n")
    receipt.WriteString("Tel: 044-XXXXXXXX")
    receipt.WriteString("\n")
    receipt.WriteString("\n")

    // Separator
    receipt.WriteString(ALIGN_LEFT)
    receipt.WriteString(strings.Repeat("-", 32))
    receipt.WriteString("\n")

    // Bill Details
    receipt.WriteString(BOLD_ON)
    receipt.WriteString(fmt.Sprintf("Bill No: %s", bill.BillNumber))
    receipt.WriteString(BOLD_OFF)
    receipt.WriteString("\n")
    receipt.WriteString(fmt.Sprintf("Date: %s", bill.CreatedAt.Format("02-Jan-2006 03:04 PM")))
    receipt.WriteString("\n")
    
    // Separator
    receipt.WriteString(strings.Repeat("-", 32))
    receipt.WriteString("\n")

    // Table Header
    receipt.WriteString(BOLD_ON)
    receipt.WriteString(fmt.Sprintf("%-16s %5s %7s", "Item", "Qty", "Amount"))
    receipt.WriteString(BOLD_OFF)
    receipt.WriteString("\n")
    receipt.WriteString(strings.Repeat("-", 32))
    receipt.WriteString("\n")

    // Items
    for _, item := range bill.Items {
        // Item name (max 16 chars)
        itemName := item.ItemName
        if len(itemName) > 16 {
            itemName = itemName[:13] + "..."
        }

        // Format quantity
        var qtyStr string
        if item.Quantity == float64(int(item.Quantity)) {
            qtyStr = fmt.Sprintf("%.0f%s", item.Quantity, getUnitShort(item.Unit))
        } else {
            qtyStr = fmt.Sprintf("%.2f%s", item.Quantity, getUnitShort(item.Unit))
        }

        // Format amount (no decimals)
        amountStr := fmt.Sprintf("%.0f", item.LineTotal)

        // Print line
        receipt.WriteString(fmt.Sprintf("%-16s %5s %7s", itemName, qtyStr, amountStr))
        receipt.WriteString("\n")
    }

    // Separator
    receipt.WriteString(strings.Repeat("-", 32))
    receipt.WriteString("\n")

    // Subtotal (if different from total)
    if bill.Subtotal != bill.Total {
        receipt.WriteString(fmt.Sprintf("%-24s %7.2f", "Subtotal:", bill.Subtotal))
        receipt.WriteString("\n")
    }

    // Total (Bold, Large)
    receipt.WriteString(BOLD_ON)
    receipt.WriteString(SIZE_TALL)
    receipt.WriteString(fmt.Sprintf("%-24s %7.0f", "TOTAL:", bill.Total))
    receipt.WriteString(SIZE_NORMAL)
    receipt.WriteString(BOLD_OFF)
    receipt.WriteString("\n")

    receipt.WriteString(strings.Repeat("-", 32))
    receipt.WriteString("\n")
    receipt.WriteString("\n")

    // Footer
    receipt.WriteString(ALIGN_CENTER)
    receipt.WriteString("Thank You! Visit Again")
    receipt.WriteString("\n")
    receipt.WriteString("GST: Not Applicable")
    receipt.WriteString("\n")
    receipt.WriteString("\n")
    receipt.WriteString("\n")

    // Cut paper
    receipt.WriteString(CUT_PARTIAL)

    return receipt.String()
}

// getUnitShort returns abbreviated unit name
func getUnitShort(unit string) string {
    switch strings.ToLower(unit) {
    case "kilogram", "kg":
        return "kg"
    case "gram", "g":
        return "g"
    case "piece", "pcs":
        return ""
    case "liter", "l":
        return "L"
    case "packet", "pkt":
        return ""
    case "dozen", "doz":
        return "dz"
    default:
        return ""
    }
}