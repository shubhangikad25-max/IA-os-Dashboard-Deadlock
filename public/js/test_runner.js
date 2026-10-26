/**
 * DEADLOCK LAB: Automated Test Cases Runner & Analytical Results
 */

const TestRunnerUI = {
    testData: null,
    isRunning: false,

    renderTestPage() {
        const container = document.getElementById('view-tests');
        if (!container) return;

        let html = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--status-safe-bg); color: var(--status-safe);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        </div>
                        <div>
                            <h3>Analytical Test Suite & Validation Matrix</h3>
                            <p>Rigorous test suite (TC1–TC12) verified directly against compiled native C binaries</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="TestRunnerUI.runTests()" ${this.isRunning ? 'disabled' : ''}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        ${this.isRunning ? 'Running C Test Suite...' : 'Execute All 12 Test Cases'}
                    </button>
                </div>

                ${this.testData ? `
                    <!-- Summary Metric Cards -->
                    <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
                        <div class="metric-card">
                            <div class="metric-icon-wrap">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            </div>
                            <div class="metric-info">
                                <p>Total Tests</p>
                                <div class="value">${this.testData.total}</div>
                            </div>
                        </div>

                        <div class="metric-card">
                            <div class="metric-icon-wrap green">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="metric-info">
                                <p>Passed</p>
                                <div class="value" style="color: var(--status-safe);">${this.testData.passed}</div>
                            </div>
                        </div>

                        <div class="metric-card">
                            <div class="metric-icon-wrap ${this.testData.failed > 0 ? '' : 'green'}">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            </div>
                            <div class="metric-info">
                                <p>Failed</p>
                                <div class="value" style="color: ${this.testData.failed > 0 ? 'var(--status-deadlock)' : 'var(--text-secondary)'};">${this.testData.failed}</div>
                            </div>
                        </div>

                        <div class="metric-card">
                            <div class="metric-icon-wrap teal">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            </div>
                            <div class="metric-info">
                                <p>Accuracy</p>
                                <div class="value" style="color: var(--teal-accent);">
                                    ${Math.round((this.testData.passed / this.testData.total) * 100)}%
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Analytical Results Table -->
                    <div class="table-container">
                        <table class="os-table">
                            <thead>
                                <tr>
                                    <th style="width: 70px;">Test</th>
                                    <th style="width: 220px; text-align: left;">Input Scenario</th>
                                    <th style="text-align: left;">Actual Result (From C Engine)</th>
                                    <th style="text-align: left;">Expected Result</th>
                                    <th style="width: 90px;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.testData.tests.map(t => `
                                    <tr>
                                        <td class="process-label">${t.id}</td>
                                        <td style="text-align: left;">
                                            <strong>${t.title}</strong>
                                            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                                                ${t.scenario}
                                            </div>
                                        </td>
                                        <td style="text-align: left; font-family: var(--font-mono); font-size: 0.8rem;">
                                            ${t.actualResult}
                                        </td>
                                        <td style="text-align: left; font-size: 0.82rem; color: var(--text-secondary);">
                                            ${t.expectedResult}
                                        </td>
                                        <td>
                                            <span style="display: inline-block; padding: 4px 10px; border-radius: 12px; font-weight: 700; font-size: 0.78rem; background: ${t.passed ? 'var(--status-safe-bg); color: var(--status-safe);' : 'var(--status-deadlock-bg); color: var(--status-deadlock);'}">
                                                ${t.passed ? '✔ PASS' : '✘ FAIL'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div style="text-align: center; padding: 48px 20px;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-blue)" style="opacity: 0.6; margin-bottom: 12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                        <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">Test Suite Ready to Execute</h4>
                        <p style="color: var(--text-secondary); margin-bottom: 20px;">
                            Click the button above to execute all 12 analytical test scenarios through the compiled GCC C binaries.
                        </p>
                        <button class="btn btn-primary" onclick="TestRunnerUI.runTests()">
                            Run All Tests Now
                        </button>
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;
    },

    async runTests() {
        this.isRunning = true;
        this.renderTestPage();
        try {
            App.showGlobalAlert('Executing all 12 C test cases...', 'info');
            const data = await API.runAllTests();
            this.testData = data;
            this.isRunning = false;
            this.renderTestPage();
            App.showGlobalAlert(`All ${data.passed}/${data.total} C test cases verified successfully!`, 'success');
        } catch (err) {
            this.isRunning = false;
            this.renderTestPage();
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    }
};

window.TestRunnerUI = TestRunnerUI;
