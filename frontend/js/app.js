/**
 * CampusFlow - Single Clean Client JavaScript (app.js)
 * Vanilla JS, 100% Offline, Zero Frameworks
 */

// Helper to resolve API path based on page folder depth
function getApiUrl(endpoint) {
    const isSub = window.location.pathname.includes('/student/') || 
                  window.location.pathname.includes('/staff/') || 
                  window.location.pathname.includes('/admin/');
    return (isSub ? '../../../backend/api/' : '../../backend/api/') + endpoint;
}

// 1. AUTHENTICATION
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const alertBox = document.getElementById('alert');

    fetch(getApiUrl('auth.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            if (data.role === 'admin') window.location.href = 'admin/dashboard.html';
            else if (data.role === 'staff') window.location.href = 'staff/dashboard.html';
            else window.location.href = 'student/dashboard.html';
        } else {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = data.error || 'Invalid email or password';
        }
    })
    .catch(() => {
        alertBox.style.display = 'block';
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = 'Server connection failed';
    });
}

function logout() {
    fetch(getApiUrl('auth.php?action=logout')).then(() => {
        const isSub = window.location.pathname.includes('/student/') || 
                      window.location.pathname.includes('/staff/') || 
                      window.location.pathname.includes('/admin/');
        window.location.href = isSub ? '../login.html' : 'login.html';
    });
}

function checkUser(role) {
    fetch(getApiUrl('auth.php?action=check'))
        .then(r => r.json())
        .then(d => {
            if (!d.success || !d.user) {
                const isSub = window.location.pathname.includes('/student/') || 
                              window.location.pathname.includes('/staff/') || 
                              window.location.pathname.includes('/admin/');
                window.location.href = isSub ? '../login.html' : 'login.html';
                return;
            }
            const nameEl = document.getElementById('userName');
            if (nameEl) nameEl.textContent = d.user.name;
        });
}

// 2. STUDENT WORKFLOW
function loadStudentDashboard() {
    checkUser('student');

    // Fetch active tokens
    fetch(getApiUrl('tokens.php?action=my_token'))
        .then(r => r.json())
        .then(data => {
            const tokenBox = document.getElementById('activeTokenBox');
            if (!tokenBox) return;

            // Only display tokens that are currently active (waiting, called, processing)
            const activeList = (data.active_tokens && data.active_tokens.length > 0)
                ? data.active_tokens
                : (data.token && ['waiting', 'called', 'processing'].includes(data.token.status) ? [data.token] : []);

            if (activeList.length > 0) {
                tokenBox.innerHTML = activeList.map(t => `
                    <div class="card" style="border-left: 4px solid #2563eb; margin-bottom:12px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span class="badge badge-${t.status}">${t.status.toUpperCase()}</span>
                            <span style="font-size:12px; color:#64748b;">Live Token</span>
                        </div>
                        <div style="font-size:32px; font-weight:800; color:#2563eb;">${t.token_code}</div>
                        <div style="font-size:15px; font-weight:600; margin-bottom:12px;">${t.service_name}</div>
                        ${t.status === 'waiting' ? `
                            <div style="display:flex; gap:20px; background:#f8fafc; padding:10px 14px; border-radius:6px; margin-bottom:14px;">
                                <div>
                                    <span style="font-size:11px; color:#64748b;">PEOPLE AHEAD</span>
                                    <div style="font-size:18px; font-weight:700;">${t.people_ahead !== undefined ? t.people_ahead : (data.people_ahead || 0)}</div>
                                </div>
                                <div>
                                    <span style="font-size:11px; color:#64748b;">ESTIMATED WAIT</span>
                                    <div style="font-size:18px; font-weight:700;">${t.estimated_wait !== undefined ? t.estimated_wait : (data.estimated_wait || 0)} min</div>
                                </div>
                            </div>
                        ` : ''}
                        <a href="token.html?id=${t.id}" class="btn btn-primary btn-sm">View My Token &rarr;</a>
                    </div>
                `).join('');
            } else {
                tokenBox.innerHTML = `
                    <div class="card" style="color:#64748b;">
                        No active token. Choose an available department below to get a token.
                    </div>
                `;
            }
        });

    // Fetch active services
    fetch(getApiUrl('services.php'))
        .then(r => r.json())
        .then(data => {
            const list = document.getElementById('servicesList');
            if (!list) return;

            if (data.success && data.services) {
                list.innerHTML = data.services.map(s => `
                    <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <strong style="color:#2563eb;">${s.prefix}</strong>
                                <span class="badge badge-waiting">Queue: ${s.waiting_count}</span>
                            </div>
                            <h3 style="font-size:16px; margin-bottom:6px;">${s.name}</h3>
                            <p style="font-size:13px; color:#64748b; margin-bottom:16px;">Avg. Wait: ${s.average_time} min</p>
                        </div>
                        <button type="button" class="btn btn-primary btn-sm" onclick="generateToken(${s.id})">Get Token</button>
                    </div>
                `).join('');
            }
        });
}

function generateToken(serviceId) {
    const alertBox = document.getElementById('alert');
    if (alertBox) alertBox.style.display = 'none';

    fetch(getApiUrl('tokens.php?action=generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            window.location.href = data.token_id ? `token.html?id=${data.token_id}` : 'token.html';
        } else {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert alert-warning';
                alertBox.textContent = data.error || 'Could not generate token';
            } else {
                alert(data.error);
            }
        }
    });
}

let studentPollTimer = null;
function loadStudentToken() {
    checkUser('student');

    const urlParams = new URLSearchParams(window.location.search);
    const tokenId = urlParams.get('id');
    const apiUrl = tokenId ? `tokens.php?action=my_token&id=${tokenId}` : 'tokens.php?action=my_token';

    function update() {
        fetch(getApiUrl(apiUrl))
            .then(r => r.json())
            .then(data => {
                const box = document.getElementById('tokenBox');
                if (!box) return;

                if (data.success && data.has_token && data.token) {
                    const t = data.token;
                    box.innerHTML = `
                        <div class="token-box">
                            <span class="badge badge-${t.status}" style="font-size:13px;">${t.status.toUpperCase()}</span>
                            <div class="token-code">${t.token_code}</div>
                            <div style="font-size:18px; font-weight:600; margin-bottom:20px;">${t.service_name}</div>
                            
                            ${t.status === 'called' ? `
                                <div class="alert alert-success" style="font-weight:700; font-size:15px; margin-bottom:20px;">
                                    📢 Your token has been CALLED! Please proceed to the service counter.
                                </div>
                            ` : ''}

                            ${t.status === 'processing' ? `
                                <div class="alert alert-success" style="font-weight:700; margin-bottom:20px;">
                                    ⚙️ Currently being processed at the counter.
                                </div>
                            ` : ''}

                            ${t.status === 'completed' ? `
                                <div class="alert alert-success" style="font-weight:700; margin-bottom:20px;">
                                    ✅ Token completed. Thank you!
                                </div>
                            ` : ''}

                            ${t.status === 'waiting' ? `
                                <div style="display:flex; justify-content:space-around; background:#f8fafc; padding:16px; border-radius:8px; margin-bottom:20px;">
                                    <div>
                                        <div style="font-size:12px; color:#64748b;">PEOPLE AHEAD</div>
                                        <div style="font-size:24px; font-weight:800;">${data.people_ahead}</div>
                                    </div>
                                    <div>
                                        <div style="font-size:12px; color:#64748b;">ESTIMATED WAIT</div>
                                        <div style="font-size:24px; font-weight:800;">${data.estimated_wait} min</div>
                                    </div>
                                </div>
                            ` : ''}

                            <div style="margin-top:16px;">
                                <a href="dashboard.html" class="btn btn-secondary btn-sm">Back to Dashboard</a>
                                <button type="button" class="btn btn-secondary btn-sm" onclick="loadStudentToken()">Refresh</button>
                            </div>
                        </div>
                    `;
                } else {
                    box.innerHTML = `
                        <div class="card" style="text-align:center; padding:32px;">
                            <p style="color:#64748b; margin-bottom:14px;">No active token found.</p>
                            <a href="dashboard.html" class="btn btn-primary btn-sm">Get Token</a>
                        </div>
                    `;
                }
            });
    }

    update();
    if (!studentPollTimer) {
        studentPollTimer = setInterval(update, 5000);
    }
}

// 3. STAFF WORKFLOW (Manages ALL active services for MVP)
let staffPollTimer = null;
function loadStaffDashboard() {
    checkUser('staff');

    function update() {
        fetch(getApiUrl('tokens.php?action=staff_queue'))
            .then(r => r.json())
            .then(data => {
                if (!data.success) return;

                const serviceTitle = document.getElementById('serviceTitle');
                if (serviceTitle) serviceTitle.textContent = data.service_name || 'All Active Services';

                // Current Token
                const currentBox = document.getElementById('currentTokenBox');
                if (data.current_token) {
                    const t = data.current_token;
                    currentBox.innerHTML = `
                        <div style="text-align:center; padding:10px 0;">
                            <span class="badge badge-${t.status}" style="font-size:13px;">${t.status.toUpperCase()}</span>
                            <div style="font-size:48px; font-weight:800; color:#2563eb; margin:8px 0;">${t.token_code}</div>
                            <div style="font-size:15px; font-weight:600; color:#475569; margin-bottom:4px;">${t.service_name}</div>
                            <div style="font-size:14px; color:#64748b; margin-bottom:16px;">Student: <strong>${t.student_name}</strong></div>
                            <div style="display:flex; gap:10px; justify-content:center;">
                                ${t.status === 'called' ? `
                                    <button type="button" class="btn btn-primary" onclick="staffAction('start', ${t.id})">Start Processing</button>
                                ` : ''}
                                ${t.status === 'processing' ? `
                                    <button type="button" class="btn btn-success" onclick="staffAction('complete', ${t.id})">Complete Token</button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                } else {
                    currentBox.innerHTML = `
                        <div style="text-align:center; padding:24px 0; color:#64748b;">
                            <p style="margin-bottom:12px;">Counter is currently idle.</p>
                            <button type="button" class="btn btn-primary btn-lg" onclick="staffAction('call_next')">Call Next Token</button>
                        </div>
                    `;
                }

                // Waiting Queue
                const queueList = document.getElementById('queueList');
                if (data.waiting_queue && data.waiting_queue.length > 0) {
                    queueList.innerHTML = `
                        <table>
                            <thead>
                                <tr><th>Token</th><th>Department</th><th>Student</th></tr>
                            </thead>
                            <tbody>
                                ${data.waiting_queue.map(q => `
                                    <tr>
                                        <td><strong style="color:#2563eb;">${q.token_code}</strong></td>
                                        <td><span class="badge" style="background:#f1f5f9; color:#334155; font-size:12px;">${q.service_name}</span></td>
                                        <td>${q.student_name}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                } else {
                    queueList.innerHTML = `<p style="color:#64748b; font-size:14px; padding:12px 0;">No students are waiting in queue.</p>`;
                }
            });
    }

    update();
    if (!staffPollTimer) {
        staffPollTimer = setInterval(update, 5000);
    }
}


function staffAction(action, tokenId = 0) {
    const alertBox = document.getElementById('alert');
    if (alertBox) alertBox.style.display = 'none';

    fetch(getApiUrl('tokens.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, token_id: tokenId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            loadStaffDashboard();
        } else {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert alert-warning';
                alertBox.textContent = data.error || 'Action failed';
            } else {
                alert(data.error);
            }
        }
    });
}

// 4. ADMIN WORKFLOW
let currentAdminTokenType = null;

function loadAdminDashboard() {
    checkUser('admin');

    fetch(getApiUrl('services.php?action=stats'))
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;

            document.getElementById('statTotal').textContent = data.total_today;
            document.getElementById('statWaiting').textContent = data.waiting;
            document.getElementById('statCompleted').textContent = data.completed;
            document.getElementById('statActive').textContent = data.active_services;

            const tbody = document.getElementById('servicesTable');
            if (tbody && data.services) {
                tbody.innerHTML = data.services.map(s => `
                    <tr>
                        <td><strong>${s.prefix}</strong></td>
                        <td>${s.name}</td>
                        <td>${s.average_time} min</td>
                        <td><span class="badge badge-waiting">${s.waiting_count !== undefined ? s.waiting_count : 0}</span></td>
                        <td><span class="badge badge-${s.status === 'active' ? 'active' : 'inactive'}">${s.status.toUpperCase()}</span></td>
                        <td>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="toggleService(${s.id}, '${s.status}')">
                                ${s.status === 'active' ? 'Deactivate' : 'Activate'}
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            // If an admin token list is currently open, refresh it with updated data
            if (currentAdminTokenType) {
                showAdminTokenList(currentAdminTokenType, false);
            }
        });
}

function toggleAdminTokenList(type) {
    if (currentAdminTokenType === type) {
        closeAdminTokenList();
    } else {
        showAdminTokenList(type, true);
    }
}

function closeAdminTokenList() {
    currentAdminTokenType = null;
    const sec = document.getElementById('adminTokenSection');
    if (sec) sec.style.display = 'none';

    const cardW = document.getElementById('cardWaiting');
    const cardC = document.getElementById('cardCompleted');
    if (cardW) cardW.classList.remove('active');
    if (cardC) cardC.classList.remove('active');
}

function showAdminTokenList(type, setSectionVisible = true) {
    currentAdminTokenType = type;

    const sec = document.getElementById('adminTokenSection');
    const title = document.getElementById('adminTokenTitle');
    const badge = document.getElementById('adminTokenBadge');
    const content = document.getElementById('adminTokenContent');
    const cardW = document.getElementById('cardWaiting');
    const cardC = document.getElementById('cardCompleted');

    if (cardW && cardC) {
        cardW.classList.toggle('active', type === 'waiting');
        cardC.classList.toggle('active', type === 'completed');
    }

    if (title) title.textContent = (type === 'waiting') ? 'Currently Waiting Tokens' : "Today's Completed Tokens";
    if (badge) {
        badge.className = 'badge badge-' + (type === 'waiting' ? 'waiting' : 'completed');
        badge.textContent = '...';
    }

    if (setSectionVisible && sec) sec.style.display = 'block';

    fetch(getApiUrl(`tokens.php?action=admin_tokens&type=${type}`))
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const tokens = data.tokens || [];
            if (badge) badge.textContent = tokens.length;

            if (!content) return;

            if (tokens.length === 0) {
                content.innerHTML = `
                    <div style="padding:24px; text-align:center; color:#64748b;">
                        ${type === 'waiting' ? 'No students are currently waiting in queue.' : 'No tokens have been completed today.'}
                    </div>
                `;
                return;
            }

            if (type === 'waiting') {
                content.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Token</th>
                                <th>Student</th>
                                <th>Service</th>
                                <th>Created Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tokens.map(t => `
                                <tr>
                                    <td><strong style="color:#2563eb;">${t.token_code}</strong></td>
                                    <td>${t.student_name}</td>
                                    <td>${t.service_name}</td>
                                    <td>${t.created_time || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                content.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>Token</th>
                                <th>Student</th>
                                <th>Service</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tokens.map(t => `
                                <tr>
                                    <td><strong style="color:#2563eb;">${t.token_code}</strong></td>
                                    <td>${t.student_name}</td>
                                    <td>${t.service_name}</td>
                                    <td><span class="badge badge-completed">COMPLETED</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        })
        .catch(() => {
            if (content) content.innerHTML = '<div style="padding:16px; color:#ef4444;">Failed to load tokens.</div>';
        });
}


function addService(e) {
    e.preventDefault();
    const name = document.getElementById('service_name').value.trim();
    const prefix = document.getElementById('prefix').value.trim();
    const average_time = document.getElementById('average_time').value;

    fetch(getApiUrl('services.php?action=add'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, prefix, average_time })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            document.getElementById('addForm').reset();
            loadAdminDashboard();
        } else {
            alert(data.error || 'Could not add service');
        }
    });
}

function toggleService(id, status) {
    fetch(getApiUrl('services.php?action=toggle'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id, status: status })
    })
    .then(r => r.json())
    .then(() => loadAdminDashboard());
}

function quickFill(email, pwd) {
    document.getElementById('email').value = email;
    document.getElementById('password').value = pwd;
}
