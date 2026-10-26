/**
 * DEADLOCK LAB: Deadlock Detection & Trace Visualizer
 */

const DetectionUI = {
    renderDetectionPage() {
        const container = document.getElementById('view-detection');
        if (!container) return;

        const state = AppState.detectionState;
        const n = state.n;
        const r = state.r;
        const labels = state.resourceLabels;
        const res = state.result;

        let html = `
            <!-- Top Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--status-deadlock-bg); color: var(--status-deadlock);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        </div>
                        <div>
                            <h3>Deadlock Detection (Multiple-Instance Resources)</h3>
                            <p>Detect actual active circular wait deadlocks using the Allocation and Request matrices</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="DetectionUI.loadClassicDeadlockPreset()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M10 15l5-3-5-3v6z"/></svg>
                            Load Classic 2-Process Deadlock Preset
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="DetectionUI.loadTextbookDetectionPreset()">
                            Load 5-Process Preset
                        </button>
                    </div>
                </div>

                <!-- Theory Explanation Callout -->
                <div style="background: #FFFBEB; border: 1px solid #FDE68A; padding: 12px 18px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.85rem; color: #92400E;">
                    <strong>Crucial OS Viva Concept:</strong> Banker's Algorithm is for <em>deadlock avoidance</em> (evaluates future risk of deadlock before granting requests). Deadlock detection is run when the system allows unrestricted allocation and periodically checks if an <em>actual deadlock</em> already exists among blocked processes.
                    <br>
                    <strong>Circular Wait Nuance:</strong> In systems with multiple resource instances, a cycle in a Resource Allocation Graph is a <em>necessary</em> condition, but <strong>NOT</strong> always sufficient to prove deadlock unless every resource type in the cycle has exactly 1 instance!
                </div>

                <!-- Detection Input Matrices -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <!-- Allocation Matrix -->
                    <div>
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Current Allocation Matrix</h4>
                        <div class="table-container" style="margin-bottom: 0;">
                            <table class="os-table">
                                <thead>
                                    <tr>
                                        <th>Process</th>
                                        ${labels.map(l => `<th>${l}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${state.alloc.map((row, i) => `
                                        <tr>
                                            <td class="process-label">P${i}</td>
                                            ${row.map((val, j) => `
                                                <td>
                                                    <input type="number" min="0" max="99" class="matrix-input"
                                                           value="${val}" 
                                                           onchange="DetectionUI.onAllocChange(${i}, ${j}, this.value)">
                                                </td>
                                            `).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Outstanding Request Matrix -->
                    <div>
                        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; color: var(--text-main);">Outstanding Request Matrix</h4>
                        <div class="table-container" style="margin-bottom: 0;">
                            <table class="os-table">
                                <thead>
                                    <tr>
                                        <th>Process</th>
                                        ${labels.map(l => `<th>${l}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${state.request.map((row, i) => `
                                        <tr>
                                            <td class="process-label">P${i}</td>
                                            ${row.map((val, j) => `
                                                <td>
                                                    <input type="number" min="0" max="99" class="matrix-input"
                                                           value="${val}" 
                                                           onchange="DetectionUI.onRequestChange(${i}, ${j}, this.value)">
                                                </td>
                                            `).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Available Vector & Actions -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 14px 18px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">Currently Available Resources:</span>
                        <div style="display: flex; gap: 8px;">
                            ${labels.map((lbl, j) => `
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    <span style="font-weight: 600; font-size: 0.8rem; color: var(--text-secondary);">${lbl}:</span>
                                    <input type="number" min="0" max="99" class="matrix-input"
                                           value="${state.available[j]}"
                                           onchange="DetectionUI.onAvailableChange(${j}, this.value)">
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <button class="btn btn-primary" onclick="DetectionUI.runDetection()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        Run Deadlock Detection Algorithm
                    </button>
                </div>
            </div>
        `;

        // Detection Result Display
        if (res) {
            let banner = '';
            if (res.isDeadlocked) {
                banner = `
                    <div class="status-banner deadlock">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        <div style="flex: 1;">
                            <h4 style="font-weight: 700; font-size: 1.1rem;">CONFIRMED DEADLOCK DETECTED</h4>
                            <p style="font-size: 0.9rem; margin-top: 4px;">${res.explanation}</p>
                            <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; font-size: 0.85rem;">Deadlocked Processes:</span>
                                ${res.deadlockedProcesses.map(p => `
                                    <span style="background: white; border: 1px solid #FCA5A5; color: #DC2626; font-weight: 700; padding: 2px 10px; border-radius: 12px; font-family: var(--font-mono);">P${p}</span>
                                `).join('')}
                            </div>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="DetectionUI.jumpToRecovery()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Proceed to Recovery
                        </button>
                    </div>
                `;
            } else {
                banner = `
                    <div class="status-banner safe">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <div>
                            <h4 style="font-weight: 700; font-size: 1.1rem;">NO DEADLOCK DETECTED</h4>
                            <p style="font-size: 0.9rem;">${res.explanation}</p>
                            <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-weight: 700; font-size: 0.85rem; color: #166534;">Safe Completion Order:</span>
                                ${res.resolvedSequence.map(p => `
                                    <span class="seq-node">P${p}</span>
                                `).join(' → ')}
                            </div>
                        </div>
                    </div>
                `;
            }

            // Detection Trace Iterations Table
            let traceTable = `
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Detection Algorithm Execution Trace</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Iterative examination of process requests against available Work vector</p>
                            </div>
                        </div>
                    </div>
                    <div class="table-container">
                        <table class="os-table">
                            <thead>
                                <tr>
                                    <th>Step</th>
                                    <th>Process</th>
                                    <th>Work Before</th>
                                    <th>Request Vector</th>
                                    <th>Allocated Vector</th>
                                    <th>Request ≤ Work?</th>
                                    <th>Work After Release</th>
                                    <th>Status / Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${res.trace.map(st => `
                                    <tr>
                                        <td>${st.stepNumber}</td>
                                        <td class="process-label">P${st.process}</td>
                                        <td style="font-family: var(--font-mono);">[${st.workBefore.join(', ')}]</td>
                                        <td style="font-family: var(--font-mono);">[${st.request.join(', ')}]</td>
                                        <td style="font-family: var(--font-mono);">[${st.alloc.join(', ')}]</td>
                                        <td style="font-weight: 700; color: ${st.canComplete ? 'var(--status-safe)' : 'var(--status-deadlock)'};">
                                            ${st.canComplete ? '✔ YES' : '✘ NO'}
                                        </td>
                                        <td style="font-family: var(--font-mono); font-weight: 700;">[${st.workAfter.join(', ')}]</td>
                                        <td style="text-align: left; font-size: 0.82rem; color: var(--text-secondary);">${st.note}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            html += banner + traceTable;
        }

        container.innerHTML = html;
    },

    loadClassicDeadlockPreset() {
        AppState.detectionState = {
            n: 2,
            r: 2,
            resourceLabels: ['A', 'B'],
            alloc: [
                [1, 0], // P0 holds A
                [0, 1]  // P1 holds B
            ],
            request: [
                [0, 1], // P0 requests B
                [1, 0]  // P1 requests A
            ],
            available: [0, 0],
            result: null
        };
        this.renderDetectionPage();
        this.runDetection();
    },

    loadTextbookDetectionPreset() {
        AppState.detectionState = {
            n: 5,
            r: 3,
            resourceLabels: ['A', 'B', 'C'],
            alloc: [
                [0, 1, 0],
                [2, 0, 0],
                [3, 0, 3],
                [2, 1, 1],
                [0, 0, 2]
            ],
            request: [
                [0, 0, 0],
                [2, 0, 2],
                [0, 0, 0],
                [1, 0, 0],
                [0, 0, 2]
            ],
            available: [0, 0, 0],
            result: null
        };
        this.renderDetectionPage();
        this.runDetection();
    },

    onAllocChange(i, j, val) {
        AppState.detectionState.alloc[i][j] = parseInt(val) || 0;
    },

    onRequestChange(i, j, val) {
        AppState.detectionState.request[i][j] = parseInt(val) || 0;
    },

    onAvailableChange(j, val) {
        AppState.detectionState.available[j] = parseInt(val) || 0;
    },

    async runDetection() {
        try {
            App.showGlobalAlert('Executing Deadlock Detection in C...', 'info');
            const state = AppState.detectionState;
            const res = await API.detectDeadlock({
                n: state.n,
                r: state.r,
                alloc: state.alloc,
                request: state.request,
                available: state.available
            });
            state.result = res;
            this.renderDetectionPage();
            App.showGlobalAlert(
                res.isDeadlocked ? 'DEADLOCK CONFIRMED' : 'NO DEADLOCK: System execution clear',
                res.isDeadlocked ? 'error' : 'success'
            );
        } catch (err) {
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    },

    jumpToRecovery() {
        App.navigateTo('recovery');
    }
};

window.DetectionUI = DetectionUI;
