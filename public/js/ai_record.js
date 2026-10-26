/**
 * DEADLOCK LAB: AI Usage Record (Transparency & Academic Integrity)
 */

const AIRecordUI = {
    defaultRecords: [
        {
            tool: "Google Antigravity",
            purpose: "Full-stack architecture, C algorithm restructuring for step-by-step trace generation, and responsive web dashboard implementation",
            output: "Created Express connector, c/ modules with JSON output support, analytical test suite, and educational light-blue dashboard",
            verification: "Student compiled all 4 C programs with GCC, ran automated test suite (12/12 passed), verified calculations against textbook, and explained functions during viva"
        },
        {
            tool: "ChatGPT",
            purpose: "Reference algorithm clarification and review of Havender Coffman conditions for OS viva questions",
            output: "Generated theoretical comparison between deadlock avoidance vs detection and resource ordering proofs",
            verification: "Student verified theorems in Silberschatz Operating Systems Concepts textbook (Chapter 7)"
        }
    ],

    records: null,

    getRecords() {
        if (!this.records) {
            const saved = localStorage.getItem('deadlock_lab_ai_records');
            if (saved) {
                try {
                    this.records = JSON.parse(saved);
                } catch (e) {
                    this.records = [...this.defaultRecords];
                }
            } else {
                this.records = [...this.defaultRecords];
            }
        }
        return this.records;
    },

    saveRecords() {
        localStorage.setItem('deadlock_lab_ai_records', JSON.stringify(this.records));
        App.showGlobalAlert('AI Usage Record saved successfully!', 'success');
    },

    renderAIRecordPage() {
        const container = document.getElementById('view-ai-record');
        if (!container) return;

        const list = this.getRecords();

        let html = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--pale-blue); color: var(--primary-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        </div>
                        <div>
                            <h3>Academic AI Usage Record</h3>
                            <p>Honest and transparent disclosure of generative AI assistance for college project viva</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="AIRecordUI.addRow()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Add Custom Entry
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="AIRecordUI.saveRecords()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                            Save Records
                        </button>
                    </div>
                </div>

                <div style="background: #F8FAFC; border: 1px solid var(--border-color); padding: 12px 18px; border-radius: var(--radius-sm); margin-bottom: 20px; font-size: 0.85rem; color: var(--text-secondary);">
                    <strong>Statement of Academic Integrity:</strong> In accordance with university AI ethics policies, all AI tool utilization is documented below. The undergraduate student is solely responsible for understanding, modifying, compiling, and defending all algorithms and code during the OS viva examination.
                </div>

                <div class="table-container">
                    <table class="os-table">
                        <thead>
                            <tr>
                                <th style="width: 160px; text-align: left;">AI Tool Used</th>
                                <th style="width: 260px; text-align: left;">Purpose</th>
                                <th style="text-align: left;">Output Generated</th>
                                <th style="width: 280px; text-align: left;">Student Verification</th>
                                <th style="width: 60px;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map((r, idx) => `
                                <tr>
                                    <td>
                                        <input type="text" class="form-control" style="font-weight: 700;" 
                                               value="${r.tool}" 
                                               onchange="AIRecordUI.updateField(${idx}, 'tool', this.value)">
                                    </td>
                                    <td>
                                        <textarea class="form-control" rows="3" 
                                                  onchange="AIRecordUI.updateField(${idx}, 'purpose', this.value)">${r.purpose}</textarea>
                                    </td>
                                    <td>
                                        <textarea class="form-control" rows="3" 
                                                  onchange="AIRecordUI.updateField(${idx}, 'output', this.value)">${r.output}</textarea>
                                    </td>
                                    <td>
                                        <textarea class="form-control" rows="3" 
                                                  onchange="AIRecordUI.updateField(${idx}, 'verification', this.value)">${r.verification}</textarea>
                                    </td>
                                    <td>
                                        <button class="btn btn-secondary btn-sm" style="color: var(--status-deadlock);" 
                                                onclick="AIRecordUI.deleteRow(${idx})" title="Delete row">
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    updateField(idx, field, val) {
        this.records[idx][field] = val;
    },

    addRow() {
        this.records.push({
            tool: "New Tool",
            purpose: "Explain purpose...",
            output: "Describe output...",
            verification: "Describe student verification..."
        });
        this.renderAIRecordPage();
    },

    deleteRow(idx) {
        this.records.splice(idx, 1);
        this.renderAIRecordPage();
    }
};

window.AIRecordUI = AIRecordUI;
