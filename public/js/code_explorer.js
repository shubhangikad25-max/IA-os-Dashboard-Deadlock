/**
 * DEADLOCK LAB: C Code Explorer & Viva Guide
 */

const CodeExplorerUI = {
    currentFile: 'banker.c',
    loadedDoc: null,

    async renderCodePage() {
        const container = document.getElementById('view-code');
        if (!container) return;

        if (!this.loadedDoc || this.loadedDoc.filename !== this.currentFile) {
            try {
                this.loadedDoc = await API.getCodeFile(this.currentFile);
            } catch (e) {
                console.error(e);
            }
        }

        const doc = this.loadedDoc;
        const files = [
            { key: 'banker.c', label: '1. banker.c (Safety Algorithm)' },
            { key: 'resource_request.c', label: '2. resource_request.c (Request Protocol)' },
            { key: 'deadlock_detection.c', label: '3. deadlock_detection.c (Multi-Instance)' },
            { key: 'recovery.c', label: '4. recovery.c (Process Termination)' }
        ];

        let html = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--pale-blue); color: var(--primary-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        </div>
                        <div>
                            <h3>C Code Explorer & Viva Examination Guide</h3>
                            <p>Real compiled source files with beginner-friendly function-by-function explanations</p>
                        </div>
                    </div>
                </div>

                <!-- File Selection Tabs -->
                <div class="code-tabs">
                    ${files.map(f => `
                        <button class="code-tab-btn ${f.key === this.currentFile ? 'active' : ''}" 
                                onclick="CodeExplorerUI.switchFile('${f.key}')">
                            ${f.label}
                        </button>
                    `).join('')}
                </div>

                ${doc ? `
                    <!-- Summary Card -->
                    <div style="background: var(--pale-blue); border: 1px solid var(--light-blue); padding: 14px 18px; border-radius: var(--radius-sm); margin-bottom: 20px;">
                        <h4 style="font-size: 1rem; font-weight: 700; color: #1E3A8A; margin-bottom: 4px;">${doc.title}</h4>
                        <p style="font-size: 0.85rem; color: #1E40AF;">${doc.summary}</p>
                    </div>

                    <!-- Function by Function Viva Cards -->
                    <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 14px;">
                        Key Algorithm Functions (Viva Preparation)
                    </h4>
                    
                    ${doc.functions.map(fn => `
                        <div class="viva-card">
                            <div class="viva-title">${fn.name}</div>
                            <div class="viva-signature">${fn.signature}</div>
                            <p style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 12px;"><strong>Purpose:</strong> ${fn.purpose}</p>

                            <div class="viva-grid">
                                <div>
                                    <span class="viva-item-label">Inputs:</span>
                                    <p>${fn.inputs}</p>
                                </div>
                                <div>
                                    <span class="viva-item-label">Outputs:</span>
                                    <p>${fn.outputs}</p>
                                </div>
                                <div>
                                    <span class="viva-item-label">Important Variables:</span>
                                    <p style="font-family: var(--font-mono); font-size: 0.8rem; background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">${fn.importantVariables}</p>
                                </div>
                                <div>
                                    <span class="viva-item-label">Walkthrough Example:</span>
                                    <p>${fn.example}</p>
                                </div>
                                <div>
                                    <span class="viva-item-label">Time Complexity:</span>
                                    <p style="font-weight: 600; color: var(--teal-accent);">${fn.timeComplexity}</p>
                                </div>
                                <div>
                                    <span class="viva-item-label">Space Complexity:</span>
                                    <p style="font-weight: 600; color: var(--teal-accent);">${fn.spaceComplexity}</p>
                                </div>
                            </div>

                            <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-color); font-size: 0.84rem;">
                                <span class="viva-item-label">Loop & Condition Logic:</span>
                                <p style="margin-top: 2px; color: var(--text-secondary); line-height: 1.5;">${fn.loopExplanation}</p>
                            </div>
                        </div>
                    `).join('')}

                    <!-- Actual C Source Code View -->
                    <div style="margin-top: 28px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
                                Raw C Source Code (${doc.filename})
                            </h4>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">Direct from c/${doc.filename}</span>
                        </div>
                        <div class="code-viewer-container">
                            <pre><code>${this.escapeHtml(doc.sourceCode)}</code></pre>
                        </div>
                    </div>
                ` : `
                    <p style="padding: 24px;">Loading source file...</p>
                `}
            </div>
        `;

        container.innerHTML = html;
    },

    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    async switchFile(fileKey) {
        this.currentFile = fileKey;
        this.loadedDoc = await API.getCodeFile(fileKey);
        this.renderCodePage();
    }
};

window.CodeExplorerUI = CodeExplorerUI;
