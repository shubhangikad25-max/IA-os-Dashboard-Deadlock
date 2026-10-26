/**
 * DEADLOCK LAB: Main Application Coordinator
 */

const App = {
    currentView: 'dashboard',

    init() {
        this.setupNavigation();
        this.checkBackendHealth();
        this.renderDashboard();
    },

    setupNavigation() {
        const links = document.querySelectorAll('.nav-link');
        links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetView = link.getAttribute('data-view');
                if (targetView) {
                    this.navigateTo(targetView);
                }
            });
        });
    },

    navigateTo(viewId) {
        this.currentView = viewId;

        // Update sidebar active link
        document.querySelectorAll('.nav-link').forEach(link => {
            if (link.getAttribute('data-view') === viewId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Hide all views, display target view
        document.querySelectorAll('.view-container').forEach(view => {
            view.style.display = 'none';
        });

        const targetEl = document.getElementById(`view-${viewId}`);
        if (targetEl) {
            targetEl.style.display = 'block';
        }

        // Update Topbar Title & Breadcrumb
        const titles = {
            'dashboard': 'Dashboard & Matrix Input',
            'simulation': "Banker's Safety Simulation",
            'request': 'Resource Request Simulator',
            'detection': 'Deadlock Detection',
            'prevention': 'Deadlock Prevention Protocols',
            'recovery': 'Deadlock Recovery via Termination',
            'tests': 'Analytical Test Suite (TC1–TC12)',
            'code': 'C Code Explorer & Viva Guide',
            'ai-record': 'Academic AI Usage Record',
            'about': 'About Project & OS Theory Guide'
        };

        const pageTitleEl = document.getElementById('topbar-page-title');
        if (pageTitleEl) pageTitleEl.innerText = titles[viewId] || 'Dashboard';

        // Trigger view-specific rendering
        if (viewId === 'dashboard') this.renderDashboard();
        else if (viewId === 'simulation') SimulationUI.renderSimulationPage();
        else if (viewId === 'request') RequestSimulatorUI.renderRequestPage();
        else if (viewId === 'detection') DetectionUI.renderDetectionPage();
        else if (viewId === 'prevention') PreventionUI.renderPreventionPage();
        else if (viewId === 'recovery') RecoveryUI.renderRecoveryPage();
        else if (viewId === 'tests') TestRunnerUI.renderTestPage();
        else if (viewId === 'code') CodeExplorerUI.renderCodePage();
        else if (viewId === 'ai-record') AIRecordUI.renderAIRecordPage();
        else if (viewId === 'about') this.renderAboutPage();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async checkBackendHealth() {
        try {
            const health = await API.getHealth();
            const badge = document.getElementById('engine-status-text');
            const dot = document.getElementById('engine-status-dot');
            if (badge) badge.innerText = `C Engine: Active (GCC 14.2)`;
            if (dot) dot.style.backgroundColor = 'var(--status-safe)';
        } catch (e) {
            const badge = document.getElementById('engine-status-text');
            const dot = document.getElementById('engine-status-dot');
            if (badge) badge.innerText = 'C Engine: Offline';
            if (dot) dot.style.backgroundColor = 'var(--status-deadlock)';
            this.showGlobalAlert('Could not reach backend C service. Ensure Node.js server is running on port 3000.', 'error');
        }
    },

    showGlobalAlert(message, type = 'info') {
        const alertBox = document.getElementById('global-alert');
        if (!alertBox) return;

        alertBox.className = `status-banner ${type}`;
        alertBox.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                ${type === 'success' || type === 'safe' ? '<polyline points="20 6 9 17 4 12"/>' :
                  type === 'error' || type === 'deadlock' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
                  '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}
            </svg>
            <div style="flex: 1; font-size: 0.88rem; font-weight: 500;">${message}</div>
            <button onclick="document.getElementById('global-alert').style.display='none'" style="background:none; border:none; cursor:pointer; color:inherit; font-weight:bold;">✕</button>
        `;
        alertBox.style.display = 'flex';

        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (alertBox.style.display !== 'none') {
                    alertBox.style.display = 'none';
                }
            }, 5000);
        }
    },

    // -------------------------------------------------------------------------
    // DASHBOARD & INPUT TABLE BUILDER
    // -------------------------------------------------------------------------
    renderDashboard() {
        const container = document.getElementById('view-dashboard');
        if (!container) return;

        const n = AppState.n;
        const r = AppState.r;
        const labels = AppState.resourceLabels;
        const mode = AppState.inputMode;

        // Metric calculations
        let totalAllocated = 0;
        AppState.alloc.forEach(row => row.forEach(val => totalAllocated += val));

        let totalAvailable = 0;
        AppState.available.forEach(val => totalAvailable += val);

        let totalResSum = 0;
        if (mode === 'MODE_A' && AppState.total) {
            AppState.total.forEach(val => totalResSum += val);
        } else {
            totalResSum = totalAllocated + totalAvailable;
        }

        const isSafe = AppState.latestResult ? AppState.latestResult.isSafe : null;

        let html = `
            <!-- Top Metrics Grid -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon-wrap">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div class="metric-info">
                        <p>Processes (N)</p>
                        <div class="value">${n}</div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-wrap teal">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div class="metric-info">
                        <p>Resource Types (M)</p>
                        <div class="value">${r}</div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-wrap amber">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <div class="metric-info">
                        <p>Allocated Resources</p>
                        <div class="value">${totalAllocated}</div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-wrap green">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div class="metric-info">
                        <p>Available Resources</p>
                        <div class="value">${totalAvailable}</div>
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-icon-wrap ${isSafe === true ? 'green' : (isSafe === false ? 'amber' : '')}">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    </div>
                    <div class="metric-info">
                        <p>Safety Status</p>
                        <div class="value" style="font-size: 1.15rem; color: ${isSafe === true ? 'var(--status-safe)' : (isSafe === false ? 'var(--status-unsafe)' : 'var(--text-secondary)')};">
                            ${isSafe === true ? 'SAFE STATE' : (isSafe === false ? 'UNSAFE' : 'NOT TESTED')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Configuration & Input Table Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </div>
                        <div>
                            <h3>Process & Resource Allocation Input Matrix</h3>
                            <p>Configure process dimensions and input the Allocation, Maximum, and Available/Total resources</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="App.loadPreset()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Load Textbook Preset (5P / 3R)
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="App.clearForm()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            Clear Form
                        </button>
                    </div>
                </div>

                <!-- Dimension Controls Form -->
                <div class="form-grid" style="grid-template-columns: 140px 140px 1fr auto; align-items: flex-end; margin-bottom: 20px;">
                    <div class="form-group">
                        <label for="dim-n">Processes N (1–50)</label>
                        <input type="number" id="dim-n" class="form-control" min="1" max="50" value="${n}">
                    </div>
                    <div class="form-group">
                        <label for="dim-r">Resource Types M (1–20)</label>
                        <input type="number" id="dim-r" class="form-control" min="1" max="20" value="${r}">
                    </div>
                    <div class="form-group">
                        <label for="dim-labels">Resource Labels (Comma-separated)</label>
                        <input type="text" id="dim-labels" class="form-control" value="${labels.join(', ')}">
                    </div>
                    <div>
                        <button class="btn btn-teal" onclick="App.generateNewTable()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Generate Input Table
                        </button>
                    </div>
                </div>

                <!-- Mode Selector -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; margin-bottom: 16px;">
                    <div class="mode-toggle-group">
                        <button class="mode-btn ${mode === 'MODE_B' ? 'active' : ''}" onclick="App.setMode('MODE_B')">
                            MODE B: Enter Available Directly (Reference Image)
                        </button>
                        <button class="mode-btn ${mode === 'MODE_A' ? 'active' : ''}" onclick="App.setMode('MODE_A')">
                            MODE A: Enter Total Resources
                        </button>
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                        ${mode === 'MODE_B' 
                            ? 'Available resources are specified directly as shown in textbook tables.'
                            : 'Available[j] is automatically calculated as: Total[j] - Sum(Allocation[i][j]).'}
                    </div>
                </div>

                <!-- Grouped Header Matrix Table (Exact Match to Reference Image 1) -->
                <div class="table-container">
                    <table class="os-table">
                        <thead>
                            <tr>
                                <th rowspan="2" style="width: 90px;">Process</th>
                                <th colspan="${r}">Allocation</th>
                                <th colspan="${r}">Max</th>
                                <th colspan="${r}">${mode === 'MODE_A' ? 'Total Resources' : 'Available'}</th>
                            </tr>
                            <tr>
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${AppState.alloc.map((row, i) => `
                                <tr>
                                    <td class="process-label">P${i}</td>
                                    <!-- Allocation Cells -->
                                    ${row.map((val, j) => `
                                        <td>
                                            <input type="number" min="0" max="99" 
                                                   class="matrix-input ${val > AppState.max[i][j] ? 'invalid-cell' : ''}" 
                                                   id="alloc-${i}-${j}" value="${val}"
                                                   onchange="App.onCellChange('alloc', ${i}, ${j}, this.value)">
                                        </td>
                                    `).join('')}

                                    <!-- Max Cells -->
                                    ${AppState.max[i].map((val, j) => `
                                        <td>
                                            <input type="number" min="0" max="99" 
                                                   class="matrix-input ${AppState.alloc[i][j] > val ? 'invalid-cell' : ''}" 
                                                   id="max-${i}-${j}" value="${val}"
                                                   onchange="App.onCellChange('max', ${i}, ${j}, this.value)">
                                        </td>
                                    `).join('')}

                                    <!-- Available / Total Vector (Spans all rows on the right, matching user reference image!) -->
                                    ${i === 0 ? `
                                        <td rowspan="${n}" colspan="${r}" style="vertical-align: top; background: white; padding: 18px 12px; border-left: 2px solid var(--border-color);">
                                            <div style="display: flex; justify-content: space-around; align-items: center; gap: 8px;">
                                                ${(mode === 'MODE_A' ? AppState.total : AppState.available).map((val, j) => `
                                                    <div style="text-align: center;">
                                                        <span style="font-weight: 700; font-size: 0.82rem; color: var(--text-secondary); display: block; margin-bottom: 4px;">${labels[j]}</span>
                                                        <input type="number" min="0" max="99" class="matrix-input" 
                                                               id="${mode === 'MODE_A' ? 'total' : 'avail'}-${j}" value="${val}"
                                                               onchange="App.onVectorChange('${mode === 'MODE_A' ? 'total' : 'avail'}', ${j}, this.value)">
                                                    </div>
                                                `).join('')}
                                            </div>
                                            <div style="font-size: 0.76rem; color: var(--text-secondary); text-align: center; margin-top: 14px;">
                                                ${mode === 'MODE_A' ? 'Total instances per resource type' : 'Currently free available instances'}
                                            </div>
                                        </td>
                                    ` : ''}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Form Action Buttons -->
                <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-top: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn btn-secondary" onclick="App.validateInputs(true)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                            Validate Inputs
                        </button>
                        <button class="btn btn-secondary" onclick="App.calculateNeedFromC()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                            Calculate Need in C
                        </button>
                    </div>

                    <button class="btn btn-primary" onclick="App.runBankerSimulation(true)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Start Safety Simulation
                    </button>
                </div>
            </div>

            <!-- Separate Read-Only Need Matrix Preview (Exact Match to Reference Image 2) -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--teal-light); color: var(--teal-accent);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                        </div>
                        <div>
                            <h3>Need Matrix (Calculated by C Engine)</h3>
                            <p>Formula: Need[i][j] = Max[i][j] − Allocation[i][j]</p>
                        </div>
                    </div>
                    <span style="font-size: 0.78rem; background: var(--teal-light); color: var(--teal-accent); font-weight: 700; padding: 4px 10px; border-radius: 12px;">
                        Read-Only Verified Matrix
                    </span>
                </div>

                <div class="table-container" style="max-width: 540px; margin: 0 auto 12px;">
                    <table class="os-table">
                        <thead>
                            <tr>
                                <th rowspan="2" style="width: 100px;">Process</th>
                                <th colspan="${r}">Need</th>
                            </tr>
                            <tr>
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${AppState.need.map((row, i) => `
                                <tr>
                                    <td class="process-label">P${i}</td>
                                    ${row.map(val => `<td style="font-weight: 700; font-family: var(--font-mono);">${val}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    setMode(mode) {
        AppState.inputMode = mode;
        this.renderDashboard();
    },

    loadPreset() {
        AppState.loadTextbookPreset();
        this.renderDashboard();
        this.showGlobalAlert('Loaded standard 5-process 3-resource textbook allocation scenario.', 'success');
    },

    clearForm() {
        AppState.clearState(AppState.n, AppState.r);
        this.renderDashboard();
        this.showGlobalAlert('Input table cleared.', 'info');
    },

    generateNewTable() {
        const nInput = document.getElementById('dim-n');
        const rInput = document.getElementById('dim-r');
        const labelsInput = document.getElementById('dim-labels');

        const newN = parseInt(nInput.value);
        const newR = parseInt(rInput.value);

        if (isNaN(newN) || newN < 1 || newN > 50) {
            this.showGlobalAlert('Process count N must be between 1 and 50.', 'error');
            return;
        }
        if (isNaN(newR) || newR < 1 || newR > 20) {
            this.showGlobalAlert('Resource count M must be between 1 and 20.', 'error');
            return;
        }

        let customLabels = labelsInput.value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (customLabels.length !== newR) {
            customLabels = AppState.getLabels(newR);
        }

        AppState.n = newN;
        AppState.r = newR;
        AppState.resourceLabels = customLabels;
        AppState.clearState(newN, newR);
        this.renderDashboard();
        this.showGlobalAlert(`Generated new matrix table for ${newN} processes and ${newR} resource types.`, 'success');
    },

    onCellChange(type, i, j, val) {
        const parsed = parseInt(val) || 0;
        if (type === 'alloc') AppState.alloc[i][j] = parsed;
        else if (type === 'max') AppState.max[i][j] = parsed;

        // Auto update need matrix locally
        AppState.need[i][j] = Math.max(0, AppState.max[i][j] - AppState.alloc[i][j]);

        // If Mode A, update available automatically
        if (AppState.inputMode === 'MODE_A' && AppState.total) {
            let sumAlloc = 0;
            for (let row = 0; row < AppState.n; row++) sumAlloc += AppState.alloc[row][j];
            AppState.available[j] = Math.max(0, AppState.total[j] - sumAlloc);
        }
    },

    onVectorChange(type, j, val) {
        const parsed = parseInt(val) || 0;
        if (type === 'total') {
            AppState.total[j] = parsed;
            let sumAlloc = 0;
            for (let i = 0; i < AppState.n; i++) sumAlloc += AppState.alloc[i][j];
            AppState.available[j] = Math.max(0, parsed - sumAlloc);
        } else {
            AppState.available[j] = parsed;
        }
    },

    validateInputs(showAlert = true) {
        const n = AppState.n;
        const r = AppState.r;

        // Check for negative numbers or allocation > max
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < r; j++) {
                if (AppState.alloc[i][j] < 0 || AppState.max[i][j] < 0) {
                    if (showAlert) this.showGlobalAlert(`Error: Cell [P${i}, R${j}] cannot have negative value.`, 'error');
                    return false;
                }
                if (AppState.alloc[i][j] > AppState.max[i][j]) {
                    if (showAlert) this.showGlobalAlert(`Invalid input: At process P${i}, Allocation (${AppState.alloc[i][j]}) exceeds Maximum claim (${AppState.max[i][j]}) for resource ${AppState.resourceLabels[j]}.`, 'error');
                    return false;
                }
            }
        }

        // Check available / total
        for (let j = 0; j < r; j++) {
            if (AppState.available[j] < 0) {
                if (showAlert) this.showGlobalAlert(`Error: Available quantity for resource ${AppState.resourceLabels[j]} cannot be negative.`, 'error');
                return false;
            }
            if (AppState.inputMode === 'MODE_A' && AppState.total) {
                let sumAlloc = 0;
                for (let i = 0; i < n; i++) sumAlloc += AppState.alloc[i][j];
                if (AppState.total[j] < sumAlloc) {
                    if (showAlert) this.showGlobalAlert(`Error: Total resources for ${AppState.resourceLabels[j]} (${AppState.total[j]}) is less than allocated sum (${sumAlloc}).`, 'error');
                    return false;
                }
            }
        }

        if (showAlert) {
            this.showGlobalAlert('All inputs successfully validated! Matrices conform to OS constraints.', 'success');
        }
        return true;
    },

    async calculateNeedFromC() {
        if (!this.validateInputs(false)) return;
        try {
            this.showGlobalAlert('Invoking C banker.exe to calculate Need and Available...', 'info');
            const res = await API.checkBanker({
                n: AppState.n,
                r: AppState.r,
                alloc: AppState.alloc,
                max: AppState.max,
                available: AppState.available,
                total: AppState.inputMode === 'MODE_A' ? AppState.total : undefined
            });

            AppState.need = res.need;
            AppState.latestResult = res;
            this.renderDashboard();
            this.showGlobalAlert('Need matrix calculated and verified by C backend!', 'success');
        } catch (err) {
            this.showGlobalAlert(`Calculation error: ${err.message}`, 'error');
        }
    },

    async runBankerSimulation(autoTransition = true) {
        if (!this.validateInputs(true)) return;
        try {
            this.showGlobalAlert('Running Banker Safety Algorithm in C...', 'info');
            const res = await API.checkBanker({
                n: AppState.n,
                r: AppState.r,
                alloc: AppState.alloc,
                max: AppState.max,
                available: AppState.available,
                total: AppState.inputMode === 'MODE_A' ? AppState.total : undefined
            });

            AppState.need = res.need;
            AppState.latestResult = res;
            AppState.currentStepIndex = 0;

            if (autoTransition) {
                this.navigateTo('simulation');
            } else {
                this.renderDashboard();
            }

            this.showGlobalAlert(`Simulation complete: System is ${res.isSafe ? 'SAFE' : 'UNSAFE'}`, res.isSafe ? 'success' : 'warning');
        } catch (err) {
            this.showGlobalAlert(`Simulation Error: ${err.message}`, 'error');
        }
    },

    // -------------------------------------------------------------------------
    // ABOUT / VIVA THEORY GUIDE
    // -------------------------------------------------------------------------
    renderAboutPage() {
        const container = document.getElementById('view-about');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--pale-blue); color: var(--primary-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </div>
                        <div>
                            <h3>DEADLOCK LAB: Viva & Theoretical Guide</h3>
                            <p>Core Operating Systems definitions, algorithms, and examiner questions</p>
                        </div>
                    </div>
                </div>

                <div style="font-size: 0.9rem; line-height: 1.7; color: var(--text-main);">
                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 8px;">1. What is a Deadlock?</h4>
                    <p style="margin-bottom: 16px;">
                        A deadlock is a situation in an operating system where a set of concurrent processes are permanently blocked because each process holds one or more resources and is waiting to acquire resources held by other processes in the same set. No process can proceed, terminate, or release its resources.
                    </p>

                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 8px;">2. The 4 Necessary Coffman Conditions</h4>
                    <p style="margin-bottom: 8px;">Deadlock can occur if and only if all four conditions hold simultaneously in the system:</p>
                    <ol style="padding-left: 24px; margin-bottom: 16px;">
                        <li><strong>Mutual Exclusion:</strong> At least one resource must be held in a non-shareable mode (only one process at a time).</li>
                        <li><strong>Hold and Wait:</strong> A process must currently hold at least one resource while waiting to acquire additional resources held by other processes.</li>
                        <li><strong>No Preemption:</strong> Resources cannot be forcibly revoked from a process; they can only be released voluntarily after the process finishes its task.</li>
                        <li><strong>Circular Wait:</strong> A closed chain of processes exists such that P0 waits for a resource held by P1, P1 waits for P2, ..., and Pn-1 waits for P0.</li>
                    </ol>

                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 8px;">3. Deadlock Handling Strategies</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px;">
                        <div style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-sm);">
                            <h5 style="font-weight: 700; color: var(--teal-accent);">Deadlock Prevention</h5>
                            <p style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 4px;">
                                Imposes strict static rules (such as linear resource ordering A &lt; B &lt; C) to mathematically ensure at least one Coffman condition cannot hold.
                            </p>
                        </div>
                        <div style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-sm);">
                            <h5 style="font-weight: 700; color: var(--primary-blue);">Deadlock Avoidance</h5>
                            <p style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 4px;">
                                Dynamically evaluates every resource request using Banker's Algorithm. Only grants requests that leave the system in a guaranteed SAFE state.
                            </p>
                        </div>
                        <div style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-sm);">
                            <h5 style="font-weight: 700; color: var(--status-deadlock);">Deadlock Detection & Recovery</h5>
                            <p style="font-size: 0.84rem; color: var(--text-secondary); margin-top: 4px;">
                                Allows unrestricted allocation. Periodically runs a multi-instance detection algorithm to find circular wait, and recovers by aborting processes.
                            </p>
                        </div>
                    </div>

                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--primary-blue); margin-bottom: 8px;">4. Common Viva Questions & Answers</h4>
                    <div class="viva-card" style="margin-bottom: 12px;">
                        <strong style="color: var(--text-main);">Q: Is an UNSAFE state always a deadlocked state?</strong>
                        <p style="margin-top: 4px; color: var(--text-secondary); font-size: 0.86rem;">
                            <strong>A:</strong> No! An unsafe state is <em>not</em> deadlocked yet. An unsafe state merely means the operating system can no longer <em>guarantee</em> that deadlock will be avoided if all processes request their declared maximum claims simultaneously. Some unsafe states may still complete without deadlock if processes request fewer resources than their maximums.
                        </p>
                    </div>

                    <div class="viva-card" style="margin-bottom: 12px;">
                        <strong style="color: var(--text-main);">Q: What is the time complexity of Banker's Safety Algorithm?</strong>
                        <p style="margin-top: 4px; color: var(--text-secondary); font-size: 0.86rem;">
                            <strong>A:</strong> O(N² × M), where N is the number of processes and M is the number of resource types. In the worst case, searching for an eligible process takes O(N × M) comparisons, and this step can be repeated up to N times.
                        </p>
                    </div>

                    <div class="viva-card">
                        <strong style="color: var(--text-main);">Q: How does linear resource ordering prevent circular wait?</strong>
                        <p style="margin-top: 4px; color: var(--text-secondary); font-size: 0.86rem;">
                            <strong>A:</strong> By establishing a 1-to-1 global mapping F: R → N and requiring processes to request resources in strictly increasing order (F(Ri) &lt; F(Rj)), any sequence of dependencies P0 → P1 → ... → Pn must have strictly increasing resource order values, making a closed cycle mathematically impossible.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
};

window.App = App;

// Bootstrap on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
