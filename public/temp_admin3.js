
        async function seedDemoSessions() {
            const btn = document.getElementById('seedBtn');
            btn.disabled = true; btn.textContent = 'â³ Seeding...';
            try {
                const res = await fetch('/api/admin/seed-sessions', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || localStorage.getItem('token')), 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (res.ok) {
                    alert('âœ… ' + data.message);
                    document.getElementById('seedBtnWrap').style.display = 'none';
                } else {
                    alert('âŒ ' + (data.error || 'Error'));
                    btn.disabled = false; btn.textContent = 'ðŸŒ± Seed 50 Demo Sessions';
                }
            } catch (e) {
                alert('âŒ ' + e.message);
                btn.disabled = false; btn.textContent = 'ðŸŒ± Seed 50 Demo Sessions';
            }
        async function loadWithdrawals() {
            try {
                const list = await api('/api/admin/withdrawals');
                const wrap = document.getElementById('wdTableWrap');

                if (!list || list.length === 0) {
                    wrap.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">No withdrawal requests found.</div>';
                    return;
                }

                wrap.innerHTML = `
                    <table style="width:100%; text-align:left; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border);">
                                <th style="padding:12px;">ID / User</th>
                                <th style="padding:12px;">Requested</th>
                                <th style="padding:12px;">TDS (0%)</th>
                                <th style="padding:12px; color:var(--gold);">Net Payout</th>
                                <th style="padding:12px;">Method</th>
                                <th style="padding:12px;">Status</th>
                                <th style="padding:12px;">Date</th>
                                <th style="padding:12px; text-align:right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(w => `
                                <tr style="border-bottom:1px solid var(--border);">
                                    <td style="padding:12px;">
                                        <div style="font-weight:bold;">${w.id}</div>
                                        <div style="font-size:0.85rem; color:var(--text); font-weight:500; margin-top:4px;">${w.user_name}</div>
                                        <div style="font-size:0.75rem; color:var(--blue);">${w.user_phone}</div>
                                        <div style="font-size:0.65rem; color:var(--muted);">UID: ${w.user_id}</div>
                                    </td>
                                    <td style="padding:12px;">â‚¹${w.amount.toLocaleString()}</td>
                                    <td style="padding:12px; color:var(--red);">â‚¹${(w.tds_amount || 0).toLocaleString()}</td>
                                    <td style="padding:12px; font-weight:bold; color:var(--gold);">â‚¹${(w.net_amount || w.amount).toLocaleString()}</td>
                                    <td style="padding:12px; font-size:0.8rem;">
                                        ${w.payment_mode}
                                        <div style="font-size:0.65rem; color:var(--muted);">
                                            ${getPaymentDetail(w)}
                                        </div>
                                    </td>
                                    <td style="padding:12px;">
                                        <span style="padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold; text-transform:uppercase; border:1px solid rgba(255,255,255,0.2); 
                                        ${w.status==='completed'?'color:#10b981;background:rgba(16,185,129,0.1);': w.status==='pending'?'color:#f59e0b;background:rgba(245,158,11,0.1);': w.status==='rejected'?'color:#ef4444;background:rgba(239,68,68,0.1);': 'color:#8b5cf6;background:rgba(139,92,246,0.1);'}">${w.status}</span>
                                    </td>
                                    <td style="padding:12px; font-size:0.75rem; color:var(--muted);">
                                        ${new Date(w.created_at * 1000).toLocaleString()}
                                    </td>
                                    <td style="padding:12px; text-align:right;">
                                        ${w.status === 'pending' ? `
                                            <div style="display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap;">
                                                ${w.payment_mode === 'UPI' && (w.upi || w.upi_id) ? `<a href="upi://pay?pa=${w.upi || w.upi_id}&pn=QuizPro&am=${w.net_amount || w.amount}&cu=INR" class="btn" style="padding:4px 8px; font-size:0.75rem; background: var(--green); color: #fff; text-decoration: none;">Pay via GPay</a>` : ''}
                                                <button class="btn btn-primary" style="padding:4px 8px; font-size:0.75rem;" onclick="approveWd('${w.id}')">Mark as Paid âœ…</button>
                                                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.75rem; border-color:var(--red); color:var(--red);" onclick="rejectWd('${w.id}')">Reject</button>
                                            </div>
                                        ` : `
                                            <span style="font-size:0.7rem; color:var(--muted);">Processed</span>
                                        `}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } catch (e) {
                toast('Failed to load withdrawals', 'error');
            }
        }

        function getPaymentDetail(w) {
            if (w.payment_mode === 'UPI') return w.upi || w.upi_id || 'N/A';
            if (w.payment_mode === 'BANK') return `${w.bank_account_number} (${w.bank_ifsc})`;
            if (w.payment_mode === 'REFUND') return `Original ID: ${w.original_payment_id}`;
            return '';
        }

        async function approveWd(id) {
            if (!confirm('Did you complete the payment via GPay/PhonePe? This will mark the withdrawal as PAID.')) return;
            try {
                toast('Marking as paid...', 'info');
                const res = await api('/api/admin/withdrawals/' + id + '/approve', 'POST');
                toast('âœ… ' + res.message, 'success');
                loadWithdrawals();
            } catch (e) {
                toast('âŒ Error: ' + (e.message || 'Operation failed'), 'error');
                loadWithdrawals();
            }
        }

        async function rejectWd(id) {
            if (!confirm('Are you sure you want to REJECT this withdrawal? Funds will be returned to user.')) return;
            try {
                toast('Rejecting...', 'info');
                const res = await api('/api/admin/withdrawals/' + id + '/reject', 'POST');
                toast('âœ… ' + res.message, 'success');
                loadWithdrawals();
            } catch (e) {
                toast('âŒ Error: ' + e.message, 'error');
            }
        }
    
