/**
 * CampusFlow - Single Clean Client JavaScript (app.js)
 * Vanilla JS, 100% Offline, Zero Frameworks
 */

// Helper to determine directory depth of current page
function getPageDepth() {
    const path = window.location.pathname;
    if (path.includes('/student/') || path.includes('/staff/') || path.includes('/admin/')) {
        return 3;
    }
    if (path.includes('/pages/')) {
        return 2;
    }
    return 1;
}

// Helper to resolve API path based on page folder depth
function getApiUrl(endpoint) {
    const depth = getPageDepth();
    const prefix = depth === 3 ? '../../../backend/api/' : (depth === 2 ? '../../backend/api/' : '../backend/api/');
    return prefix + endpoint;
}

// Helper to resolve Login page path
function getLoginUrl() {
    const depth = getPageDepth();
    return depth === 3 ? '../login.html' : (depth === 2 ? 'login.html' : 'pages/login.html');
}

// Helper to resolve correct role dashboard URL
function getDashboardUrl(role) {
    const depth = getPageDepth();
    const prefix = depth === 3 ? '../' : (depth === 2 ? '' : 'pages/');
    if (role === 'admin') return prefix + 'admin/dashboard.html';
    if (role === 'staff') return prefix + 'staff/dashboard.html';
    return prefix + 'student/dashboard.html';
}

// 1. AUTHENTICATION & RBAC
function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const alertBox = document.getElementById('alert');
    if (alertBox) alertBox.style.display = 'none';

    fetch(getApiUrl('auth.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            window.location.replace(getDashboardUrl(data.role));
        } else {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert alert-danger';
                alertBox.textContent = data.error || 'Invalid email or password.';
            }
        }
    })
    .catch(() => {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = 'Server connection failed';
        }
    });
}

function handleRegister(e) {
    e.preventDefault();
    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm_password').value;
    const role = document.getElementById('role').value;
    const alertBox = document.getElementById('alert');

    function showError(msg) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = msg;
        }
    }

    if (!fullName) {
        showError('Please enter your full name.');
        return;
    }
    if (!email) {
        showError('Please enter a valid email address.');
        return;
    }
    if (!password) {
        showError('Please enter a password.');
        return;
    }
    if (password !== confirmPassword) {
        showError('Passwords do not match.');
        return;
    }
    if (role !== 'student' && role !== 'staff' && role !== 'admin') {
        showError('Please select a valid role.');
        return;
    }

    fetch(getApiUrl('auth.php?action=register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
            full_name: fullName,
            email: email,
            password: password,
            confirm_password: confirmPassword,
            role: role
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            window.location.replace('login.html?registered=1');
        } else {
            showError(data.error || 'Registration failed.');
        }
    })
    .catch(() => {
        showError('Server connection failed');
    });
}

function logout() {
    fetch(getApiUrl('auth.php?action=logout'), {
        cache: 'no-store',
        credentials: 'same-origin'
    }).finally(() => {
        if (document.body) {
            document.body.style.display = 'none';
        }
        window.location.replace(getLoginUrl());
    });
}

function checkUser(requiredRole, callback) {
    fetch(getApiUrl('auth.php?action=check'), {
        cache: 'no-store',
        credentials: 'same-origin'
    })
    .then(r => r.json())
    .then(d => {
        if (!d.success || !d.user) {
            if (document.body) document.body.style.display = 'none';
            window.location.replace(getLoginUrl());
            return;
        }

        // Role authorization guard
        if (requiredRole && d.user.role !== requiredRole) {
            if (document.body) document.body.style.display = 'none';
            window.location.replace(getDashboardUrl(d.user.role));
            return;
        }

        // Successfully authenticated & authorized: reveal page content
        if (document.body) {
            document.body.style.display = '';
        }

        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = d.user.name || d.user.full_name || 'User';

        if (typeof callback === 'function') {
            callback(d.user);
        }
    })
    .catch(() => {
        if (document.body) document.body.style.display = 'none';
        window.location.replace(getLoginUrl());
    });
}

// Redirect already logged-in users directly to their dashboard
function checkAlreadyLoggedIn() {
    fetch(getApiUrl('auth.php?action=check'), {
        cache: 'no-store',
        credentials: 'same-origin'
    })
    .then(r => r.json())
    .then(d => {
        if (d.success && d.user && d.user.role) {
            window.location.replace(getDashboardUrl(d.user.role));
        }
    })
    .catch(() => {});
}

// Gateway authentication check for Home page (frontend/index.html)
function initHomeGateway() {
    fetch(getApiUrl('auth.php?action=check'), {
        cache: 'no-store',
        credentials: 'same-origin'
    })
    .then(r => r.json())
    .then(d => {
        if (d.success && d.user && d.user.role) {
            window.location.replace(getDashboardUrl(d.user.role));
        } else {
            window.location.replace(getLoginUrl());
        }
    })
    .catch(() => {
        window.location.replace(getLoginUrl());
    });
}

// Handle browser back/forward cache (bfcache) navigation
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        const depth = getPageDepth();
        if (depth === 3) {
            const path = window.location.pathname;
            const role = path.includes('/admin/') ? 'admin' : (path.includes('/staff/') ? 'staff' : 'student');
            checkUser(role);
        } else if (depth === 1) {
            initHomeGateway();
        }
    }
});

// 2. STUDENT WORKFLOW
function loadStudentDashboard() {
    checkUser('student', () => {
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
                if (list && data.success && data.services) {
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

                // Populate Smart Journey checkboxes
                const jbox = document.getElementById('journeyCheckboxes');
                if (jbox && data.success && data.services) {
                    if (data.services.length === 0) {
                        jbox.innerHTML = `<div style="color:#64748b; font-size:13px;">No active services available today.</div>`;
                    } else {
                        jbox.innerHTML = data.services.map(s => `
                            <label class="journey-checkbox-label">
                                <input type="checkbox" name="journey_services" value="${s.id}" data-name="${s.name}">
                                <div style="flex:1;">
                                    <div style="font-weight:600; font-size:13px; color:#1e293b;">${s.name}</div>
                                    <div style="font-size:11px; color:#64748b;">Queue: ${s.waiting_count} &bull; ~${s.average_time} min/person</div>
                                </div>
                            </label>
                        `).join('');
                    }
                }
            });
    });
}

// Smart Journey Planning Workflow
function planSmartJourney() {
    const checkboxes = document.querySelectorAll('input[name="journey_services"]:checked');
    const serviceIds = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
    const resultBox = document.getElementById('journeyPlanResult');
    const alertBox = document.getElementById('alert');

    if (alertBox) alertBox.style.display = 'none';

    if (serviceIds.length === 0) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-warning';
            alertBox.textContent = 'Please select at least one campus service to plan your journey.';
        } else {
            alert('Please select at least one campus service.');
        }
        return;
    }

    const btn = document.getElementById('btnPlanJourney');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Planning Route...';
    }

    fetch(getApiUrl('journey.php?action=plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_ids: serviceIds })
    })
    .then(r => r.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Plan My Journey';
        }

        if (!data.success) {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert alert-danger';
                alertBox.textContent = data.error || 'Failed to calculate journey route.';
            }
            return;
        }

        renderJourneyResult(data);
    })
    .catch(() => {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Plan My Journey';
        }
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = 'Server connection failed while planning journey.';
        }
    });
}

function renderJourneyResult(data) {
    const resultBox = document.getElementById('journeyPlanResult');
    if (!resultBox) return;

    const firstStep = data.journey && data.journey.length > 0 ? data.journey[0] : null;

    resultBox.style.display = 'block';
    resultBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="font-size:15px; font-weight:700; color:#0f172a;">Recommended Journey Route</h3>
            <span class="badge" style="background:#f1f5f9; color:#475569;">${data.selected_count} Services</span>
        </div>

        <div style="margin-bottom:16px;">
            ${data.journey.map(step => `
                <div class="journey-step">
                    <div class="journey-step-num">${step.step}</div>
                    <div style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                            <strong style="font-size:14px; color:#0f172a;">${step.name} (${step.prefix})</strong>
                            <span style="font-size:12px; color:#2563eb; font-weight:700;">Est. Wait: ${step.estimated_wait} min</span>
                        </div>
                        <div style="font-size:12px; color:#64748b; margin-bottom:6px;">
                            Queue Ahead: <strong>${step.waiting_count}</strong> students &bull; Average Service: ${step.average_time} min
                        </div>
                        <div style="font-size:11px; color:#047857; background:#ecfdf5; border-radius:4px; padding:3px 8px; display:inline-block;">
                            💡 ${step.recommendation_reason}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px; margin-bottom:16px;">
            <div>
                <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Estimated Total Waiting Time</div>
                <div style="font-size:24px; font-weight:800; color:#2563eb;">${data.total_estimated_wait} min</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:11px; color:#64748b; font-weight:600;">Total Duration (Wait + Service)</div>
                <div style="font-size:16px; font-weight:700; color:#334155;">~${data.total_estimated_duration} min</div>
            </div>
        </div>

        ${firstStep ? `
            <div style="display:flex; gap:10px; align-items:center;">
                <button type="button" class="btn btn-primary" onclick="startSmartJourney(${firstStep.id})">
                    Start Journey (Get Token for ${firstStep.name}) &rarr;
                </button>
            </div>
        ` : ''}
    `;

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function startSmartJourney(serviceId) {
    const alertBox = document.getElementById('alert');
    if (alertBox) alertBox.style.display = 'none';

    fetch(getApiUrl('journey.php?action=start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success && data.token_id) {
            window.location.href = `token.html?id=${data.token_id}`;
        } else {
            if (alertBox) {
                alertBox.style.display = 'block';
                alertBox.className = 'alert alert-warning';
                alertBox.textContent = data.error || 'Could not start journey';
            } else {
                alert(data.error);
            }
        }
    })
    .catch(() => {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.className = 'alert alert-danger';
            alertBox.textContent = 'Server connection failed while starting journey';
        }
    });
}

function clearSmartJourney() {
    const checkboxes = document.querySelectorAll('input[name="journey_services"]');
    checkboxes.forEach(cb => { cb.checked = false; });
    const resultBox = document.getElementById('journeyPlanResult');
    if (resultBox) {
        resultBox.style.display = 'none';
        resultBox.innerHTML = '';
    }
    const alertBox = document.getElementById('alert');
    if (alertBox) alertBox.style.display = 'none';
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
    checkUser('student', () => {
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
    });
}

// 3. STAFF WORKFLOW (Manages ALL active services for MVP)
let staffPollTimer = null;
function loadStaffDashboard() {
    checkUser('staff', () => {
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
    });
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
    checkUser('admin', () => {
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

                // Load operational intelligence widgets
                loadAdminIntelligence();
            });
    });
}

function loadAdminIntelligence() {
    fetch(getApiUrl('analytics.php?action=intelligence'))
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;

            // 1. Bottleneck Detection
            const bBadge = document.getElementById('bottleneckBadge');
            const bList = document.getElementById('bottleneckList');
            if (data.bottlenecks) {
                const b = data.bottlenecks;
                if (bBadge) {
                    if (b.counts.high > 0) {
                        bBadge.className = 'badge badge-high';
                        bBadge.textContent = `${b.counts.high} High Congestion`;
                    } else if (b.counts.moderate > 0) {
                        bBadge.className = 'badge badge-moderate';
                        bBadge.textContent = `${b.counts.moderate} Moderate`;
                    } else {
                        bBadge.className = 'badge badge-normal';
                        bBadge.textContent = 'All Normal';
                    }
                }

                if (bList && b.services) {
                    if (b.services.length === 0) {
                        bList.innerHTML = `<div style="color:#64748b; font-size:13px; padding:8px 0;">No active services detected.</div>`;
                    } else {
                        bList.innerHTML = b.services.map(s => {
                            let badgeClass = 'badge-normal';
                            let badgeText = 'NORMAL';
                            if (s.level === 'high') {
                                badgeClass = 'badge-high';
                                badgeText = 'HIGH';
                            } else if (s.level === 'moderate') {
                                badgeClass = 'badge-moderate';
                                badgeText = 'MODERATE';
                            }
                            return `
                                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                                    <div>
                                        <div style="font-weight:600; font-size:13px; color:#1e293b;">${s.service_name} (${s.prefix})</div>
                                        <div style="font-size:11px; color:#64748b;">Queue: <strong>${s.queue}</strong> &bull; Avg Wait: ${s.average_time} min</div>
                                    </div>
                                    <span class="badge ${badgeClass}" style="font-size:10px;">${badgeText}</span>
                                </div>
                            `;
                        }).join('');
                    }
                }
            }

            // 2. Campus Demand Prediction
            const dContent = document.getElementById('demandContent');
            if (dContent && data.demand_prediction) {
                const dp = data.demand_prediction;
                if (!dp.has_sufficient_data) {
                    dContent.innerHTML = `
                        <div style="padding:16px 0; color:#64748b; font-size:13px; text-align:center;">
                            ${dp.message || 'Not enough historical data for demand prediction.'}
                        </div>
                    `;
                } else {
                    const barsHtml = dp.hourly_distribution.map(h => `
                        <div class="demand-row">
                            <span class="demand-label">${h.label}</span>
                            <div class="demand-bar-bg" title="${h.token_count} tokens generated">
                                <div class="demand-bar-fill ${h.is_peak ? 'peak' : ''}" style="width: ${Math.max(4, h.percentage)}%;"></div>
                            </div>
                            <span class="demand-count">${h.token_count}</span>
                        </div>
                    `).join('');

                    dContent.innerHTML = `
                        <div style="margin-bottom:12px;">${barsHtml}</div>
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; font-size:12px;">
                            <div style="margin-bottom:4px;">
                                <span style="color:#64748b;">Expected Peak:</span> <strong>${dp.peak_window}</strong>
                            </div>
                            <div>
                                <span style="color:#64748b;">Most Demanded Service:</span> <strong>${dp.most_demanded_service}</strong>
                            </div>
                        </div>
                    `;
                }
            }

            // 3. Smart Counter Allocation
            const cBadge = document.getElementById('counterStatusBadge');
            const cContent = document.getElementById('counterRecommendationContent');
            if (data.counter_allocation) {
                const ca = data.counter_allocation;
                if (cBadge) {
                    if (ca.status === 'rebalance_suggested') {
                        cBadge.className = 'badge badge-moderate';
                        cBadge.textContent = 'Action Suggested';
                    } else if (ca.status === 'capacity_alert') {
                        cBadge.className = 'badge badge-high';
                        cBadge.textContent = 'Capacity Alert';
                    } else {
                        cBadge.className = 'badge badge-normal';
                        cBadge.textContent = 'Balanced';
                    }
                }

                if (cContent) {
                    cContent.innerHTML = `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-bottom:10px;">
                            <div style="font-weight:700; font-size:13px; color:#1e293b; margin-bottom:6px;">
                                ${ca.status === 'rebalance_suggested' ? 'Suggested Action:' : 'Status:'}
                            </div>
                            <div style="font-size:13px; color:#334155; line-height:1.4;">
                                ${ca.action}
                            </div>
                        </div>
                        <div style="font-size:12px; color:#64748b; line-height:1.4;">
                            <strong>Reason:</strong> ${ca.reason}
                        </div>
                    `;
                }
            }
        })
        .catch(() => {});
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
