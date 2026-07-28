
        requireAdmin();

        function showPanel(name, el) {
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
            document.getElementById('panel-' + name).classList.add('active');
            if (el) el.classList.add('active');
            if (name === 'dashboard') loadDashboard();
            if (name === 'sessions') loadSessions();
            if (name === 'questions') loadSessionsForQ();
            if (name === 'users') loadUsers();
            if (name === 'wallets') loadWallets();
            if (name === 'banners') loadBanners();
            if (name === 'notifs') loadNotifs();
            if (name === 'settings') loadSettings();
            if (name === 'upi') { loadAdminUpiConfig(); loadAdminUpiDeposits(); }
            if (name === 'support-msgs') loadSupportMessages();
        }

        // â”€â”€â”€ SUPPORT MESSAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        async function loadSupportMessages() {
            const wrap = document.getElementById('supportMsgsWrap');
            wrap.innerHTML = '<div class="spinner"></div>';
            try {
                const data = await api('/api/admin/support-messages');
                const msgs = data.messages || [];
                if (!msgs.length) {
                    wrap.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px;">No support messages yet.</p>';
                    return;
                }
                wrap.innerHTML = msgs.map(m => {
                    const statusColor = m.status === 'PENDING' ? '#f59e0b' : m.status === 'REPLIED' ? '#10b981' : '#6b7280';
                    const statusLabel = m.status === 'PENDING' ? 'â³ Pending' : m.status === 'REPLIED' ? 'âœ… Replied' : 'ðŸ”’ Closed';
                    return `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px;margin-bottom:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                            <div>
                                <div style="font-weight:700;font-size:0.95rem;">${m.name || 'Unknown'}</div>
                                <div style="font-size:0.75rem;color:var(--muted);">${m.email || ''} â€¢ ${new Date(m.created_at * 1000).toLocaleString()}</div>
                            </div>
                            <span style="font-size:0.72rem;font-weight:bold;color:${statusColor};background:rgba(0,0,0,0.3);padding:4px 10px;border-radius:8px;">${statusLabel}</span>
                        </div>
                        <div style="background:rgba(0,0,0,0.2);padding:12px;border-radius:10px;margin-bottom:12px;font-size:0.88rem;line-height:1.5;">${m.message}</div>
                        ${m.admin_reply ? `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);padding:10px 14px;border-radius:10px;margin-bottom:12px;font-size:0.82rem;color:#6ee7b7;"><b>Your Reply:</b> ${m.admin_reply}</div>` : ''}
                        ${m.status !== 'CLOSED' ? `
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">
                            <input type="text" id="reply-${m.id}" placeholder="Type your reply..." style="flex:1;padding:8px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:8px;color:#fff;outline:none;font-size:0.85rem;min-width:200px;">
                            <button class="btn btn-primary" style="padding:8px 16px;font-size:0.82rem;" onclick="sendSupportReply(${m.id})">Send Reply</button>
                            <button class="btn btn-outline" style="padding:8px 14px;font-size:0.82rem;color:var(--muted);" onclick="closeSupportMsg(${m.id})">Close</button>
                        </div>` : `<div style="font-size:0.78rem;color:var(--muted);font-style:italic;">This ticket has been closed.</div>`}
                    </div>`;
                }).join('');
            } catch (e) {
                wrap.innerHTML = `<p style="color:var(--red);text-align:center;padding:20px;">âš ï¸ Error: ${e.message}</p>`;
            }
        }

        async function sendSupportReply(id) {
            const input = document.getElementById('reply-' + id);
            const reply = input ? input.value.trim() : '';
            if (!reply) return toast('Reply cannot be empty', 'error');
            try {
                const res = await api('/api/admin/support-messages/' + id + '/reply', 'PATCH', { reply });
                if (res.success) { toast('âœ… Reply saved!', 'success'); loadSupportMessages(); }
                else throw new Error(res.error);
            } catch (e) { toast('Error: ' + e.message, 'error'); }
        }

        async function closeSupportMsg(id) {
            if (!confirm('Mark this message as closed?')) return;
            try {
                const res = await api('/api/admin/support-messages/' + id + '/close', 'PATCH', {});
                if (res.success) { toast('Ticket closed.', 'success'); loadSupportMessages(); }
                else throw new Error(res.error);
            } catch (e) { toast('Error: ' + e.message, 'error'); }
        }

        async function loadAdminUpiConfig() {
            try {
                const conf = await api('/api/admin/upi-config');
                document.getElementById('adminUpiId').value = conf.upi_id || '';
                document.getElementById('adminUpiName').value = conf.upi_name || '';
                document.getElementById('adminUpiPhone').value = conf.upi_phone || '';
                document.getElementById('adminUpiQrUrl').value = conf.qr_url || '';
            } catch (e) {
                console.error('Error loading admin UPI config:', e);
            }
        }

        async function saveAdminUpiConfig() {
            const upi_id = document.getElementById('adminUpiId').value.trim();
            const upi_name = document.getElementById('adminUpiName').value.trim();
            const upi_phone = document.getElementById('adminUpiPhone').value.trim();
            const qr_url = document.getElementById('adminUpiQrUrl').value.trim();

            if (!upi_id) return toast('Please enter a valid Admin UPI ID', 'error');

            try {
                toast('Saving UPI Settings...', 'info');
                const res = await api('/api/admin/upi-config', 'POST', { upi_id, upi_name, upi_phone, qr_url });
                if (res.success) {
                    toast('âœ… ' + res.message, 'success');
                }
            } catch (e) {
                toast('âŒ Save error: ' + e.message, 'error');
            }
        }

        async function loadAdminUpiDeposits() {
            const box = document.getElementById('upiDepositsList');
            if (!box) return;
            try {
                const list = await api('/api/admin/upi-deposits');
                if (!list || list.length === 0) {
                    box.innerHTML = '<div style="padding: 30px; text-align: center; color: var(--muted);">No UPI deposit requests submitted yet.</div>';
                    return;
                }

                let html = `
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Mobile</th>
                                    <th>Date & Time</th>
                                    <th>Amount</th>
                                    <th>UTR No.</th>
                                    <th>Screenshot</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                list.forEach(d => {
                    let statusBadge = '<span style="color: #f59e0b; font-weight: bold;">â³ PENDING</span>';
                    if (d.status === 'APPROVED') {
                        statusBadge = '<span style="color: #10b981; font-weight: bold;">âœ… APPROVED</span>';
                    } else if (d.status === 'REJECTED') {
                        statusBadge = `<span style="color: #ef4444; font-weight: bold;" title="${d.admin_note || ''}">âŒ REJECTED</span>`;
                    }

                    const screenshotBtn = d.screenshot_url 
                        ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" onclick="viewScreenshot('${d.screenshot_url}')">ðŸ‘ View Screenshot</button>`
                        : '<span style="color: var(--muted); font-size: 0.75rem;">No file</span>';

                    let actionBtns = 'â€”';
                    if (d.status === 'PENDING') {
                        actionBtns = `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <div style="display: flex; align-items: center; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 6px; padding: 2px 4px;">
                                    <span style="font-size: 0.75rem; color: var(--muted); margin-right: 2px;">â‚¹</span>
                                    <input type="number" id="credit_amt_${d.id}" value="${d.amount}" style="width: 60px; background: transparent; border: none; color: #fff; font-weight: bold; outline: none; text-align: center; font-size: 0.85rem;" min="0">
                                </div>
                                <button class="btn btn-success" style="padding: 4px 8px; font-size: 0.72rem;" onclick="approveUpiDeposit(${d.id})">Approve âœ…</button>
                                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.72rem;" onclick="rejectUpiDeposit(${d.id})">Reject âŒ</button>
                            </div>
                        `;
                    } else if (d.status === 'APPROVED') {
                        actionBtns = `<small style="color: var(--green);">Credited: <b>â‚¹${d.approved_amount !== null && d.approved_amount !== undefined ? d.approved_amount : d.amount}</b></small>`;
                    } else if (d.status === 'REJECTED') {
                        actionBtns = `<small style="color: var(--muted); display: block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${d.admin_note || ''}">Reason: ${d.admin_note || 'N/A'}</small>`;
                    }

                    html += `
                        <tr>
                            <td>
                                <b>${d.user_name}</b><br>
                                <small style="color: var(--muted); font-size: 0.7rem;">ID: ${d.user_id}</small>
                            </td>
                            <td><span style="font-size: 0.85rem;">${d.user_phone}</span></td>
                            <td><span style="font-size: 0.75rem; color: var(--muted);">${new Date(d.created_at * 1000).toLocaleString()}</span></td>
                            <td><b style="color: #fff; font-size: 0.9rem;">â‚¹${d.amount}</b></td>
                            <td><code style="font-family: monospace; background: rgba(0,0,0,0.4); padding: 4px 6px; border-radius: 6px; color: var(--gold); font-weight: bold; font-size: 0.78rem;">${d.utr}</code></td>
                            <td>${screenshotBtn}</td>
                            <td>${statusBadge}</td>
                            <td>${actionBtns}</td>
                        </tr>
                    `;
                });

                html += '</tbody></table></div>';
                box.innerHTML = html;
            } catch (e) {
                console.error('Load deposits error:', e);
                box.innerHTML = '<div style="color: var(--red); padding: 20px; text-align: center;">Error loading deposit requests.</div>';
            }
        }

        function viewScreenshot(url) {
            if (!url) return toast('No screenshot uploaded', 'error');
            
            const existing = document.getElementById('screenshotModal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'screenshotModal';
            modal.style = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(10px);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            modal.innerHTML = `
                <div style="position: relative; max-width: 90%; max-height: 80%; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <img src="${url}" style="max-width: 100%; max-height: 100%; display: block; object-fit: contain;" alt="Payment Screenshot">
                    <button style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;" onclick="document.getElementById('screenshotModal').remove()">âœ•</button>
                </div>
                <div style="color: #fff; margin-top: 15px; font-weight: bold; background: rgba(0,0,0,0.5); padding: 8px 16px; border-radius: 20px; font-size: 0.85rem;">
                    Click outside or press âœ• to close
                </div>
            `;
            
            modal.onclick = function(e) {
                if (e.target === modal) {
                    modal.remove();
                }
            };
            
            document.body.appendChild(modal);
            setTimeout(() => { modal.style.opacity = '1'; }, 50);
        }

        async function searchUtrHistory() {
            const utr = document.getElementById('adminUtrSearch').value.trim();
            const box = document.getElementById('utrSearchResults');
            if (!utr) return toast('Please enter a UTR to search', 'error');

            box.innerHTML = '<div style="color:var(--muted);text-align:center;">Searching...</div>';
            try {
                const res = await api(`/api/admin/upi-deposits/search?utr=${utr}`);
                if (!res || res.length === 0) {
                    box.innerHTML = '<div style="color:var(--red);text-align:center;">No deposit found with this UTR.</div>';
                    return;
                }

                let html = `
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Screenshot</th>
                                </tr>
                            </thead>
                            <tbody>
                `;

                res.forEach(d => {
                    let statusHtml = '';
                    if(d.status === 'APPROVED') statusHtml = `<span style="color:var(--green);font-weight:bold;">APPROVED</span>`;
                    else if(d.status === 'REJECTED') statusHtml = `<span style="color:var(--red);font-weight:bold;">REJECTED</span><br><small style="color:var(--muted)">${d.admin_note||''}</small>`;
                    else statusHtml = `<span style="color:var(--gold);font-weight:bold;">PENDING</span>`;

                    const dateStr = d.created_at ? new Date(d.created_at * 1000).toLocaleString() : 'N/A';
                    
                    html += `
                        <tr>
                            <td>#${d.user_id}</td>
                            <td>â‚¹${d.amount}</td>
                            <td>${statusHtml}</td>
                            <td style="font-size:0.75rem; color:var(--muted);">${dateStr}</td>
                            <td>
                                ${d.screenshot_url ? `<a href="${d.screenshot_url}" target="_blank" style="color:var(--gold);text-decoration:none;">View Image ðŸ“¸</a>` : 'No Image'}
                            </td>
                        </tr>
                    `;
                });

                html += `</tbody></table></div>`;
                box.innerHTML = html;
            } catch (e) {
                box.innerHTML = `<div style="color:var(--red);text-align:center;">Error: ${e.message}</div>`;
            }
        }

        async function approveUpiDeposit(id) {
            const input = document.getElementById(`credit_amt_${id}`);
            const credit_amount = input ? parseFloat(input.value) : null;

            if (credit_amount === null || isNaN(credit_amount) || credit_amount < 0) {
                return toast('Please enter a valid credit amount', 'error');
            }

            if (!confirm(`Approve deposit request #${id} and credit wallet with â‚¹${credit_amount}?`)) return;
            try {
                toast('Approving deposit...', 'info');
                const res = await api(`/api/admin/upi-deposits/${id}/approve`, 'POST', { credit_amount });
                if (res.success) {
                    toast('âœ… ' + res.message, 'success');
                    loadAdminUpiDeposits();
                }
            } catch (e) {
                toast('âŒ Approval failed: ' + e.message, 'error');
            }
        }

        async function rejectUpiDeposit(id) {
            const note = prompt('Enter rejection reason (e.g. UTR not received in bank):');
            if (note === null) return;
            try {
                toast('Rejecting deposit...', 'info');
                const res = await api(`/api/admin/upi-deposits/${id}/reject`, 'POST', { note });
                if (res.success) {
                    toast('âœ… ' + res.message, 'success');
                    loadAdminUpiDeposits();
                }
            } catch (e) {
                toast('âŒ Rejection failed: ' + e.message, 'error');
            }
        }

        async function loadDashboard() {
            try {
                const data = await api('/api/admin/dashboard');

                // Stats bar
                document.getElementById('statsBar').innerHTML = `
            <div class="card stat-card"><div class="stat-num" style="color:var(--blue)">${data.stats.total_users}</div><div class="stat-lbl">Total Users</div></div>
            <div class="card stat-card"><div class="stat-num" style="color:var(--gold)">${data.stats.total_sessions}</div><div class="stat-lbl">Sessions</div></div>
            <div class="card stat-card"><div class="stat-num" style="color:var(--green)">â‚¹${data.stats.total_revenue}</div><div class="stat-lbl">Revenue (Owner)</div></div>
            <div class="card stat-card"><div class="stat-num" style="color:var(--violet)">â‚¹${data.stats.total_prize}</div><div class="stat-lbl">Prize Paid Out</div></div>`;

                // Recent sessions
                document.getElementById('recentSessions').innerHTML = sessionsTable(data.recentSessions);

                // Owner earnings section
                const collected = data.stats.total_revenue + data.stats.total_prize;
                document.getElementById('ownerEarnings').innerHTML = `
            <div style="display:flex; gap:20px; flex-wrap:wrap;">
                <div style="flex:1; min-width:140px; text-align:center; padding:14px; background:rgba(16,185,129,.1); border-radius:12px;">
                    <div style="font-size:.75rem; color:var(--muted); margin-bottom:4px;">Total Collected</div>
                    <div style="font-size:1.8rem; font-weight:900; color:var(--green);">â‚¹${collected}</div>
                </div>
                <div style="flex:1; min-width:140px; text-align:center; padding:14px; background:rgba(245,158,11,.08); border-radius:12px;">
                    <div style="font-size:.75rem; color:var(--muted); margin-bottom:4px;">Platform Earnings (25%)</div>
                    <div style="font-size:1.8rem; font-weight:900; color:var(--gold);">â‚¹${data.stats.total_revenue}</div>
                </div>
                <div style="flex:1; min-width:140px; text-align:center; padding:14px; background:rgba(139,92,246,.08); border-radius:12px;">
                    <div style="font-size:.75rem; color:var(--muted); margin-bottom:4px;">Prize Distributed (75%)</div>
                    <div style="font-size:1.8rem; font-weight:900; color:var(--violet);">â‚¹${data.stats.total_prize}</div>
                </div>
            </div>
            ${collected === 0 ? '<p style="color:var(--muted); font-size:.85rem; margin-top:14px; text-align:center;">Abhi koi completed session nahi hai. Sessions complete hone pe earnings yahan dikhegi.</p>' : ''}
            `;

            } catch (e) {
                document.getElementById('statsBar').innerHTML = `<p style="color:var(--red);">âš ï¸ Dashboard load failed. Server chal raha hai? (${e.message})</p>`;
                document.getElementById('ownerEarnings').innerHTML = `<p style="color:var(--muted);">Server se data nahi aaya. Refresh karo.</p>`;
            }
        }

        async function createTestSession() {
            if (!confirm('Are you sure you want to create a Demo Session with 19/20 seats booked?')) return;
            try {
                toast('Creating test session... Please wait', 'info');
                const res = await api('/api/admin/test-session', 'POST');
                if (res.success) {
                    toast(res.message, 'success');
                    loadSessions();
                }
            } catch (e) {
                toast(e.message, 'error');
            }
        }

        async function loadSessions() {
            const sessions = await api('/api/admin/sessions');
            document.getElementById('sessionsList').innerHTML = sessionsTable(sessions, true);
        }

        function sessionsTable(sessions, withActions) {
            if (!sessions.length) return '<p style="color:var(--muted);">No sessions found.</p>';
            return `<table><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Seats</th><th>Actions</th></tr></thead><tbody>` +
                sessions.map(s => `<tr>
          <td>#${s.id}</td>
          <td><div style="font-weight:600;">${s.title}</div><div style="font-size:.75rem;color:var(--muted);">â‚¹${s.entry_fee} â€¢ ${s.category_name}</div></td>
          <td><span class="badge badge-${s.status === 'open' ? 'blue' : s.status === 'confirmed' ? 'green' : s.status === 'live' ? 'red' : 'violet'}">${s.status === 'live' ? 'STARTED' : (s.status || 'OPEN').toUpperCase()}</span></td>
          <td>${s.seats_booked}/${s.seat_limit}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button class="btn ${s.is_hidden ? 'btn-outline' : 'btn-violet'}" style="padding:4px 8px; font-size:.7rem;" onclick="toggleVisibility(${s.id}, this)" title="Toggle Visibility">${s.is_hidden ? 'ðŸ™ˆ Hidden' : 'ðŸ‘ï¸ Visible'}</button>
              <button class="btn btn-gold" style="padding:4px 8px; font-size:.7rem;" onclick="forceStart(${s.id})" title="Start Quiz Now">StartðŸš€</button>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:.7rem;" onclick="completeSess(${s.id})">Done</button>
              <button class="btn btn-success" style="padding:4px 8px; font-size:.7rem;" onclick="quickUpload(${s.id})">Upload ðŸ“¤</button>
              <button class="btn btn-outline" style="padding:4px 8px; font-size:.7rem;" onclick="resetSeats(${s.id})">Reset</button>
              <button class="btn btn-danger" style="padding:4px 8px; font-size:.7rem;" onclick="deleteSession(${s.id})" title="Permanently Delete">ðŸ—‘ï¸</button>
            </div>
          </td>
        </tr>`).join('') + '</tbody></table>';
        }

        async function quickUpload(sid) {
            const input = document.getElementById('excelInput');
            const sel = document.getElementById('qSessionSelect');
            // Switch to questions panel and set the correct session
            showPanel('questions');
            setTimeout(() => {
                sel.value = sid;
                loadSessionQuestions();
                input.click();
            }, 100);
        }

        async function createSession() {
            const delayMins = parseInt(document.getElementById('newDelay').value) || 60;
            const payload = {
                category_id: document.getElementById('newCat').value,
                title: document.getElementById('newTitle').value.trim(),
                seat_limit: document.getElementById('newSeats').value,
                entry_fee: document.getElementById('newFee').value,
                quiz_delay_minutes: delayMins
            };
            if (!payload.title) {
                document.getElementById('createAlert').innerHTML = '<div class="alert alert-error">âš ï¸ Session Title required!</div>';
                return;
            }
            try {
                const btn = document.querySelector('#panel-create .btn-primary');
                btn.disabled = true;
                btn.textContent = 'Creating...';
                const r = await api('/api/admin/sessions', 'POST', payload);
                document.getElementById('createAlert').innerHTML = `<div class="alert alert-success">âœ… Session created! Quiz will start <strong>${delayMins} min</strong> after seats fill up.</div>`;
                toast('Session created! âœ…', 'success');
                document.getElementById('newTitle').value = '';
                setTimeout(() => showPanel('sessions'), 1500);
            } catch (e) {
                document.getElementById('createAlert').innerHTML = `<div class="alert alert-error">âŒ Error: ${e.message}</div>`;
                toast('Failed: ' + e.message, 'error');
            } finally {
                const btn = document.querySelector('#panel-create .btn-primary');
                if (btn) { btn.disabled = false; btn.textContent = 'Create Session'; }
            }
        }

        // Live delay preview
        document.addEventListener('DOMContentLoaded', () => {
            const delayEl = document.getElementById('newDelay');
            if (delayEl) {
                delayEl.addEventListener('change', () => {
                    const preview = document.getElementById('delayPreview');
                    if (preview) preview.textContent = delayEl.value + ' min';
                });
            }
        });

        async function loadSessionsForQ() {
            const sessions = await api('/api/admin/sessions');
            const sel = document.getElementById('qSessionSelect');
            const sourceSel = document.getElementById('copySourceSelect');
            const options = sessions.map(s => `<option value="${s.id}">#${s.id} ${s.title}</option>`).join('');
            sel.innerHTML = '<option value="">-- Select Session --</option>' + options;
            sourceSel.innerHTML = '<option value="">-- Select Source Session --</option>' + options;
        }

        async function copyQuestions() {
            const sid = document.getElementById('qSessionSelect').value;
            const sourceId = document.getElementById('copySourceSelect').value;
            if (!sid || !sourceId) return toast('Current session and Source session are both required!', 'error');
            if (sid === sourceId) return toast('Source and Target cannot be the same!', 'error');

            if (!confirm('Are you sure you want to COPY all questions? Existing questions in this session will be DELETED.')) return;

            toast('Copying questions...', 'info');
            try {
                const res = await api(`/api/admin/sessions/${sid}/copy-questions`, 'POST', { source_id: sourceId });
                toast(`âœ… ${res.count} questions copied successfully!`, 'success');
                loadSessionQuestions();
            } catch (e) {
                toast('âŒ Copy failed: ' + e.message, 'error');
            }
        }

        async function loadSessionQuestions() {
            const sid = document.getElementById('qSessionSelect').value;
            if (!sid) { document.getElementById('existingQuestions').innerHTML = ''; return; }
            const qs = await api(`/api/admin/sessions/${sid}/questions`);
            document.getElementById('existingQuestions').innerHTML = qs.length ?
                `<h4 style="margin-bottom:10px; margin-top:20px;">Existing Questions (${qs.length})</h4>` +
                qs.map(q => `<div class="q-row">
          <div class="q-row-text">${q.question_text}<br><span style="color:var(--green); font-size:.8rem;">âœ… ${q.correct.toUpperCase()}</span></div>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:.75rem;" onclick="deleteQ(${q.id})">Delete</button>
        </div>`).join('') :
                '<p style="color:var(--muted); font-size:.88rem; margin-top:20px;">No questions yet.</p>';
        }

        async function uploadExcel() {
            const sid = document.getElementById('qSessionSelect').value;
            if (!sid) { toast('Please select a session first!', 'error'); return; }

            const file = document.getElementById('excelInput').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('session_id', sid);

            toast('Uploading...', 'info');
            try {
                const res = await fetch('/api/admin/questions/upload', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + getToken() },
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                toast(data.message, 'success');
                loadSessionQuestions();
            } catch (e) {
                toast(e.message, 'error');
            }
            document.getElementById('excelInput').value = '';
        }

        async function addQuestion() {
            const sid = document.getElementById('qSessionSelect').value;
            if (!sid) { toast('Select a session first!', 'error'); return; }
            const correct = document.querySelector('input[name=correct]:checked')?.value;
            const q = {
                question_text: document.getElementById('qText').value.trim(),
                option_a: document.getElementById('qA').value.trim(),
                option_b: document.getElementById('qB').value.trim(),
                option_c: document.getElementById('qC').value.trim(),
                option_d: document.getElementById('qD').value.trim(),
                correct,
                explanation: document.getElementById('qExpl').value.trim()
            };
            if (!q.question_text || !q.option_a || !q.correct) { toast('Fill mandatory fields!', 'error'); return; }
            await api('/api/admin/questions', 'POST', { session_id: sid, questions: [q] });
            toast('Question added!', 'success');
            ['qText', 'qA', 'qB', 'qC', 'qD', 'qExpl'].forEach(id => document.getElementById(id).value = '');
            loadSessionQuestions();
        }

        async function deleteQ(id) {
            if (!confirm('Are you sure?')) return;
            await api(`/api/admin/questions/${id}`, 'DELETE');
            loadSessionQuestions();
        }

        async function forceStart(id) {
            if (!confirm('â–¶ï¸ Start quiz NOW for this session?\n\nSaare registered players ke liye quiz turant shuru ho jayega!')) return;
            try {
                const r = await api(`/api/admin/sessions/${id}/start`, 'POST');
                toast('ðŸ”¥ Quiz is LIVE! ' + r.message, 'success');
                loadSessions();
            } catch (e) {
                toast('Error: ' + e.message, 'error');
            }
        }

        async function cancelSession(id) { if (confirm('Cancel?')) { await api(`/api/admin/sessions/${id}/cancel`, 'POST'); loadSessions(); } }
        async function completeSess(id) { await api(`/api/admin/sessions/${id}/complete`, 'POST'); toast('Completed!'); loadSessions(); }
        async function resetSeats(id) { if (confirm('Reset all seats?')) { await api(`/api/admin/sessions/${id}/reset-seats`, 'POST'); loadSessions(); } }
        
        async function toggleVisibility(id, btn) {
            try {
                if (btn) {
                    btn.innerHTML = 'â³...';
                    btn.disabled = true;
                }
                const res = await api(`/api/admin/sessions/${id}/visibility`, 'PATCH');
                toast(res.message);
                loadSessions();
            } catch (e) {
                toast(e.message, 'error');
                if (btn) {
                    btn.innerHTML = 'Error';
                    btn.disabled = false;
                }
            }
        }
        
        let allHiddenState = false;
        async function toggleAllVisibility() {
            allHiddenState = !allHiddenState;
            const action = allHiddenState ? 'hide' : 'unhide';
            const btn = document.getElementById('btn-toggle-all');
            
            try {
                btn.disabled = true;
                const oldHtml = btn.innerHTML;
                btn.innerHTML = 'â³ Processing...';
                
                const res = await api('/api/admin/sessions-bulk-visibility', 'PATCH', { action });
                toast(res.message);
                loadSessions();
                
                btn.innerHTML = allHiddenState ? 'ðŸ‘ï¸ Show All Sessions' : 'ðŸ™ˆ Hide All Sessions';
                btn.disabled = false;
            } catch (e) {
                toast(e.message, 'error');
                allHiddenState = !allHiddenState; // revert state
                btn.innerHTML = allHiddenState ? 'ðŸ‘ï¸ Show All Sessions' : 'ðŸ™ˆ Hide All Sessions';
                btn.disabled = false;
            }
        }
        

        async function deleteSession(id) {
            if (!confirm('âš ï¸ Permanently DELETE this session?\n\nYeh session aur uske saare questions/seats hamesha ke liye remove ho jayenge!')) return;
            try {
                await api(`/api/admin/sessions/${id}`, 'DELETE');
                toast('âœ… Session permanently deleted!', 'success');
                loadSessions();
                loadDashboard();
            } catch (e) {
                toast('âŒ ' + e.message, 'error');
            }
        }

        let _allUsers = [];

        async function loadUsers(sortBy = 'newest') {
            try {
                _allUsers = await api('/api/admin/users');
                loadReferrals();

                // Sorting logic
                if (sortBy === 'oldest') {
                    _allUsers.sort((a, b) => a.created_at - b.created_at);
                } else if (sortBy === 'most_active') {
                    _allUsers.sort((a, b) => b.quizzes_solved - a.quizzes_solved);
                } else {
                    _allUsers.sort((a, b) => b.created_at - a.created_at); // Newest first
                }

                const list = document.getElementById('usersList');
                list.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(255,255,255,0.03); padding:12px; border-radius:12px; gap:12px; flex-wrap:wrap;">
                        <div style="display:flex; align-items:center; gap:16px;">
                            <h3 style="font-size:.95rem; margin:0;">ðŸ‘¤ Total Users: <span style="color:var(--blue);">${_allUsers.length}</span></h3>
                            <input type="text" id="userListSearch" placeholder="Search users..." oninput="filterUsersList()"
                                style="padding:7px 14px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:.8rem; width:180px;" />
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <label style="font-size:.75rem; color:var(--muted);">Sort By:</label>
                            <select onchange="loadUsers(this.value)" style="padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:.8rem;">
                                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>ðŸ“… Newest First</option>
                                <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>â³ Oldest Members</option>
                                <option value="most_active" ${sortBy === 'most_active' ? 'selected' : ''}>ðŸ”¥ Most Active</option>
                            </select>
                        </div>
                    </div>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width:100px;">ID / Joined</th>
                                    <th style="min-width:180px;">User Details</th>
                                    <th style="width:130px;">Referral Info</th>
                                    <th style="width:80px; text-align:center;">Quizzes</th>
                                    <th style="width:130px;">Wallet</th>
                                    <th style="width:110px;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="usersListBody">
                                ${renderUsersBody(_allUsers)}
                            </tbody>
                        </table>
                    </div>`;
            } catch (e) {
                document.getElementById('usersList').innerHTML = `<p style="color:var(--red);">Error loading users: ${e.message}</p>`;
            }
        }

        function filterUsersList() {
            const q = document.getElementById('userListSearch').value.toLowerCase();
            const filtered = _allUsers.filter(u =>
                (u.full_name || u.name || '').toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q) ||
                (u.phone || '').includes(q) ||
                (u.email || '').toLowerCase().includes(q)
            );
            document.getElementById('usersListBody').innerHTML = renderUsersBody(filtered);
        }

        function renderUsersBody(users) {
            if (!users.length) return `<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:40px;">No users found.</td></tr>`;
            return users.map(u => {
                const dep = u.wallet_dep !== undefined ? u.wallet_dep : ((u.wallet_real || 0) - (u.withdrawable || 0));
                const win = u.wallet_win !== undefined ? u.wallet_win : (u.withdrawable || 0);
                const total = dep + win;
                const joinDate = u.created_at ? new Date(u.created_at * 1000).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : 'N/A';
                return `
                    <tr style="vertical-align:middle;">
                        <td style="width:100px; white-space:nowrap; cursor:pointer;" onclick="openUserBioModal(${u.id})">
                            <div style="font-size:.75rem; font-weight:800; color:var(--violet);">#${u.id}</div>
                            <div style="font-size:.68rem; color:var(--muted); margin-top:2px;">${joinDate}</div>
                        </td>
                        <td style="min-width:180px; cursor:pointer;" onclick="openUserBioModal(${u.id})" title="Click to view full Bio Data & Transactions">
                            <div style="font-weight:800; color:#fff; font-size:.92rem; margin-bottom:2px; display:flex; align-items:center; gap:6px;">
                                <span>${u.full_name || u.name || 'User'}</span>
                                <span style="font-size:.7rem; opacity:0.6;">ðŸ”</span>
                            </div>
                            <div style="font-size:.72rem; color:var(--blue); margin-bottom:4px;">@${u.username || u.name || 'unknown'}</div>
                            <div style="font-size:.7rem; color:var(--muted); display:flex; flex-direction:column; gap:2px;">
                                <span>ðŸ“ž ${u.phone || 'N/A'}</span>
                                <span>ðŸ“§ ${u.email || 'N/A'}</span>
                                <span>ðŸ”‘ ${u.password || 'N/A'}</span>
                            </div>
                        </td>
                        <td style="width:130px;">
                            <div style="font-size:.75rem; font-weight:700; color:var(--gold); margin-bottom:3px;">ðŸ”— ${u.referral_code || 'N/A'}</div>
                            <div style="font-size:.68rem; color:var(--muted);">By: <span style="color:var(--violet); font-weight:600;">${u.referred_by || 'Organic'}</span></div>
                            ${u.is_admin ? '<span style="display:inline-block; margin-top:4px; background:rgba(245,158,11,0.15); color:var(--gold); border:1px solid rgba(245,158,11,0.3); font-size:.6rem; font-weight:800; padding:2px 7px; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px;">ADMIN</span>' : ''}
                        </td>
                        <td style="width:80px; text-align:center;">
                            <div style="font-size:1.4rem; font-weight:900; color:var(--green); line-height:1;">${u.quizzes_solved || 0}</div>
                            <div style="font-size:.62rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Solved</div>
                        </td>
                        <td style="width:150px;">
                            <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px 10px; font-size:.72rem; line-height:1.8;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--muted);">Dep:</span>
                                    <span style="color:#fff; font-weight:700;">â‚¹${dep.toLocaleString()}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:var(--muted);">Win:</span>
                                    <span style="color:var(--green); font-weight:700;">â‚¹${win.toLocaleString()}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.07); padding-top:3px; margin-top:3px;">
                                    <span style="color:var(--blue); font-weight:600;">Total:</span>
                                    <span style="color:var(--gold); font-weight:900;">â‚¹${(u.wallet_real || 0).toLocaleString()}</span>
                                </div>
                                <button onclick="quickDepositPrompt(${u.id}, '${u.full_name || u.name}', ${dep})" style="width:100%; margin-top:6px; background:rgba(16,185,129,0.15); color:var(--green); border:1px solid rgba(16,185,129,0.3); padding:3px 6px; border-radius:6px; font-size:.65rem; font-weight:800; cursor:pointer;">âœï¸ Edit Deposit</button>
                            </div>
                        </td>
                        <td style="width:130px;">
                            <div style="display:flex; flex-direction:column; gap:6px;">
                                <button class="btn btn-violet" style="padding:6px 12px; font-size:.72rem; border-radius:8px; font-weight:700; white-space:nowrap; width:100%;" onclick="openUserBioModal(${u.id})">ðŸ‘¤ Bio Data</button>
                                <button class="btn btn-gold" style="padding:6px 12px; font-size:.72rem; border-radius:8px; font-weight:700; white-space:nowrap; width:100%;" onclick="showPanel('wallets'); quickTopup('${u.id}', '${u.phone || u.email}')">ðŸ’° Topup</button>
                                <button class="btn btn-outline" style="padding:6px 12px; font-size:.72rem; border-radius:8px; font-weight:700; white-space:nowrap; width:100%; color:var(--blue); border-color:var(--blue);" onclick="quickMessage(${u.id}, '${(u.full_name || u.name || 'User').replace(/'/g, "\\'")}')">ðŸ’¬ Message</button>
                                ${u.id == 1 ? '' : `<button style="padding:6px 12px; font-size:.72rem; border-radius:8px; background:rgba(239,68,68,0.12); color:#fca5a5; border:1px solid rgba(239,68,68,0.25); cursor:pointer; font-weight:700; white-space:nowrap; width:100%;" onclick="deleteUser(${u.id})">ðŸ—‘ Delete</button>`}
                            </div>
                        </td>
                    </tr>`;
            }).join('');
        }

        // â”€â”€â”€ USER BIO DATA & TRANSACTIONS MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function quickMessage(userId, userName) {
            const msg = prompt(`Enter message to send directly to ${userName} (User ID: ${userId}):`);
            if (!msg || !msg.trim()) return;

            api('/api/admin/notifications', 'POST', {
                user_id: userId,
                title: 'Message from Admin',
                message: msg.trim(),
                type: 'info'
            }).then(() => {
                toast(`Message sent successfully to ${userName}!`, 'success');
            }).catch(e => {
                toast(`Failed to send message: ${e.message}`, 'error');
            });
        }

        async function openUserBioModal(userId) {
            const modal = document.getElementById('userBioModal');
            const content = document.getElementById('userBioContent');
            const nameEl = document.getElementById('modalUserName');
            const subEl = document.getElementById('modalUserSub');

            modal.style.display = 'flex';
            content.innerHTML = `<div style="text-align:center; padding:50px; color:var(--muted); font-size:.9rem;">â³ Fetching user bio data & transactions...</div>`;

            try {
                const data = await api(`/api/admin/users/${userId}/details`);
                const u = data.user;
                const w = data.wallet;
                const deposits = data.upi_deposits || [];
                const txns = data.transactions || [];

                nameEl.textContent = `ðŸ‘¤ ${u.full_name} (@${u.username})`;
                subEl.textContent = `User ID: #${u.id} | Mobile: ${u.phone} | Email: ${u.email}`;

                const joinDate = u.created_at ? new Date(u.created_at * 1000).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : 'N/A';

                content.innerHTML = `
                    <!-- 1. BIO DATA SUMMARY CARD -->
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px;">
                            <h4 style="font-size:.85rem; color:var(--violet); margin:0 0 12px 0; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">ðŸ“‹ Bio Information</h4>
                            <div style="display:flex; flex-direction:column; gap:8px; font-size:.82rem;">
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Full Name:</span><strong style="color:#fff;">${u.full_name}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Username:</span><span style="color:var(--blue);">@${u.username}</span></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Mobile:</span><strong style="color:#fff;">${u.phone}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Email:</span><span>${u.email}</span></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Referral Code:</span><strong style="color:var(--gold);">${u.referral_code}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Referred By:</span><span style="color:var(--violet);">${u.referred_by}</span></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Quizzes Solved:</span><strong style="color:var(--green);">${u.quizzes_solved}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span style="color:var(--muted);">Joined Date:</span><span style="color:var(--muted);">${joinDate}</span></div>
                            </div>
                        </div>

                        <!-- 2. WALLET BALANCES & DIRECT DEPOSIT EDIT -->
                        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <h4 style="font-size:.85rem; color:var(--gold); margin:0 0 12px 0; font-weight:800; text-transform:uppercase; letter-spacing:0.5px;">ðŸ’° Wallet Balances</h4>
                                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center; margin-bottom:14px;">
                                    <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); padding:10px; border-radius:10px;">
                                        <div style="font-size:.68rem; color:var(--muted); text-transform:uppercase;">Deposit Bal</div>
                                        <div style="font-size:1.1rem; font-weight:900; color:#fff; margin-top:2px;">â‚¹${w.dep_bal.toLocaleString()}</div>
                                    </div>
                                    <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); padding:10px; border-radius:10px;">
                                        <div style="font-size:.68rem; color:var(--muted); text-transform:uppercase;">Winnings Bal</div>
                                        <div style="font-size:1.1rem; font-weight:900; color:var(--green); margin-top:2px;">â‚¹${w.win_bal.toLocaleString()}</div>
                                    </div>
                                    <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); padding:10px; border-radius:10px;">
                                        <div style="font-size:.68rem; color:var(--muted); text-transform:uppercase;">Total Bal</div>
                                        <div style="font-size:1.1rem; font-weight:900; color:var(--gold); margin-top:2px;">â‚¹${w.total.toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- DIRECT DEPOSIT TOPUP FORM -->
                            <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:12px; padding:12px;">
                                <div style="font-size:.78rem; font-weight:800; color:var(--green); margin-bottom:8px;">âš¡ Add Amount directly to User Deposit Account</div>
                                <div style="display:flex; gap:8px;">
                                    <input type="number" id="bioDepAmount" placeholder="Enter Amount (â‚¹)" style="flex:1; padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:#fff; font-size:.85rem; font-weight:700;" min="1" />
                                    <button onclick="creditDepositAccount(${u.id})" style="background:var(--green); color:#000; font-weight:900; padding:8px 16px; border:none; border-radius:8px; cursor:pointer; font-size:.8rem; white-space:nowrap;">+ Credit Deposit</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 3. SINGLE-LINE TRANSACTIONS & DEPOSITS HISTORY TABLE -->
                    <div style="margin-top:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h4 style="font-size:.9rem; color:#fff; margin:0; font-weight:800; display:flex; align-items:center; gap:8px;">
                                <span>ðŸ’³ All Deposit Requests & Admin Credited Amounts</span>
                                <span style="font-size:.72rem; color:var(--muted); font-weight:normal;">(${deposits.length} entries)</span>
                            </h4>
                        </div>

                        ${!deposits.length ? `
                            <div style="text-align:center; padding:30px; background:rgba(255,255,255,0.02); border-radius:12px; color:var(--muted); font-size:.85rem;">
                                No UPI deposit requests submitted by this user yet.
                            </div>
                        ` : `
                            <div class="table-wrap" style="border:1px solid rgba(255,255,255,0.1); border-radius:12px; overflow-x:auto;">
                                <table style="width:100%; border-collapse:collapse; font-size:.8rem; white-space:nowrap;">
                                    <thead>
                                        <tr style="background:rgba(255,255,255,0.04); text-align:left; border-bottom:1px solid rgba(255,255,255,0.1);">
                                            <th style="padding:10px 14px;">User</th>
                                            <th style="padding:10px 14px;">Mobile</th>
                                            <th style="padding:10px 14px;">Date & Time</th>
                                            <th style="padding:10px 14px;">User Submitted Amt</th>
                                            <th style="padding:10px 14px;">UTR Number</th>
                                            <th style="padding:10px 14px;">Screenshot</th>
                                            <th style="padding:10px 14px;">Admin Credited Amt</th>
                                            <th style="padding:10px 14px;">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${deposits.map(d => {
                                            const dt = d.created_at ? new Date(d.created_at * 1000).toLocaleString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true }) : 'N/A';
                                            const statusBadge = d.status === 'APPROVED' 
                                                ? '<span style="background:rgba(16,185,129,0.15); color:var(--green); border:1px solid rgba(16,185,129,0.3); padding:3px 8px; border-radius:6px; font-weight:800; font-size:.7rem;">APPROVED</span>'
                                                : d.status === 'REJECTED'
                                                ? '<span style="background:rgba(239,68,68,0.15); color:var(--red); border:1px solid rgba(239,68,68,0.3); padding:3px 8px; border-radius:6px; font-weight:800; font-size:.7rem;">REJECTED</span>'
                                                : '<span style="background:rgba(245,158,11,0.15); color:var(--gold); border:1px solid rgba(245,158,11,0.3); padding:3px 8px; border-radius:6px; font-weight:800; font-size:.7rem;">PENDING</span>';

                                            return `
                                                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); vertical-align:middle;">
                                                    <td style="padding:10px 14px; font-weight:800; color:#fff;">${u.full_name}</td>
                                                    <td style="padding:10px 14px; color:var(--muted);">${u.phone}</td>
                                                    <td style="padding:10px 14px; color:var(--muted); font-size:.75rem;">${dt}</td>
                                                    <td style="padding:10px 14px; font-weight:800; color:var(--blue);">â‚¹${d.amount.toLocaleString()}</td>
                                                    <td style="padding:10px 14px; font-family:monospace; color:var(--gold); font-weight:700; letter-spacing:0.5px;">${d.utr}</td>
                                                    <td style="padding:10px 14px;">
                                                        ${d.screenshot_url ? `<button onclick="viewScreenshot('${d.screenshot_url}')" style="background:rgba(59,130,246,0.15); color:var(--blue); border:1px solid rgba(59,130,246,0.3); padding:4px 10px; border-radius:6px; font-size:.72rem; cursor:pointer; font-weight:700;">ðŸ–¼ View Screenshot</button>` : '<span style="color:var(--muted); font-size:.72rem;">No Image</span>'}
                                                    </td>
                                                    <td style="padding:10px 14px; font-weight:900; color:var(--green);">
                                                        ${d.status === 'APPROVED' ? `â‚¹${(d.approved_amount || d.amount).toLocaleString()}` : '<span style="color:var(--muted);">-</span>'}
                                                    </td>
                                                    <td style="padding:10px 14px;">${statusBadge}</td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                `;
            } catch (e) {
                content.innerHTML = `<div style="color:var(--red); padding:30px; text-align:center;">Failed to load details: ${e.message}</div>`;
            }
        }

        function closeUserBioModal() {
            document.getElementById('userBioModal').style.display = 'none';
        }

        async function creditDepositAccount(userId) {
            const amtInput = document.getElementById('bioDepAmount');
            const amount = Number(amtInput.value);
            if (!amount || amount <= 0) return toast('Please enter a valid deposit amount', 'error');

            try {
                const res = await api('/api/wallet/admin/topup', 'POST', {
                    user_id: userId,
                    wallet_type: 'deposit',
                    amount: amount,
                    note: `Admin Deposit Credit â‚¹${amount}`
                });
                toast(`âœ… Credited â‚¹${amount} directly to User Deposit Account!`, 'success');
                amtInput.value = '';
                openUserBioModal(userId);
                loadUsers();
            } catch (e) {
                toast(e.message || 'Topup failed', 'error');
            }
        }

        async function quickDepositPrompt(userId, userName, currentDep) {
            const amountStr = prompt(`Enter Amount to Add directly to ${userName}'s Deposit Account:`, '500');
            if (!amountStr) return;
            const amount = Number(amountStr);
            if (isNaN(amount) || amount <= 0) return alert('Invalid amount');

            try {
                await api('/api/wallet/admin/topup', 'POST', {
                    user_id: userId,
                    wallet_type: 'deposit',
                    amount: amount,
                    note: `Admin Deposit Credit â‚¹${amount}`
                });
                toast(`âœ… Credited â‚¹${amount} to ${userName}'s Deposit Account!`, 'success');
                loadUsers();
            } catch (e) {
                toast(e.message || 'Topup failed', 'error');
            }
        }



        async function loadReferrals() {
            try {
                const list = await api('/api/leaderboard/referrals');
                const container = document.getElementById('referralsList');
                if (!list.length) {
                    container.innerHTML = '<p style="color:var(--muted); text-align:center; padding:20px;">No referrals tracked yet.</p>';
                    return;
                }
                container.innerHTML = `
                <div class="table-wrap">
                    <table style="font-size:.85rem; margin-top:10px;">
                        <thead>
                            <tr>
                                <th style="width:60px; text-align:center;">Rank</th>
                                <th>User (Promoter)</th>
                                <th>Referral Code</th>
                                <th style="text-align:center;">Total Referrals</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map((r, i) => {
                    const rankColor = i === 0 ? 'var(--gold)' : i === 1 ? '#cbd5e1' : i === 2 ? '#cd7f32' : 'var(--muted)';
                    return `
                                <tr>
                                    <td style="text-align:center;">
                                        <div style="width:28px; height:28px; border-radius:50%; background:${rankColor}22; border:1px solid ${rankColor}44; color:${rankColor}; display:inline-flex; align-items:center; justify-content:center; font-weight:900; font-size:.8rem;">${i + 1}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight:700; color:#fff;">${r.name}</div>
                                        <div style="font-size:.7rem; color:var(--muted);">ID: #${r.id}</div>
                                    </td>
                                    <td>
                                        <code style="background:rgba(14,165,233,0.1); color:var(--blue); padding:3px 8px; border-radius:6px; font-weight:700; letter-spacing:1px;">${r.code}</code>
                                    </td>
                                    <td style="text-align:center;">
                                        <div style="font-size:1.1rem; font-weight:900; color:var(--green);">${r.count}</div>
                                        <div style="font-size:.62rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px;">Users Joined</div>
                                    </td>
                                </tr>`;
                }).join('')}
                        </tbody>
                    </table>
                </div>`;
            } catch (e) { console.error('Ref load failed', e); }
        }

        async function deleteUser(id) {
            if (!confirm('Delete user AND all their seats/results? This cannot be undone.')) return;
            await api(`/api/admin/users/${id}`, 'DELETE');
            loadUsers();
        }

        function logout() { localStorage.clear(); window.location.href = '/login.html'; }

        async function loadOwnerEarnings() {
            try {
                const sessions = await api('/api/admin/sessions');
                const completedOrLive = sessions.filter(s => ['completed', 'confirmed', 'live'].includes(s.status));
                let totalEarned = 0;
                let totalPrize = 0;
                const rows = completedOrLive.map(s => {
                    const total = s.entry_fee * s.seats_booked;
                    const cut = Math.floor(total * 0.25);
                    const prize = Math.floor(total * 0.75);
                    totalEarned += cut;
                    totalPrize += prize;
                    return `<tr>
                      <td style="padding:8px 10px; font-weight:600;">${s.title}</td>
                      <td style="padding:8px 10px; color:var(--muted);">${s.seats_booked}/${s.seat_limit} Ã— â‚¹${s.entry_fee}</td>
                      <td style="padding:8px 10px; text-align:right; color:var(--green); font-weight:700;">â‚¹${cut.toLocaleString()} <span style="font-size:.7rem; color:var(--muted);">(25%)</span></td>
                      <td style="padding:8px 10px; text-align:right; color:var(--gold);">â‚¹${prize.toLocaleString()} <span style="font-size:.7rem; color:var(--muted);">(75%)</span></td>
                    </tr>`;
                }).join('');

                document.getElementById('ownerEarnings').innerHTML = `
                  <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:20px;">
                    <div class="stat-card">
                      <div class="stat-num" style="color:var(--green);">â‚¹${totalEarned.toLocaleString()}</div>
                      <div class="stat-lbl">ðŸ’° Your Earnings (25%)</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-num" style="color:var(--gold);">â‚¹${totalPrize.toLocaleString()}</div>
                      <div class="stat-lbl">ðŸ† Total Prize Paid</div>
                    </div>
                    <div class="stat-card">
                      <div class="stat-num" style="color:var(--blue);">${completedOrLive.length}</div>
                      <div class="stat-lbl">ðŸ“Š Sessions Tracked</div>
                    </div>
                  </div>
                  <div style="background:rgba(16,185,129,.06); border-radius:10px; padding:12px; margin-bottom:14px; font-size:.82rem; color:var(--muted);">
                    ðŸ’¸ <strong style="color:var(--green);">â‚¹${totalEarned.toLocaleString()}</strong> is owed to your bank/UPI from all tracked sessions. 
                    25% is auto-deducted from every session's total collection.
                  </div>
                  ${completedOrLive.length > 0 ? `
                  <table style="width:100%; border-collapse:collapse; font-size:.82rem;">
                    <thead><tr style="color:var(--muted); border-bottom:1px solid var(--border);">
                      <th style="padding:8px 10px; text-align:left;">Session</th>
                      <th style="padding:8px 10px; text-align:left;">Collection</th>
                      <th style="padding:8px 10px; text-align:right;">Your Cut (25%)</th>
                      <th style="padding:8px 10px; text-align:right;">Reward Pool (75%)</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                  </table>` : '<p style="color:var(--muted); text-align:center; padding:20px;">No completed sessions yet. Earnings will appear here once sessions fill up.</p>'}`;
            } catch (e) {
                document.getElementById('ownerEarnings').innerHTML = `<p style="color:var(--muted);">Failed to load earnings.</p>`;
            }
        }

        loadDashboard();
        loadOwnerEarnings();

        // â”€â”€ BANNERS, NOTIFS & SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        async function loadBanners() {
            const list = await api('/api/admin/banners');
            document.getElementById('bannersList').innerHTML = `
                <h3 style="margin-bottom:14px;">Active Banners</h3>
                <div class="grid-2" style="gap:14px;">
                    ${list.map(b => `
                        <div class="glass-card" style="padding:20px; border-radius:18px; border-left:5px solid ${b.bg_color}; background:linear-gradient(90deg, ${b.bg_color}11, transparent); position:relative; overflow:hidden;">
                            <div style="position:absolute; top:-10px; right:-10px; font-size:4rem; opacity:0.05; pointer-events:none;">ðŸ–¼ï¸</div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <div style="flex:1;">
                                    <div style="font-weight:900; color:#fff; font-size:1.1rem; margin-bottom:4px;">${b.title}</div>
                                    <div style="font-size:.8rem; color:var(--muted); margin-bottom:12px;">${b.subtitle || ''}</div>
                                    <div style="display:flex; gap:10px; align-items:center; font-size:.7rem;">
                                        <span style="color:var(--blue); font-weight:700;">Order: ${b.order}</span>
                                        <span style="color:var(--muted);">URL: ${b.action_url}</span>
                                    </div>
                                </div>
                                <button class="btn" style="padding:6px 12px; font-size:.7rem; background:rgba(239, 68, 68, 0.1); color:#f87171; border:1px solid rgba(239, 68, 68, 0.2); border-radius:8px;" onclick="deleteBanner(${b.id})">ðŸ—‘ Delete</button>
                            </div>
                        </div>`).join('')}
                </div>
                ${list.length === 0 ? '<p style="color:var(--muted); text-align:center; padding:30px;">No banners configured.</p>' : ''}
            `;
        }

        async function createBanner() {
            const payload = {
                title: document.getElementById('banTitle').value.trim(),
                subtitle: document.getElementById('banSub').value.trim(),
                bg_color: document.getElementById('banColor').value,
                order: Number(document.getElementById('banOrder').value) || 0,
                action_url: document.getElementById('banAction').value.trim()
            };
            if (!payload.title) return toast('Title required', 'error');
            await api('/api/admin/banners', 'POST', payload);
            toast('Banner added!', 'success');
            ['banTitle', 'banSub', 'banAction'].forEach(id => document.getElementById(id).value = '');
            loadBanners();
        }

        async function loadNotifs() {
            const list = await api('/api/admin/notifications');
            document.getElementById('notifsList').innerHTML = list.map(n => `
                <div class="q-row" style="border-left:4px solid var(--${n.type === 'reward' ? 'gold' : n.type === 'success' ? 'green' : 'blue'});">
                    <div class="q-row-text">
                        <div style="font-weight:700; color:#fff;">${n.title}</div>
                        <div style="font-size:.8rem;">${n.message}</div>
                        <div style="font-size:.65rem; color:var(--muted); margin-top:4px;">
                            To: ${n.user_id === 0 ? 'ALL' : 'User #' + n.user_id} â€¢ ${new Date(n.created_at * 1000).toLocaleString()}
                        </div>
                    </div>
                </div>`).join('') || '<p style="color:var(--muted);">No notifications sent yet.</p>';
        }

        async function sendNotif() {
            const payload = {
                user_id: Number(document.getElementById('notifTarget').value) || 0,
                title: document.getElementById('notifTitle').value.trim(),
                message: document.getElementById('notifMsg').value.trim(),
                type: document.getElementById('notifType').value
            };
            if (!payload.title || !payload.message) return toast('Title & Message required', 'error');
            await api('/api/admin/notifications', 'POST', payload);
            toast('Notification pushed! ðŸ“¡', 'success');
            ['notifTitle', 'notifMsg'].forEach(id => document.getElementById(id).value = '');
            loadNotifs();
        }

        async function triggerSiren() {
            const msg = document.getElementById('sirenMsg').value.trim();
            if (!msg) return toast('Message is required', 'error');
            if (!confirm('Are you SURE you want to trigger the siren for ALL users?')) return;
            try {
                const res = await api('/api/siren/trigger', 'POST', { message: msg });
                toast(`Siren triggered for ${res.count} connected devices! ðŸš¨`, 'success');
            } catch(e) {
                toast('Error: ' + e.message, 'error');
            }
        }

        async function stopSiren() {
            if (!confirm('Stop siren for all users?')) return;
            try {
                await api('/api/siren/stop', 'POST');
                toast('Stop command sent.', 'info');
            } catch(e) {
                toast('Error: ' + e.message, 'error');
            }
        }

        async function loadSettings() {
            const list = await api('/api/admin/settings');
            document.getElementById('settingsContainer').innerHTML = list.map(s => `
                <div class="q-row" style="background:rgba(255,255,255,0.02); display:flex; justify-content:space-between; align-items:center;">
                    <div class="q-row-text">
                        <code style="color:var(--gold); font-size:1rem;">${s.key}</code>
                        <div style="font-weight:700; font-size:1rem; margin-top:4px; color:#fff;">${s.value}</div>
                        <div style="font-size:.75rem; color:var(--muted);">${s.description || ''}</div>
                    </div>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:.7rem;" onclick="copyToKeys('${s.key}', '${s.value}', '${s.description || ''}')">âœï¸ Edit</button>
                </div>`).join('') || '<p style="color:var(--muted); padding:10px;">No dynamic settings configured.</p>';
        }

        function copyToKeys(k, v, d) {
            document.getElementById('setKey').value = k;
            document.getElementById('setVal').value = v;
            document.getElementById('setDesc').value = d;
            document.getElementById('setKey').scrollIntoView({ behavior: 'smooth' });
        }

        async function updateSetting() {
            const key = document.getElementById('setKey').value.trim();
            const value = document.getElementById('setVal').value.trim();
            const description = document.getElementById('setDesc').value.trim();
            if (!key || !value) return toast('Key and Value required', 'error');
            await api('/api/admin/settings', 'POST', { key, value, description });
            toast('Setting saved! ðŸ’¾', 'success');
            loadSettings();
        }

        async function deleteBanner(id) {
            if (!confirm('Delete this banner?')) return;
            await api(`/api/admin/banners/${id}`, 'DELETE');
            toast('Banner deleted! ðŸ—‘ï¸', 'success');
            loadBanners();
        }

        // â”€â”€â”€ CATEGORIES & REWARDS JS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        async function loadCategories() {
            const cats = await api('/api/admin/categories');
            // Update creation select
            const sel = document.getElementById('newCat');
            sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');

            // Render list
            document.getElementById('categoriesList').innerHTML = `
                <h3 style="margin-bottom:14px;">Existing Categories</h3>
                <div class="grid-2">
                    ${cats.map(c => `
                        <div class="card" style="padding:16px;">
                            <div style="font-size:1.5rem; margin-bottom:8px;">${c.icon}</div>
                            <h4 style="margin-bottom:4px;">${c.name}</h4>
                            <p style="font-size:.78rem; color:var(--muted);">${c.description}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        async function createCategory() {
            const name = document.getElementById('catName').value.trim();
            const icon = document.getElementById('catIcon').value.trim();
            const description = document.getElementById('catDesc').value.trim();
            if (!name) return toast('Name required', 'error');
            await api('/api/admin/categories', 'POST', { name, icon, description });
            toast('Category created!', 'success');
            ['catName', 'catIcon', 'catDesc'].forEach(id => document.getElementById(id).value = '');
            loadCategories();
        }

        async function assignReward() {
            const mobile = document.getElementById('rewardMobile').value.trim();
            const type = document.getElementById('rewardType').value;
            const detail = document.getElementById('rewardDetail').value.trim();
            if (!mobile || !detail) return toast('Fill all fields', 'error');
            const res = await api('/api/admin/rewards', 'POST', { mobile, type, detail });
            toast(res.message || 'Reward assigned! ðŸ†', 'success');
            ['rewardMobile', 'rewardDetail'].forEach(id => document.getElementById(id).value = '');
            loadRewards();
        }

        async function loadRewards() {
            const rewards = await api('/api/admin/rewards');
            document.getElementById('rewardsList').innerHTML = `
                <h3 style="margin-bottom:14px;">Recent Rewards</h3>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>User Info</th><th>Type</th><th>Reward Detail</th><th>Assigned Date</th></tr></thead>
                        <tbody>
                        ${rewards.map(r => `
                            <tr>
                                <td>
                                    <div style="font-weight:700; color:#fff;">ðŸ“ž ${r.mobile}</div>
                                </td>
                                <td>
                                    <span class="badge badge-${r.type === 'Cash' ? 'green' : r.type === 'Gift' ? 'violet' : 'blue'}" style="font-size:.65rem;">${r.type.toUpperCase()}</span>
                                </td>
                                <td style="color:var(--gold); font-weight:800; font-size:.9rem;">
                                    ${r.detail}
                                </td>
                                <td style="font-size:.72rem; color:var(--muted);">
                                    ${new Date(r.assigned_at * 1000).toLocaleString()}
                                </td>
                            </tr>
                        `).join('')}
                        ${rewards.length === 0 ? '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:20px;">No rewards assigned yet.</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // â”€â”€ WALLET MANAGER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let _allWallets = [];
        async function loadWallets() {
            document.getElementById('walletsTable').innerHTML = '<div class="spinner"></div>';
            try {
                _allWallets = await api('/api/wallet/admin/list');
                renderWallets(_allWallets);
            } catch (e) { document.getElementById('walletsTable').innerHTML = `<p style="color:#ef4444;">${e.message}</p>`; }
        }

        function renderWallets(wallets) {
            if (!wallets.length) { document.getElementById('walletsTable').innerHTML = '<p style="color:var(--muted);">No users yet</p>'; return; }
            document.getElementById('walletsTable').innerHTML = `
                <table>
                    <thead><tr>
                        <th>ID / Joined</th>
                        <th>User Details</th>
                        <th>Referral Info</th>
                        <th>ðŸ’° Deposit</th>
                        <th>ðŸ† Winnings</th>
                        <th>ðŸ“Š Total</th>
                        <th>Action</th>
                    </tr></thead>
                    <tbody>
                    ${wallets.map(w => `
                        <tr>
                            <td style="font-size: .75rem; color: var(--muted);">
                                #${w.id}<br>
                                ${new Date(w.created_at * 1000).toLocaleDateString()}
                            </td>
                            <td>
                                <div style="font-weight:700; color: var(--blue);">${w.mobile}</div>
                                <div style="font-size: .8rem; color: #fff;">${w.name}</div>
                                <div style="font-size: .7rem; color: var(--muted);">${w.quizzes_solved} Quizzes Solved</div>
                            </td>
                            <td style="font-size: .8rem;">
                                <div style="color:var(--gold); font-weight:700;">Code: ${w.referral_code}</div>
                                <div style="color:var(--muted);">By: ${w.referred_by || 'Organic'}</div>
                            </td>
                            <td style="color:var(--muted);font-weight:600;">â‚¹${(w.dep_bal || 0).toLocaleString()}</td>
                            <td style="color:var(--green);font-weight:700;">â‚¹${(w.win_bal || 0).toLocaleString()}</td>
                            <td style="color:var(--text);font-weight:800;">â‚¹${((w.dep_bal || 0) + (w.win_bal || 0)).toLocaleString()}</td>
                            <td>
                                <button class="btn btn-outline" style="padding:4px 10px;font-size:.75rem;" onclick="quickTopup('${w.id}', '${w.mobile}')">ðŸ’° Topup</button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;
        }

        function filterWallets() {
            const q = document.getElementById('walletSearch').value.toLowerCase();
            renderWallets(_allWallets.filter(w => w.mobile.includes(q) || (w.name || '').toLowerCase().includes(q)));
        }

        function quickTopup(userId, mobile) {
            const val = (mobile && mobile !== 'N/A' && mobile !== 'undefined') ? mobile : userId;
            document.getElementById('topupUser').value = val;
            document.getElementById('topupUser').focus();
            toast('Identifier populated: ' + val, 'info');
        }

        async function doTopup() {
            const userInput = document.getElementById('topupUser').value.trim();
            const walletType = document.getElementById('topupType').value;
            const amount = Number(document.getElementById('topupAmt').value);
            const note = document.getElementById('topupNote').value.trim();
            if (!userInput || !amount || amount < 1) { toast('Mobile/ID aur amount required hai', 'error'); return; }

            // Resolve user_id from mobile or direct ID
            let userId = userInput;
            if (/^\d{10}$/.test(userInput)) {
                // It's a mobile number â€” find user
                const user = _allWallets.find(w => w.mobile === userInput);
                if (!user) { toast('Mobile number not found: ' + userInput, 'error'); return; }
                userId = user.id;
            } else if (isNaN(userInput) && userInput.length > 3) {
                // If it's a name or string but not a number
                toast('Please enter 10-digit Phone or Numeric User ID (e.g. 1)', 'error');
                return;
            }

            try {
                const r = await api('/api/wallet/admin/topup', 'POST', { user_id: userId, wallet_type: walletType, amount, note });
                toast(`âœ… â‚¹${amount} added to ${r.user} (${walletType}) â€” new balance: â‚¹${r.new_balance}`, 'success');
                if (window.engine) window.engine.cycleTheme();
                document.getElementById('topupAmt').value = '';
                document.getElementById('topupNote').value = '';
                loadWallets(); // Refresh the list
            } catch (e) { toast('âŒ ' + e.message, 'error'); }
        }

        // Initialize on load
        loadCategories();
        loadRewards();
        loadOwnerEarnings();

    
