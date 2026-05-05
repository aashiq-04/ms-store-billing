// internal/printer/unix.go
//go:build !windows
// +build !windows

package printer

import (
	"fmt"
	"os"
)

// PrintToWindowsPrinter is a stub for non-Windows systems
// On non-Windows, use PrintToUSB instead
func PrintToWindowsPrinter(printerName string, receipt string) error {
	return fmt.Errorf("PrintToWindowsPrinter is not supported on this platform. Use PrintToUSB instead")
}

// PrintToUSB prints receipt to USB printer (non-Windows systems)
func PrintToUSB(printerPath string, data []byte) error {
	if printerPath == "" {
		// Default to a common USB printer path
		printerPath = "/dev/usb/lp0"
	}

	// Open printer device
	printer, err := os.OpenFile(printerPath, os.O_WRONLY, 0)
	if err != nil {
		return fmt.Errorf("failed to open printer %s: %w", printerPath, err)
	}
	defer printer.Close()

	// Write receipt data
	if _, err := printer.Write(data); err != nil {
		return fmt.Errorf("failed to write to printer: %w", err)
	}

	return nil
}

// GetDefaultPrinter is a stub for non-Windows systems
// Returns default USB printer path
func GetDefaultPrinter() (string, error) {
	return "/dev/usb/lp0", nil
}

// ListWindowsPrinters is a stub for non-Windows systems
// Returns common non-Windows printer paths
func ListWindowsPrinters() ([]string, error) {
	return []string{"/dev/usb/lp0", "/dev/usb/lp1", "/dev/ttyUSB0"}, nil
}
