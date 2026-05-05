// internal/printer/escpos.go
package printer

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"ms-store-billing/internal/models"
)

// ESC/POS Command Constants
const (
	ESC          = "\x1B"
	GS           = "\x1D"
	INIT         = ESC + "@"     // Initialize printer
	ALIGN_LEFT   = ESC + "a\x00" // Left align
	ALIGN_CENTER = ESC + "a\x01" // Center align
	ALIGN_RIGHT  = ESC + "a\x02" // Right align
	BOLD_ON      = ESC + "E\x01" // Bold on
	BOLD_OFF     = ESC + "E\x00" // Bold off
	SIZE_NORMAL  = ESC + "!\x00" // Normal size
	SIZE_DOUBLE  = ESC + "!\x30" // Double height and width
	SIZE_TALL    = ESC + "!\x10" // Double height
	SIZE_WIDE    = ESC + "!\x20" // Double width
	CUT_FULL     = GS + "V\x00"  // Full cut
	CUT_PARTIAL  = GS + "V\x01"  // Partial cut
	DRAWER_OPEN  = ESC + "p\x00\x19\xFA"

	receiptWidth = 48
	itemColWidth = 30
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
	receipt.WriteString("Chennai, Tamil Nadu")
	receipt.WriteString("\n")
	receipt.WriteString("Phone: +91 8220220731")
	receipt.WriteString("\n")
	receipt.WriteString("\n")

	// Separator
	receipt.WriteString(ALIGN_LEFT)
	receipt.WriteString(strings.Repeat("-", receiptWidth))
	receipt.WriteString("\n")

	// Bill Details
	receipt.WriteString(BOLD_ON)
	receipt.WriteString(fmt.Sprintf("Bill No: %s", bill.BillNumber))
	receipt.WriteString(BOLD_OFF)
	receipt.WriteString("\n")
	receipt.WriteString(fmt.Sprintf("Date: %s", bill.CreatedAt.Format("02 Jan 2006, 03:04 PM")))
	receipt.WriteString("\n")

	// Separator
	receipt.WriteString(strings.Repeat("-", receiptWidth))
	receipt.WriteString("\n")

	// Table Header
	receipt.WriteString(BOLD_ON)
	receipt.WriteString(fmt.Sprintf("%-30s %7s %9s", "Item", "Qty", "Amount"))
	receipt.WriteString(BOLD_OFF)
	receipt.WriteString("\n")
	receipt.WriteString(strings.Repeat("-", receiptWidth))
	receipt.WriteString("\n")

	// Items
	for _, item := range bill.Items {
		itemNameLines := wrapByRuneWidth(item.ItemName, itemColWidth)

		// Format quantity
		var qtyStr string
		if item.Quantity == float64(int(item.Quantity)) {
			qtyStr = fmt.Sprintf("%.0f%s", item.Quantity, getUnitShort(item.Unit))
		} else {
			qtyStr = fmt.Sprintf("%.2f%s", item.Quantity, getUnitShort(item.Unit))
		}

		// Format amount (no decimals)
		amountStr := fmt.Sprintf("%.0f", item.LineTotal)

		// First line includes qty and amount.
		receipt.WriteString(fmt.Sprintf("%-30s %7s %9s", itemNameLines[0], qtyStr, amountStr))
		receipt.WriteString("\n")

		// Tamil name should appear directly below English name.
		if strings.TrimSpace(item.TamilName) != "" {
			tamilLines := wrapByRuneWidth(item.TamilName, itemColWidth)
			for _, line := range tamilLines {
				receipt.WriteString(line)
				receipt.WriteString("\n")
			}
		}

		// Remaining lines are only for wrapped item name.
		for i := 1; i < len(itemNameLines); i++ {
			receipt.WriteString(itemNameLines[i])
			receipt.WriteString("\n")
		}
	}

	// Separator
	receipt.WriteString(strings.Repeat("-", receiptWidth))
	receipt.WriteString("\n")

	// Subtotal (if different from total)
	if bill.Subtotal != bill.Total {
		receipt.WriteString(fmt.Sprintf("%-38s %9.2f", "Subtotal:", bill.Subtotal))
		receipt.WriteString("\n")
	}

	// Total (Bold, Large)
	receipt.WriteString(BOLD_ON)
	receipt.WriteString(SIZE_TALL)
	receipt.WriteString(fmt.Sprintf("%-38s %9.0f", "TOTAL (Rs):", bill.Total))
	receipt.WriteString(SIZE_NORMAL)
	receipt.WriteString(BOLD_OFF)
	receipt.WriteString("\n")

	receipt.WriteString(strings.Repeat("-", receiptWidth))
	receipt.WriteString("\n")
	receipt.WriteString("\n")

	// Footer
	receipt.WriteString(ALIGN_CENTER)
	receipt.WriteString("Thank You! Visit Again")
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
		return "pc"
	case "liter", "l":
		return "L"
	case "packet", "pkt":
		return "pkt"
	case "dozen", "doz":
		return "dz"
	default:
		return ""
	}
}

func wrapByRuneWidth(value string, width int) []string {
	value = strings.TrimSpace(value)
	if value == "" {
		return []string{""}
	}

	runes := []rune(value)
	if len(runes) <= width {
		return []string{value}
	}

	lines := []string{}
	for len(runes) > 0 {
		chunkWidth := width
		if len(runes) < chunkWidth {
			chunkWidth = len(runes)
		}

		chunk := runes[:chunkWidth]
		runes = runes[chunkWidth:]

		line := strings.TrimSpace(string(chunk))
		if utf8.RuneCountInString(line) > width {
			line = string([]rune(line)[:width])
		}
		lines = append(lines, line)
	}

	return lines
}