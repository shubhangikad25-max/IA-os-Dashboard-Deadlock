/**
 * DEADLOCK LAB: Deadlock Prevention Simulator
 */

const PreventionUI = {
    currentHolding: [1], // Default: holds resource B (index 1)
    requestedRes: 0,     // Default: attempts to request resource A (index 0)
    preventionResult: null,

    // Hold and wait simulator
    holdAndWaitState: {
        holdsResources: true,
        requestingNew: true
    },
    holdAndWaitResult: null,

    renderPreventionPage() {
        const container = document.getElementById('view-prevention');
        if (!container) return;

        const labels = ['A', 'B', 'C', 'D'];

        let html = `
            <!-- Header Card -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--pale-blue); color: var(--primary-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        </div>
                        <div>
                            <h3>Deadlock Prevention Protocols</h3>
                            <p>Eliminate at least one of Havender's / Coffman's four necessary conditions prior to runtime</p>
                        </div>
                    </div>
                </div>

                <div style="background: var(--pale-blue); border: 1px solid var(--light-blue); padding: 14px 18px; border-radius: var(--radius-sm); margin-bottom: 24px; font-size: 0.86rem; color: #1E3A8A;">
                    <strong>The 4 Necessary Coffman Conditions:</strong> (1) Mutual Exclusion, (2) Hold and Wait, (3) No Preemption, and (4) Circular Wait.
                    Prevention designs operating system rules that mathematically prevent at least one condition from ever holding.
                </div>

                <!-- Protocol 1: Resource Ordering (A < B < C) -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; margin-bottom: 24px; background: white;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div>
                            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
                                Policy 1: Strict Linear Resource Ordering (Breaks Circular Wait)
                            </h4>
                            <p style="font-size: 0.82rem; color: var(--text-secondary);">
                                Global rule: Assign a 1-to-1 order function F: R → N. Resources must be requested in strictly ascending order: <code>A (0) &lt; B (1) &lt; C (2) &lt; D (3)</code>.
                            </p>
                        </div>
                        <span style="font-size: 0.75rem; background: var(--teal-light); color: var(--teal-accent); font-weight: 700; padding: 4px 10px; border-radius: 12px;">
                            Breaks Condition 4
                        </span>
                    </div>

                    <div class="form-grid" style="grid-template-columns: 1fr 1fr auto; align-items: flex-end;">
                        <div class="form-group">
                            <label>Currently Held Resources by Process</label>
                            <div style="display: flex; gap: 12px; padding: 6px 0;">
                                ${labels.map((lbl, idx) => `
                                    <label style="display: inline-flex; align-items: center; gap: 6px; font-weight: 500; font-size: 0.88rem; cursor: pointer;">
                                        <input type="checkbox" value="${idx}" 
                                               ${this.currentHolding.includes(idx) ? 'checked' : ''}
                                               onchange="PreventionUI.toggleHolding(${idx})">
                                        ${lbl} (order ${idx})
                                    </label>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Attempted Next Resource Request</label>
                            <select class="form-control" onchange="PreventionUI.requestedRes = parseInt(this.value)">
                                ${labels.map((lbl, idx) => `
                                    <option value="${idx}" ${this.requestedRes === idx ? 'selected' : ''}>
                                        Resource ${lbl} (order ${idx})
                                    </option>
                                `).join('')}
                            </select>
                        </div>

                        <div>
                            <button class="btn btn-primary" onclick="PreventionUI.testOrderingPolicy()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"/></svg>
                                Test Policy Compliance
                            </button>
                        </div>
                    </div>

                    ${this.preventionResult ? `
                        <div style="margin-top: 20px;">
                            <div class="status-banner ${this.preventionResult.isCompliant ? 'safe' : 'unsafe'}">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    ${this.preventionResult.isCompliant 
                                        ? '<polyline points="20 6 9 17 4 12"/>' 
                                        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                                </svg>
                                <div>
                                    <h4 style="font-weight: 700;">${this.preventionResult.isCompliant ? 'ORDERING RULE COMPLIANT' : 'ORDERING RULE VIOLATION (REQUEST DENIED)'}</h4>
                                    <p style="font-size: 0.88rem;">${this.preventionResult.explanation}</p>
                                </div>
                            </div>

                            <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; margin-top: 12px;">
                                <h5 style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">OS Engineering Trade-Offs:</h5>
                                <ul style="padding-left: 20px; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6;">
                                    ${this.preventionResult.tradeOffs.map(t => `<li>${t}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Protocol 2: Hold-and-Wait Elimination -->
                <div style="border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px; background: white;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                        <div>
                            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
                                Policy 2: Hold-and-Wait Elimination (Conservative / All-or-Nothing)
                            </h4>
                            <p style="font-size: 0.82rem; color: var(--text-secondary);">
                                Rule: A process can only request resources when it currently holds <strong>zero</strong> resources. It must request everything upfront or release held resources before requesting more.
                            </p>
                        </div>
                        <span style="font-size: 0.75rem; background: var(--status-waiting-bg); color: var(--status-waiting); font-weight: 700; padding: 4px 10px; border-radius: 12px;">
                            Breaks Condition 2
                        </span>
                    </div>

                    <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 16px;">
                        <label style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.88rem; cursor: pointer;">
                            <input type="checkbox" ${this.holdAndWaitState.holdsResources ? 'checked' : ''}
                                   onchange="PreventionUI.holdAndWaitState.holdsResources = this.checked">
                            Process currently holds one or more resources
                        </label>
                        <button class="btn btn-secondary btn-sm" onclick="PreventionUI.testHoldAndWait()">
                            Verify Hold & Wait Compliance
                        </button>
                    </div>

                    ${this.holdAndWaitResult ? `
                        <div>
                            <div class="status-banner ${this.holdAndWaitResult.isCompliant ? 'safe' : 'unsafe'}">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    ${this.holdAndWaitResult.isCompliant 
                                        ? '<polyline points="20 6 9 17 4 12"/>' 
                                        : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
                                </svg>
                                <div>
                                    <h4 style="font-weight: 700;">${this.holdAndWaitResult.isCompliant ? 'HOLD & WAIT ELIMINATED' : 'HOLD & WAIT VIOLATION'}</h4>
                                    <p style="font-size: 0.88rem;">${this.holdAndWaitResult.explanation}</p>
                                </div>
                            </div>
                            <div style="background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px 18px; margin-top: 12px;">
                                <h5 style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">OS Engineering Trade-Offs:</h5>
                                <ul style="padding-left: 20px; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.6;">
                                    ${this.holdAndWaitResult.tradeOffs.map(t => `<li>${t}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    toggleHolding(idx) {
        if (this.currentHolding.includes(idx)) {
            this.currentHolding = this.currentHolding.filter(i => i !== idx);
        } else {
            this.currentHolding.push(idx);
        }
    },

    async testOrderingPolicy() {
        try {
            const res = await API.checkPrevention({
                policyType: 'RESOURCE_ORDERING',
                currentHolding: this.currentHolding,
                requestedResource: this.requestedRes,
                resourceLabels: ['A', 'B', 'C', 'D']
            });
            this.preventionResult = res;
            this.renderPreventionPage();
        } catch (err) {
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    },

    async testHoldAndWait() {
        try {
            const res = await API.checkPrevention({
                policyType: 'HOLD_AND_WAIT_PREVENTION',
                holdsAny: this.holdAndWaitState.holdsResources
            });
            this.holdAndWaitResult = res;
            this.renderPreventionPage();
        } catch (err) {
            App.showGlobalAlert(`Error: ${err.message}`, 'error');
        }
    }
};

window.PreventionUI = PreventionUI;
