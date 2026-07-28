
        // â”€â”€ MOBILE SIDEBAR CONTROLS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function toggleSidebar() {
            const sidebar = document.querySelector('.sidebar-nav');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('mob-open');
            overlay.classList.toggle('open');
            document.getElementById('hamburgerBtn').textContent = sidebar.classList.contains('mob-open') ? 'âœ•' : 'â˜°';
        }

        function closeSidebar() {
            const sidebar = document.querySelector('.sidebar-nav');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.remove('mob-open');
            overlay.classList.remove('open');
            document.getElementById('hamburgerBtn').textContent = 'â˜°';
        }

        // Close sidebar when a nav item is clicked on mobile
        document.querySelectorAll('.sidebar-nav a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) closeSidebar();
            });
        });

        // â”€â”€ MOBILE BOTTOM NAV ACTIVE STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function setMobActive(panel) {
            document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active'));
            const el = document.getElementById('mbn-' + panel);
            if (el) el.classList.add('active');
        }

        // Wrap existing showPanel to also update mobile bottom nav
        const _origShowPanel = typeof showPanel === 'function' ? showPanel : null;
        if (_origShowPanel) {
            showPanel = function (panel, el) {
                _origShowPanel(panel, el);
                setMobActive(panel);
                if (window.innerWidth <= 768) closeSidebar();
                if (panel === 'books') loadAdminBooks();
            };
        }

        // â”€â”€ BOOKS LIBRARY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        async function createBook() {
            const title = document.getElementById('bookTitle').value.trim();
            const subject = document.getElementById('bookSubject').value.trim();
            if (!title || !subject) { alert('Title and Subject are required!'); return; }

            try {
                const result = await api('/api/books', 'POST', {
                    title,
                    subject,
                    description: document.getElementById('bookDesc').value.trim(),
                    cover_emoji: document.getElementById('bookEmoji').value.trim() || 'ðŸ“š',
                    cover_color: document.getElementById('bookColor').value,
                    base_price: Number(document.getElementById('bookBasePrice').value) || 0,
                    offer_price: Number(document.getElementById('bookOfferPrice').value) || 0,
                    offer_label: document.getElementById('bookOfferLabel').value.trim()
                });
                toast('âœ… Book created: ' + result.book.title, 'success');
                // Clear form
                ['bookTitle', 'bookSubject', 'bookDesc', 'bookEmoji', 'bookOfferLabel'].forEach(id => document.getElementById(id).value = '');
                document.getElementById('bookEmoji').value = 'ðŸ“š';
                document.getElementById('bookBasePrice').value = '0';
                document.getElementById('bookOfferPrice').value = '0';
                loadAdminBooks();
            } catch (e) {
                toast('âŒ ' + e.message, 'error');
            }
        }

        async function loadAdminBooks() {
            const container = document.getElementById('booksList');
            container.innerHTML = '<div class="spinner"></div>';
            try {
                const books = await api('/api/books/admin/all');
                if (!books.length) {
                    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:30px 0;">No books yet. Create one above!</p>';
                    return;
                }
                container.innerHTML = books.map(b => {
                    const price = b.offer_price > 0 ? b.offer_price : b.base_price;
                    const isFree = price === 0;
                    return `
                    <div class="glass-card deep-glass" style="margin-bottom:14px;padding:18px;border-radius:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                        <div style="width:52px;height:52px;border-radius:14px;background:${b.cover_color || '#7c3aed'}33;border:1px solid ${b.cover_color || '#7c3aed'}44;display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;">${b.cover_emoji || 'ðŸ“š'}</div>
                        <div style="flex:1;min-width:150px;">
                            <div style="font-weight:800;color:#fff;font-size:.95rem;">${b.title}</div>
                            <div style="font-size:.72rem;color:var(--muted);margin-top:2px;">${b.subject} Â· ${b.q_count} Questions Â· ${b.purchases} Purchases</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                            <span style="font-size:.88rem;font-weight:800;color:var(--gold);">${isFree ? 'FREE' : 'â‚¹' + price}</span>
                            ${b.offer_price > 0 ? `<span style="font-size:.68rem;background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.25);padding:2px 8px;border-radius:99px;">${b.offer_label || 'OFFER'}</span>` : ''}
                        </div>
                        <div style="display:flex;gap:8px;flex-shrink:0;">
                            <button class="btn btn-outline" style="padding:7px 14px;font-size:.75rem;border-radius:10px;color:var(--gold);border-color:rgba(201,168,76,0.3);" onclick="openEditBook('${encodeURIComponent(JSON.stringify({ id: b.id, title: b.title, subject: b.subject, description: b.description, base_price: b.base_price, offer_price: b.offer_price, offer_label: b.offer_label, status: b.status }))}')">âœï¸ Edit</button>
                            <label style="cursor:pointer;">
                                <input type="file" accept=".xlsx,.xls" style="display:none;" onchange="uploadBookQuestions(${b.id}, this)">
                                <span class="btn btn-outline" style="padding:7px 14px;font-size:.75rem;border-radius:10px;cursor:pointer;">ðŸ“¤ Upload</span>
                            </label>
                            <button class="btn" style="padding:7px 14px;font-size:.75rem;border-radius:10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#fca5a5;" onclick="deleteBook(${b.id}, '${b.title.replace(/'/g, "\\'")}')">ðŸ—‘</button>
                        </div>
                    </div>`;
                }).join('');
            } catch (e) {
                container.innerHTML = `<p style="color:#ef4444;">${e.message}</p>`;
            }
        }

        async function uploadBookQuestions(bookId, input) {
            const file = input.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            toast('ðŸ“¤ Uploading questions to book...', 'info');
            try {
                const res = await fetch(`/api/books/${bookId}/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + getToken() },
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                toast('âœ… ' + data.message, 'success');
                loadAdminBooks();
            } catch (e) {
                toast('âŒ Upload failed: ' + e.message, 'error');
            }
            input.value = '';
        }

        async function deleteBook(bookId, title) {
            if (!confirm(`Delete "${title}" and all its questions? This cannot be undone.`)) return;
            try {
                await api(`/api/books/${bookId}`, 'DELETE');
                toast('ðŸ—‘ï¸ Book deleted', 'success');
                loadAdminBooks();
            } catch (e) {
                toast('âŒ ' + e.message, 'error');
            }
        }

        // â”€â”€ EDIT BOOK MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function openEditBook(book) {
            const b = typeof book === 'string' ? JSON.parse(decodeURIComponent(book)) : book;
            document.getElementById('editBookId').value = b.id;
            document.getElementById('editBookTitle').value = b.title;
            document.getElementById('editBookSubject').value = b.subject;
            document.getElementById('editBookDesc').value = b.description || '';
            document.getElementById('editBookBasePrice').value = b.base_price || 0;
            document.getElementById('editBookOfferPrice').value = b.offer_price || 0;
            document.getElementById('editBookOfferLabel').value = b.offer_label || '';
            document.getElementById('editBookStatus').value = b.status || 'active';
            document.getElementById('editBookModal').style.display = 'flex';
        }
        function closeEditBook() { document.getElementById('editBookModal').style.display = 'none'; }
        async function saveEditBook() {
            const id = document.getElementById('editBookId').value;
            const body = {
                title: document.getElementById('editBookTitle').value.trim(),
                subject: document.getElementById('editBookSubject').value.trim(),
                description: document.getElementById('editBookDesc').value.trim(),
                base_price: Number(document.getElementById('editBookBasePrice').value),
                offer_price: Number(document.getElementById('editBookOfferPrice').value),
                offer_label: document.getElementById('editBookOfferLabel').value.trim(),
                status: document.getElementById('editBookStatus').value
            };
            try {
                await api(`/api/books/${id}`, 'PUT', body);
                toast('âœ… Book updated!', 'success');
                closeEditBook();
                loadAdminBooks();
            } catch (e) { toast('âŒ ' + e.message, 'error'); }
        }
    
