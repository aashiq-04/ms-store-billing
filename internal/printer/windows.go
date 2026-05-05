// internal/printer/windows.go
//go:build windows
// +build windows

package printer

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// PrintToWindowsPrinter prints receipt to Windows printer
func PrintToWindowsPrinter(printerName string, receipt string) error {
	if printerName == "" {
		return fmt.Errorf("printer name is required")
	}

	// Create temp file with receipt data
	tempDir := os.TempDir()
	tempFile := filepath.Join(tempDir, "receipt.txt")

	// Write receipt to temp file
	if err := os.WriteFile(tempFile, []byte(receipt), 0644); err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tempFile) // Clean up

	// Print using Windows print command
	// This sends raw data directly to the printer
	cmd := exec.Command("cmd", "/C", "type", tempFile, ">", fmt.Sprintf("\\\\localhost\\%s", printerName))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	if err := cmd.Run(); err != nil {
		// Fallback: Try using copy command
		cmd2 := exec.Command("cmd", "/C", "copy", tempFile, fmt.Sprintf("\\\\localhost\\%s", printerName))
		cmd2.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

		if err2 := cmd2.Run(); err2 != nil {
			return fmt.Errorf("failed to print: %w (fallback also failed: %v)", err, err2)
		}
	}

	return nil
}

// ListWindowsPrinters returns list of available printers
func ListWindowsPrinters() ([]string, error) {
	// Use PowerShell to list printers
	cmd := exec.Command("powershell", "-Command", "Get-Printer | Select-Object -ExpandProperty Name")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list printers: %w", err)
	}

	// Parse output
	printers := []string{}
	lines := splitLines(string(output))
	for _, line := range lines {
		if line != "" {
			printers = append(printers, line)
		}
	}

	return printers, nil
}

// GetDefaultPrinter returns the default Windows printer
func GetDefaultPrinter() (string, error) {
	cmd := exec.Command("powershell", "-Command", "Get-WmiObject -Query 'SELECT * FROM Win32_Printer WHERE Default=$true' | Select-Object -ExpandProperty Name")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get default printer: %w", err)
	}

	printerName := string(output)
	printerName = trimWhitespace(printerName)

	if printerName == "" {
		return "", fmt.Errorf("no default printer found")
	}

	return printerName, nil
}

// Helper function to split lines
func splitLines(s string) []string {
	lines := []string{}
	current := ""

	for _, ch := range s {
		if ch == '\n' || ch == '\r' {
			if current != "" {
				lines = append(lines, trimWhitespace(current))
				current = ""
			}
		} else {
			current += string(ch)
		}
	}

	if current != "" {
		lines = append(lines, trimWhitespace(current))
	}

	return lines
}

// Helper function to trim whitespace
func trimWhitespace(s string) string {
	start := 0
	end := len(s)

	for start < end && (s[start] == ' ' || s[start] == '\t' || s[start] == '\n' || s[start] == '\r') {
		start++
	}

	for end > start && (s[end-1] == ' ' || s[end-1] == '\t' || s[end-1] == '\n' || s[end-1] == '\r') {
		end--
	}

	return s[start:end]
}

// PrintToUSB is a stub for Windows (always returns error)
// On Windows, use PrintToWindowsPrinter instead
func PrintToUSB(printerPath string, data []byte) error {
	return fmt.Errorf("PrintToUSB is not supported on Windows. Use PrintToWindowsPrinter instead")
}
