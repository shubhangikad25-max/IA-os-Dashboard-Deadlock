/**
 * DEADLOCK LAB: Resource Request Simulator & Add/Remove Simulator
 */

const RequestSimulatorUI = {
    selectedPid: 1,
    requestVector: [1, 0, 2],
    requestResult: null,

    // Change resources inputs
    changeVector: [0, 0, 0],
    changeType: 'ADD', // 'ADD' or 'REMOVE'
    changeResult: null,

    renderRequestPage() {
        const container = document.getElementById('view-request');
        if (!container) return;

        const n = AppState.n;
        const r = AppState.r;
        const labels = AppState.resourceLabels;

        // Ensure requestVector matches length r
        if (this.requestVector.length !== r) {
            this.requestVector = Array(r).fill(0);
        }
        if (this.changeVector.length !== r) {
            this.changeVector = Array(r).fill(0);
        }

        const pid = this.selectedPid;
        const currentAlloc = AppState.alloc[pid];
        const currentNeed = AppState.need[pid];
        const currentAvail = AppState.available;

        let html = `
            <!-- Top Description -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M16 12l-4-4-4 4"/><path d="M12 16V8"/></svg>
                        </div>
                        <div>
                            <h3>Resource Request Simulator</h3>
                            <p>Test dynamic resource acquisition through the 4-Stage Banker's Protocol</p>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; background: var(--pale-blue); color: var(--primary-blue); padding: 4px 12px; border-radius: 20px; font-weight: 600;">
                        Active State: ${AppState.n} Processes, ${AppState.r} Resource Types
                    </div>
                </div>

                <!-- Form Controls -->
                <div class="form-grid" style="grid-template-columns: 180px 1fr auto; align-items: flex-end;">
                    <div class="form-group">
                        <label for="req-pid-select">Requesting Process</label>
                        <select id="req-pid-select" class="form-control" onchange="RequestSimulatorUI.onPidChange(this.value)">
                            ${Array.from({ length: n }, (_, i) => `
                                <option value="${i}" ${i === pid ? 'selected' : ''}>Process P${i}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Request Vector (${labels.join(', ')})</label>
                        <div style="display: flex; gap: 8px;">
                            ${labels.map((lbl, j) => `
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${lbl}:</span>
                                    <input type="number" min="0" max="99" class="matrix-input" 
                                           id="req-input-${j}" value="${this.requestVector[j]}"
                                           onchange="RequestSimulatorUI.onRequestVectorChange(${j}, this.value)">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" onclick="RequestSimulatorUI.submitRequest()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Evaluate Request
                        </button>
                    </div>
                </div>
            </div>
        `;

        // If request evaluated, show 4-Stage analysis
        if (this.requestResult) {
            const res = this.requestResult;

            let statusBanner = '';
            if (res.statusType === 'GRANTED') {
                statusBanner = `
                    <div class="status-banner safe">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <div style="flex: 1;">
                            <h4 style="font-weight: 700;">REQUEST GRANTED</h4>
                            <p style="font-size: 0.88rem;">${res.explanation} ${res.safeSequence ? res.safeSequence.map(p => `P${p}`).join(' → ') : ''}</p>
                        </div>
                        <button class="btn btn-teal btn-sm" onclick="RequestSimulatorUI.commitState()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                            Commit to System State
                        </button>
                    </div>
                `;
            } else if (res.statusType === 'RESOURCES_UNAVAILABLE') {
                statusBanner = `
                    <div class="status-banner" style="background: var(--status-waiting-bg); border: 1px solid #FCD34D; color: #92400E;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div>
                            <h4 style="font-weight: 700;">PROCESS MUST WAIT (Resources Temporarily Unavailable)</h4>
                            <p style="font-size: 0.88rem;">${res.explanation}</p>
                            <p style="font-size: 0.78rem; margin-top: 4px; color: #B45309;">Notice: The request is legitimate and within maximum claim, but cannot be satisfied right now. System state remains unmodified.</p>
                        </div>
                    </div>
                `;
            } else if (res.statusType === 'INVALID_CLAIM') {
                statusBanner = `
                    <div class="status-banner unsafe">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        <div>
                            <h4 style="font-weight: 700;">REQUEST REJECTED (Invalid Claim)</h4>
                            <p style="font-size: 0.88rem;">${res.explanation}</p>
                        </div>
                    </div>
                `;
            } else {
                statusBanner = `
                    <div class="status-banner unsafe">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div>
                            <h4 style="font-weight: 700;">REQUEST DENIED (Unsafe State Prevented)</h4>
                            <p style="font-size: 0.88rem;">${res.explanation}</p>
                            <p style="font-size: 0.78rem; margin-top: 4px;">Banker's Algorithm rolled back hypothetical allocation to prevent system deadlock.</p>
                        </div>
                    </div>
                `;
            }

            html += `
                ${statusBanner}

                <!-- Stage 1 & Stage 2 Comparison Tables -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
                    <!-- Stage 1: Request <= Need -->
                    <div class="card" style="margin-bottom: 0;">
                        <div class="card-header" style="margin-bottom: 12px;">
                            <div class="card-title">
                                <div>
                                    <h4 style="font-size: 0.95rem; font-weight: 700;">STAGE 1: Request ≤ Need<sub>${pid}</sub></h4>
                                    <p style="font-size: 0.78rem; color: var(--text-secondary);">Validates within declared maximum claim</p>
                                </div>
                            </div>
                            <span style="font-weight: 700; font-size: 0.82rem; padding: 4px 10px; border-radius: 12px; background: ${res.stage1Pass ? 'var(--status-safe-bg); color: var(--status-safe);' : 'var(--status-deadlock-bg); color: var(--status-deadlock);'}">
                                ${res.stage1Pass ? '✔ PASSED' : '✘ FAILED'}
                            </span>
                        </div>
                        <div class="table-container" style="margin-bottom: 0;">
                            <table class="os-table">
                                <thead>
                                    <tr>
                                        <th>Resource</th>
                                        <th>Request</th>
                                        <th>Need (Max - Alloc)</th>
                                        <th>Comparison</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${labels.map((lbl, j) => {
                                        const reqVal = res.request[j];
                                        const needVal = res.originalNeedPid[j];
                                        const pass = reqVal <= needVal;
                                        return `
                                            <tr>
                                                <td style="font-weight: 700;">${lbl}</td>
                                                <td>${reqVal}</td>
                                                <td>${needVal}</td>
                                                <td style="font-family: var(--font-mono);">${reqVal} ≤ ${needVal}</td>
                                                <td style="font-weight: 700; color: ${pass ? 'var(--status-safe)' : 'var(--status-deadlock)'};">
                                                    ${pass ? '✔ PASS' : '✘ FAIL'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Stage 2: Request <= Available -->
                    <div class="card" style="margin-bottom: 0;">
                        <div class="card-header" style="margin-bottom: 12px;">
                            <div class="card-title">
                                <div>
                                    <h4 style="font-size: 0.95rem; font-weight: 700;">STAGE 2: Request ≤ Available</h4>
                                    <p style="font-size: 0.78rem; color: var(--text-secondary);">Checks if resources are physically free</p>
                                </div>
                            </div>
                            <span style="font-weight: 700; font-size: 0.82rem; padding: 4px 10px; border-radius: 12px; background: ${res.stage2Pass ? 'var(--status-safe-bg); color: var(--status-safe);' : 'var(--status-waiting-bg); color: var(--status-waiting);'}">
                                ${res.stage2Pass ? '✔ PASSED' : '⏳ WAIT'}
                            </span>
                        </div>
                        <div class="table-container" style="margin-bottom: 0;">
                            <table class="os-table">
                                <thead>
                                    <tr>
                                        <th>Resource</th>
                                        <th>Request</th>
                                        <th>Available</th>
                                        <th>Comparison</th>
                                        <th>Result</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${labels.map((lbl, j) => {
                                        const reqVal = res.request[j];
                                        const availVal = res.originalAvailable[j];
                                        const pass = reqVal <= availVal;
                                        return `
                                            <tr>
                                                <td style="font-weight: 700;">${lbl}</td>
                                                <td>${reqVal}</td>
                                                <td>${availVal}</td>
                                                <td style="font-family: var(--font-mono);">${reqVal} ≤ ${availVal}</td>
                                                <td style="font-weight: 700; color: ${pass ? 'var(--status-safe)' : 'var(--status-waiting)'};">
                                                    ${pass ? '✔ PASS' : '⏳ WAIT'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Stage 3 & Stage 4: Before and After Comparison -->
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">STAGE 3 & 4: Hypothetical Allocation & Safety Verification</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">
                                    Hypothetical formulas: Available = Available - Request | Alloc<sub>${pid}</sub> = Alloc<sub>${pid}</sub> + Request | Need<sub>${pid}</sub> = Need<sub>${pid}</sub> - Request
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="os-table">
                            <thead>
                                <tr>
                                    <th>Vector / Matrix Row</th>
                                    <th colspan="${r}">Before Request</th>
                                    <th colspan="${r}">Proposed (Hypothetical)</th>
                                    <th colspan="${r}">Final Committed State</th>
                                </tr>
                                <tr>
                                    <th>Variable</th>
                                    ${labels.map(l => `<th>${l}</th>`).join('')}
                                    ${labels.map(l => `<th>${l}</th>`).join('')}
                                    ${labels.map(l => `<th>${l}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td class="process-label">Available</td>
                                    ${res.originalAvailable.map(v => `<td>${v}</td>`).join('')}
                                    ${res.tempAvailable.map(v => `<td style="color: var(--teal-accent); font-weight:700;">${v}</td>`).join('')}
                                    ${res.committedAvailable.map(v => `<td style="font-weight:700;">${v}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td class="process-label">P${pid} Allocation</td>
                                    ${res.originalAllocPid.map(v => `<td>${v}</td>`).join('')}
                                    ${res.tempAllocPid.map(v => `<td style="color: var(--teal-accent); font-weight:700;">${v}</td>`).join('')}
                                    ${res.committedAlloc[pid].map(v => `<td style="font-weight:700;">${v}</td>`).join('')}
                                </tr>
                                <tr>
                                    <td class="process-label">P${pid} Need</td>
                                    ${res.originalNeedPid.map(v => `<td>${v}</td>`).join('')}
                                    ${res.tempNeedPid.map(v => `<td style="color: var(--teal-accent); font-weight:700;">${v}</td>`).join('')}
                                    ${res.committedNeed[pid].map(v => `<td style="font-weight:700;">${v}</td>`).join('')}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        // Section 10: Add/Remove Resources Simulator
        html += `
            <div class="card" style="margin-top: 32px;">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--teal-light); color: var(--teal-accent);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </div>
                        <div>
                            <h3>Add / Remove Resource Instances</h3>
                            <p>Preserves changeResources() function to simulate expanding or reducing physical system resources</p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--pale-blue); border: 1px solid var(--light-blue); padding: 12px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 0.84rem; color: #1E3A8A;">
                    <strong>Important viva distinction:</strong> Adding/removing physical resources alters the total available pool for ALL processes, whereas a process Request merely borrows from the existing Available pool.
                </div>

                <div class="form-grid" style="grid-template-columns: 200px 1fr auto; align-items: flex-end;">
                    <div class="form-group">
                        <label>Operation Mode</label>
                        <select class="form-control" onchange="RequestSimulatorUI.changeType = this.value">
                            <option value="ADD" ${this.changeType === 'ADD' ? 'selected' : ''}>Add Resources (Increase Pool)</option>
                            <option value="REMOVE" ${this.changeType === 'REMOVE' ? 'selected' : ''}>Remove Resources (Decrease Pool)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Quantity to Change (${labels.join(', ')})</label>
                        <div style="display: flex; gap: 8px;">
                            ${labels.map((lbl, j) => `
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">${lbl}:</span>
                                    <input type="number" min="0" max="99" class="matrix-input" 
                                           value="${this.changeVector[j]}"
                                           onchange="RequestSimulatorUI.changeVector[${j}] = parseInt(this.value) || 0">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-teal" onclick="RequestSimulatorUI.submitResourceChange()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Execute Change
                        </button>
                    </div>
                </div>

                ${this.changeResult ? `
                    <div style="margin-top: 16px;">
                        <div class="status-banner ${this.changeResult.accepted ? 'safe' : 'unsafe'}">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                ${this.changeResult.accepted 
                                    ? '<polyline points="20 6 9 17 4 12"/>' 
                                    : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                            </svg>
                            <div style="flex: 1;">
                                <h4 style="font-weight: 700;">${this.changeResult.accepted ? 'RESOURCE CHANGE ACCEPTED' : 'RESOURCE CHANGE REJECTED'}</h4>
                                <p style="font-size: 0.88rem;">${this.changeResult.explanation || this.changeResult.reason}</p>
                                ${this.changeResult.safeSequence ? `
                                    <div style="margin-top: 6px; font-size: 0.82rem; font-weight: 600;">
                                        Updated Safe Sequence: ${this.changeResult.safeSequence.map(p => `P${p}`).join(' → ')}
                                    </div>
                                ` : ''}
                            </div>
                            ${this.changeResult.accepted ? `
                                <button class="btn btn-teal btn-sm" onclick="RequestSimulatorUI.commitResourceChange()">
                                    Commit to Available Vector
                                </button>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;
    },

    onPidChange(val) {
        this.selectedPid = parseInt(val);
        this.requestResult = null;
        this.renderRequestPage();
    },

    onRequestVectorChange(idx, val) {
        this.requestVector[idx] = parseInt(val) || 0;
    },

    async submitRequest() {
        try {
            App.showGlobalAlert('Evaluating resource request via C engine...', 'info');
            const res = await API.requestResource({
                n: AppState.n,
                r: AppState.r,
                alloc: AppState.alloc,
                max: AppState.max,
                available: AppState.available,
                pid: this.selectedPid,
                request: this.requestVector
            });
            this.requestResult = res;
            this.renderRequestPage();
            App.showGlobalAlert(`Request evaluation complete: ${res.statusType}`, res.statusType === 'GRANTED' ? 'success' : 'warning');
        } catch (err) {
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    },

    commitState() {
        if (!this.requestResult || this.requestResult.statusType !== 'GRANTED') return;
        AppState.alloc = this.requestResult.committedAlloc;
        AppState.need = this.requestResult.committedNeed;
        AppState.available = this.requestResult.committedAvailable;
        AppState.latestResult = {
            isSafe: true,
            safeSequence: this.requestResult.safeSequence,
            steps: this.requestResult.safetySteps,
            explanation: this.requestResult.explanation
        };
        App.showGlobalAlert(`Request committed! System state updated for Process P${this.selectedPid}.`, 'success');
        this.requestResult = null;
        this.renderRequestPage();
        App.renderDashboard();
    },

    async submitResourceChange() {
        try {
            App.showGlobalAlert('Running changeResources() in C...', 'info');
            const res = await API.changeResources({
                n: AppState.n,
                r: AppState.r,
                alloc: AppState.alloc,
                max: AppState.max,
                available: AppState.available,
                total: AppState.total,
                change: this.changeVector,
                isAdd: this.changeType === 'ADD'
            });
            this.changeResult = res;
            this.renderRequestPage();
        } catch (err) {
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    },

    commitResourceChange() {
        if (!this.changeResult || !this.changeResult.accepted) return;
        AppState.available = this.changeResult.updatedAvailable;
        if (this.changeResult.updatedTotal) {
            AppState.total = this.changeResult.updatedTotal;
        }
        App.showGlobalAlert('Physical resource changes committed!', 'success');
        this.changeResult = null;
        this.renderRequestPage();
        App.renderDashboard();
    }
};

window.RequestSimulatorUI = RequestSimulatorUI;
