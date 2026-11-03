# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status (as of 2026-11-03)

**Phases 1-8: Completed.** The app is stable, tested, and optimized for mobile.

**Last 3 commits:**
- `008ad31` — Claude Code & UIUX Updates
- `960cf5e` — Update roadmap: Phase 8 mobile UI/UX optimization completed
- `98a9650` — Mobile UI/UX optimization for billing screen

**What works:**
- PIN authentication (default: `1234`) with 7-day sessions
- Multi-device access (LAN + Tailscale remote)
- Full billing workflow (products, cart, bills, history)
- Thermal receipt printing (ESC/POS) — backend generates receipts, frontend shows preview
- Session expiry gracefully redirects to login
- Logout button in UI header
- Mobile-optimized cart with touch-friendly controls

**Immediate priority:** Make the app production-ready for daily shop use:
1. Purchase and integrate a 58mm USB thermal printer
2. Production-readiness testing in the actual shop

**Next steps (after production use is stable):**
- GST implementation (Phases 11–16, pending auditor approval of GST mappings)

---

## Project Roadmap and Current Progress

When continuing this project, always inspect this section first. Continue from the next pending phase. Do not create a separate phase structure, start optional improvements, or go sideways into unrelated enhancements unless explicitly requested by the user.

### Phase 1 — Browser/LAN Access
**Status:** Completed
**Goal:** Make the existing application accessible through a browser and from devices on the same local network.
**Result:** Server binds to `0.0.0.0:8080`, LAN IP displayed at startup, frontend served as embedded SPA.

### Phase 2 — Basic Authentication
**Status:** Completed
**Goal:** Protect the application and API with PIN authentication and session management.
**Implemented:**
- PIN-based authentication (default: `1234`, configurable via `MS_BILLING_PIN` env var)
- 7-day session cookies (`ms_billing_session`, HTTP-only)
- Login endpoint: `POST /api/login`
- Logout endpoint: `POST /api/logout`
- Session check endpoint: `GET /api/session`
- Authentication middleware protecting all `/api/*` routes except login/session/health
- LAN IP and PIN displayed at startup for easy mobile access

### Phase 3 — Mobile Responsiveness
**Status:** Completed / Verified
**Goal:** Ensure the existing React interface is usable from mobile and tablet browsers.
**Result:** Existing responsive implementation was reviewed. No major changes required. Login screen optimized for numeric input.

### Phase 4 — Secure Remote Access
**Status:** Completed
**Goal:** Allow secure access to the application from outside the local network.
**Approach:** Tailscale
**Completed:**
- ✅ Tailscale installed on Windows PC (server) — IP: `100.120.70.96`
- ✅ Tailscale installed on Android phone (client) — IP: `100.102.85.43`
- ✅ Both devices connected to same Tailscale network
- ✅ Remote access tested successfully — Android can access MS Store Billing via `http://100.120.70.96:8080`
- ✅ Multi-device session support implemented — Multiple devices can now stay logged in simultaneously
- ✅ Cross-device data sync verified — Products added from one device appear on another

### Phase 5 — End-to-End Real-World Testing
**Status:** Completed
**Goal:** Test the complete workflow in realistic conditions.
**Results:**
- ✅ All 15 API tests passed (auth, products, bills, history, stats, printers, logout, multi-session)
- ✅ 401 session expiry handling added — expired sessions redirect to login
- ✅ Bill creation with correct field names verified (`item_name`, `unit_price`, `quantity`, `unit`)
- ✅ Receipt preview (ESC/POS) generates correctly
- ✅ Multi-device sessions work independently — both stay logged in

### Phase 6 — Fix Real Issues Found During Testing
**Status:** Completed
**Goal:** Address bugs or usability/security issues actually discovered during end-to-end testing.
**Issues found and fixed:**
1. ✅ **Multi-device session conflict** — When PC and Android both logged in, one got "session expired" error.
   - **Root cause:** Single session token stored globally, replaced on each new login.
   - **Fix:** Implemented multi-session support in `internal/auth/auth.go` using a `map[string]*Session` to store multiple active sessions.
   - **Result:** Multiple devices can now stay logged in simultaneously with independent sessions.

### Phase 7 — Optional Improvements
**Status:** Completed
**Goal:** Add practical improvements for single-user usage scenario.
**Implemented:**
- ✅ **Logout button in UI** — Added to BillingScreen header, calls `/api/logout` and returns to login screen

**Excluded (with reasoning):**
- **Login rate limiting** — Single-user, trusted device scenario. No meaningful threat model; attacker would need LAN/Tailscale access first.
- **Persistent sessions** — Re-login after restart is acceptable. Avoids file I/O complexity and potential state corruption.

### Phase 8 — Mobile UI/UX Optimization
**Status:** Completed
**Goal:** Optimize billing screen for real-world mobile and tablet usage by a single user.
**Implemented:**
- ✅ **Removed horizontal scroll on mobile** — Cart now uses vertical card layout (`lg:hidden`) instead of `min-w-[520px]` table
- ✅ **Retained table on tablet/desktop** — Efficient table layout preserved with `hidden lg:block`
- ✅ **Increased touch targets** — Quantity +/- buttons now 44px (h-11 w-11), inputs h-12 on mobile
- ✅ **Widened rate input** — Mobile rate input has more space, better for numeric keyboard
- ✅ **Improved input sizing** — All form inputs get h-12 for better mobile touch experience

**Files changed:**
- `frontend/src/components/billing/BillingScreen.jsx`

**Responsive behavior:**
- Mobile (<1024px): Vertical card layout with large touch targets, no horizontal scroll
- Tablet/Desktop (≥1024px): Efficient table layout, slightly larger controls

**Build verification:**
- ✅ Frontend builds successfully
- ✅ Go backend compiles successfully

**Deferred for real-world testing:**
- Gesture-based interactions (swipe to remove)
- Quick-add for frequently used products
- Further optimizations based on actual usage feedback

### Phase 9 — Thermal Printer Integration
**Status:** Pending — awaiting printer purchase
**Goal:** Purchase a 58mm USB ESC/POS thermal printer and integrate it for production receipt printing.
**Pre-purchase analysis completed (2026-11-03):**
- ✅ Backend ESC/POS receipt generation exists (`internal/printer/escpos.go`)
- ✅ Windows print pipeline exists (`internal/printer/windows.go`) — sends raw data via `\\localhost\PRINTER_NAME`
- ✅ API endpoints exist: `POST /api/print`, `GET /api/printers`, `GET /api/preview/:id`
- ✅ Mobile→server→printer flow is architecturally supported

**Known issues to fix after purchase:**
- `receiptWidth` is 48 (80mm format) — must change to 32 for 58mm printer
- Column widths in `GenerateReceipt()` need recalculation for 32-char width
- Frontend `PrintPreview` already uses 32-char width (correct for 58mm)
- `BillingScreen.jsx` has `// TODO: Trigger print` — print button not wired to `printerAPI.print()`
- Tamil text rendering depends on printer firmware Unicode support — test after purchase
- Printer must be shared in Windows (`\\localhost\name` requires sharing enabled)

**Printer purchase requirements:**
- 58mm paper, USB interface, ESC/POS compatible, Windows 10/11 driver
- Auto-cutter recommended, UTF-8/multilingual support strongly recommended for Tamil text

### Phase 10 — Production-Readiness Testing
**Status:** Pending (blocked by Phase 9)
**Goal:** Test the complete billing workflow in the actual shop with the real printer.
**Scope:**
- End-to-end bill creation and printing from both PC and mobile
- Receipt formatting verification on actual paper
- Tamil text printing validation
- Daily usage workflow validation
- Performance under real-world conditions
- Any bug fixes discovered during shop testing

### Phase 11 — GST Product Master
**Status:** Future (pending after Phases 9-10 are complete)
**Goal:** Add GST classification fields to product database.
**Business context:**
- Regular GST registration
- Existing customer-facing selling prices are retained (GST-inclusive pricing)
- GST calculated from GST-inclusive MRP using back-calculation
- Product-wise GST classification must be verified by auditor before going live
- Do NOT invent HSN codes or GST rates — auditor provides initial mappings

### Phase 12 — GST Billing Engine
**Status:** Future
**Goal:** Implement GST calculation logic in bill creation.
**Key requirements:**
- Back-calculate GST from inclusive prices (e.g., for 5% GST: tax = price × 5/105)
- Support multiple GST rate slabs (0%, 5%, 12%, 18%, 28%)
- CGST/SGST split for intra-state (Tamil Nadu) sales
- Exempt and nil-rated item handling

### Phase 13 — GST Invoices and Receipts
**Status:** Future
**Goal:** Update receipt format to show GST details as required by law.
**Requirements:**
- GSTIN on receipt header
- HSN code per line item
- Tax breakup (CGST + SGST) per item or as summary
- Sequential GST invoice numbering

### Phase 14 — GST Reports
**Status:** Future
**Goal:** Generate GST return data (GSTR-1, GSTR-3B summaries).
**Scope:**
- Monthly/quarterly tax summary reports
- HSN-wise summary
- Export-friendly format for filing

### Phase 15 — Purchase and ITC Management
**Status:** Future
**Goal:** Track purchases and input tax credit for GST compliance.

### Phase 16 — CI/CD
**Status:** Future
**Goal:** Add automated builds via GitHub Actions workflow.

---

## Project Overview

MS Store Billing is a POS (Point of Sale) billing system for a retail grocery store in Chennai, Tamil Nadu. It runs as a single self-contained Windows executable: a Go HTTP server that embeds a React SPA frontend via `go:embed` and uses SQLite (via `modernc.org/sqlite`, a pure-Go driver — no CGo) for persistence. The application supports bilingual product names (English + Tamil) and thermal receipt printing via ESC/POS.

### Multi-Device Access
The server binds to `0.0.0.0:8080` (all network interfaces), making it accessible from any device on the local network. The startup console displays the LAN IP address for easy mobile/tablet access.

### Authentication
Simple PIN-based authentication protects all API endpoints. Default PIN: `1234`. Override via environment variable `MS_BILLING_PIN`. Session cookies are valid for 7 days.

## Build & Run

### Full production build (Windows)
```
build.bat
```
This kills any running instance, rebuilds the React frontend into `./build/`, then compiles the Go binary with `-ldflags="-s -w -H=windowsgui"` (GUI subsystem, no console window). The output is `ms-store-billing.exe`.

### Frontend development (hot-reload)
```
cd frontend
npm install
npm run dev        # Vite dev server on port 3000, proxies /api → localhost:8080
```
Run `go run main.go` in another terminal so the API is available.

### Backend only
```
go run main.go     # Starts HTTP server on :8080, opens browser
```

### Lint (frontend)
```
cd frontend
npm run lint       # ESLint
```

### No test framework is configured yet.

## Architecture

### Backend (Go, stdlib `net/http`)
- **`main.go`** — Entry point. Embeds `build/*` via `go:embed`, serves the SPA with fallback to `index.html`, registers API routes under `/api/*`, auto-opens browser, graceful shutdown via `POST /api/shutdown`. Displays LAN IP and PIN at startup.
- **`internal/auth/`** — Simple PIN-based authentication. Session tokens stored in memory (valid 7 days). All `/api/*` routes except `/api/login`, `/api/logout`, `/api/session` require authentication.
- **`internal/models/`** — Domain types (`Product`, `Bill`, `BillItem`) with validation methods and typed error types (`ValidationError`, `NotFoundError`).
- **`internal/db/`** — SQLite data access. One global `*sql.DB` with `MaxOpenConns=1`. Uses WAL mode, `writeMutex` for serializing writes, and busy-timeout retry loops. Bill creation is transactional (insert header → generate monthly bill number → insert items → commit).
- **`internal/handlers/`** — HTTP handlers. Manual path-based routing (no router library). `response.go` provides a standard `APIResponse{Success, Data, Error}` envelope. Error dispatch maps `ValidationError→400`, `NotFoundError→404`, else `500`.
- **`internal/printer/`** — Thermal receipt printing. `escpos.go` generates ESC/POS receipt strings. `windows.go` (build-tagged) sends to Windows printers via temp file + `cmd /C type`. `unix.go` provides USB device printing stub.

### Frontend (React 19 + Vite + Tailwind CSS 4)
- Three screens toggled via state in `App.jsx`: `BillingScreen`, `ProductManager`, `BillHistory`.
- `src/services/api.js` — Thin fetch wrapper; all responses unwrap `.data` from the API envelope.
- `src/utils/smartSearch.js` — Client-side product search with ranking (exact → starts-with → initials → word-start → contains → fuzzy) and recency boosting.
- `src/utils/tamilTranslate.js` — Dictionary-based English→Tamil auto-translation for common grocery items.
- `src/context/ToastContext.tsx` — App-wide toast notifications (the only TypeScript file; everything else is JSX).
- Build output goes to `../build/` (relative to `frontend/`), which gets embedded into the Go binary.

### Database
- SQLite file stored at `%APPDATA%/MSStoreBilling/msstore.db` (resolved via `os.UserConfigDir()`). During development with `go run`, it uses the temp exe directory, not the project root.
- Migrations are in `migrations/` and applied on startup via `schema_migrations` tracking table in `db.go`. New migrations must be added to the hard-coded slice in `runMigrations()`.
- Bill numbers are monthly-sequential: `MS-YYYYMM-NNNN` (e.g. `MS-202608-0042`).
- Bills older than 180 days are auto-deleted on startup.
- `bill_items` cascade-deletes with `bills`.

## Key Conventions

- All API responses use `{"success": bool, "data": ..., "error": "..."}` envelope.
- Bill totals are `math.Ceil(subtotal)` — customer always pays rounded up.
- Product search autocomplete is sorted by `last_used_at DESC` to surface frequently-used items.
- Products have bilingual support: `name` (English) + `tamil_name` (Tamil). Bill items snapshot both at creation time.
- Vite dev server proxies `/api` to Go backend at `:8080`; in production the Go server serves everything.
- The Go binary uses `-H=windowsgui` so there's no console; errors are logged to a file for browser-open failures.
