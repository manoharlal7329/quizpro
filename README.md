# QuizPro Withdrawal System Enhancement

## Overview
This project implements a secure, robust withdrawal system for **QuizPro Arena** with the following key features:

1. **Bank Transfer (IMPS/NEFT) Support** – Users can now withdraw rewards via UPI **or** direct bank transfer.
2. **Withdrawal States** – `REQUESTED`, `PROCESSING`, `SUCCESS`, `FAILED` (plus legacy states) to track the lifecycle.
3. **Synchronous Payout Processing** – Wallet balance is deducted **only after** a successful Razorpay payout.
4. **Retry & Refund Logic** – Automatic retries (up to 3) for failed payouts and instant wallet refunds on permanent failure.
5. **Admin Dashboard Enhancements** – Real‑time monitoring of withdrawal queues (requested, processing, failed, success) on the System Monitor page.
6. **Anti‑Fraud & Rate Limiting** – Checks for duplicate requests, daily limits, and rapid withdrawals.
7. **Comprehensive Logging & Alerts** – Detailed error logs and AI‑driven admin alerts for payout failures.
8. **Cooldown Enforcement** – 5‑minute cooldown between withdrawal attempts.

## Technical Changes

### 1. Database Model (`database/models/Withdrawal.js`)
- Added `payment_mode` enum (`UPI`, `BANK`).
- Added bank fields: `bank_account_number`, `bank_ifsc`, `bank_account_name`.
- Updated status enum to include all withdrawal states.
- Included `retry_count` for auto‑retry tracking.

### 2. Withdrawal Utility (`routes/withdraw_utils.js`)
- Updated `requestWithdrawal` signature to accept `payment_mode` and bank details.
- Conditional population of UPI or bank fields when creating a `Withdrawal` document.
- Validation of required fields based on selected payment mode.

### 3. Wallet API (`routes/wallet.js`)
- Extended request body parsing to include `payment_mode` and bank fields.
- Added validation for bank details.
- Passed new parameters to `requestWithdrawal`.
- Adjusted error handling for payout failures.

### 4. Front‑end UI (`public/wallet.html`)
- Added a **Payment Mode** selector (UPI / Bank Transfer).
- Implemented conditional input fields for UPI ID or bank account details.
- Updated `requestWithdrawal` JavaScript to build the payload based on selected mode.
- Added UI logic to toggle visibility of UPI vs. bank fields.

### 5. Razorpay Payout Integration (`utils/razorpayPayout.js`)
- `processPayout` now sets withdrawal status to `PROCESSING`.
- Immediate refund logic on initial payout creation failure.

### 6. Auto‑Admin Service (`services/autoAdmin.js`)
- Added `monitorPayouts` to poll Razorpay for `PROCESSING` payouts, handle success/failure, perform retries, and trigger refunds/alerts.

### 7. Admin System Status (`routes/admin.js` & `public/system-status.html`)
- Updated API to return counts for each withdrawal state.
- Modified dashboard cards to display **Requested**, **Processing**, **Failed**, **Success** counts with color‑coded status.

## Workflow
1. **User selects payment mode** and fills required fields.
2. Front‑end sends payload to `/api/wallet/withdraw`.
3. Backend validates input, creates a `Withdrawal` with status `REQUESTED`.
4. Synchronous call to `processPayout` creates Razorpay payout and updates status to `PROCESSING`.
5. `autoAdmin` polls for payout result:
   - On success → status `SUCCESS` and wallet remains deducted.
   - On failure → retries up to 3 times, then status `FAILED` and wallet balance is restored.
6. Admin dashboard reflects real‑time state of all withdrawals.

## How to Test
- **UPI Withdrawal**: Use a valid UPI ID; ensure wallet balance is deducted only after payout success.
- **Bank Transfer**: Select *Bank Transfer*, fill bank details, and submit. Verify the same flow.
- Simulate payout failure (e.g., by disabling Razorpay credentials) to test retry and refund logic.
- Check the System Monitor page for correct counts and alerts.

## Future Improvements
- Add support for additional payout providers.
- Implement user‑visible withdrawal history with status details.
- Enhance AI‑admin alerts with predictive failure analysis.

---
*All changes adhere to the project's security and aesthetic guidelines, providing a premium user experience.*
