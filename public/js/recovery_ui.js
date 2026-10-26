/**
 * DEADLOCK LAB: Interactive Deadlock Recovery Simulator
 * Features:
 * - Dynamic SVG Resource-Allocation Graph (RAG) with cycle highlighting
 * - 7-Stage step-by-step recovery timeline with Previous / Next / Run / Reset controls
 * - Before-and-After Resource & Process Status tables
 * - Multi-scenario testing (Classic 2-process, Complex 3-process partial recovery, No-deadlock)
 * - Source of truth: Compiled native C recovery & detection engines
 */

const RecoveryUI = {
    // Current Simulation State
    currentStep: 1, // 1 to 7
    selectedVictim: null,
    terminatedProcesses: [],

    // Active Working Matrices
    simData: {
        n: 2,
        r: 2,
        resourceLabels: ['A', 'B'],
        alloc: [[1, 0], [0, 1]],
        request: [[0, 1], [1, 0]],
        available: [0, 0]
    },

    // Snapshot of Initial State (for Reset)
    initialSnapshot: null,

    // C Execution Results
    initialDetection: null,
    recoveryResult: null,

    // Initialize or Sync State
    initSimulatorState(presetKey = 'classic') {
        if (presetKey === 'classic') {
            // Preset 1: Classic 2-Process Deadlock (P0 holds A requests B, P1 holds B requests A, Avail = [0, 0])
            this.simData = {
                n: 2,
                r: 2,
                resourceLabels: ['A', 'B'],
                alloc: [[1, 0], [0, 1]],
                request: [[0, 1], [1, 0]],
                available: [0, 0]
            };
            this.selectedVictim = 1; // Default candidate P1
        } else if (presetKey === 'complex') {
            // Preset 2: Complex 3-Process Deadlock where terminating 1 is insufficient
            // P0 holds A requests B; P1 holds B requests C; P2 holds C requests B; Avail = [0, 0, 0]
            // Terminating P0 releases A, but P1 and P2 remain mutually deadlocked on B and C!
            this.simData = {
                n: 3,
                r: 3,
                resourceLabels: ['A', 'B', 'C'],
                alloc: [
                    [1, 0, 0], // P0 holds A
                    [0, 1, 0], // P1 holds B
                    [0, 0, 1]  // P2 holds C
                ],
                request: [
                    [0, 1, 0], // P0 requests B
                    [0, 0, 1], // P1 requests C
                    [0, 1, 0]  // P2 requests B (both P0 and P2 need B)
                ],
                available: [0, 0, 0]
            };
            this.selectedVictim = 0; // Terminate P0 -> leaves P1 and P2 deadlocked
        } else if (presetKey === 'nodeadlock') {
            // Preset 3: No Deadlock (Clean State)
            this.simData = {
                n: 2,
                r: 2,
                resourceLabels: ['A', 'B'],
                alloc: [[1, 0], [0, 1]],
                request: [[0, 1], [0, 0]], // P1 has no outstanding request
                available: [0, 1]          // B is available
            };
            this.selectedVictim = null;
        } else if (presetKey === 'sync') {
            // Sync from Detection page state
            const det = AppState.detectionState;
            this.simData = {
                n: det.n,
                r: det.r,
                resourceLabels: [...det.resourceLabels],
                alloc: det.alloc.map(row => [...row]),
                request: det.request.map(row => [...row]),
                available: [...det.available]
            };
            this.selectedVictim = (det.result && det.result.deadlockedProcesses && det.result.deadlockedProcesses.length > 0)
                ? det.result.deadlockedProcesses[0] : 0;
        }

        // Deep copy snapshot for Reset
        this.initialSnapshot = {
            n: this.simData.n,
            r: this.simData.r,
            resourceLabels: [...this.simData.resourceLabels],
            alloc: this.simData.alloc.map(r => [...r]),
            request: this.simData.request.map(r => [...r]),
            available: [...this.simData.available]
        };

        this.currentStep = 1;
        this.terminatedProcesses = [];
        this.recoveryResult = null;
        this.runInitialDetection();
    },

    async runInitialDetection() {
        try {
            const res = await API.detectDeadlock({
                n: this.simData.n,
                r: this.simData.r,
                alloc: this.simData.alloc,
                request: this.simData.request,
                available: this.simData.available
            });
            this.initialDetection = res;
            if (res.isDeadlocked && res.deadlockedProcesses.length > 0) {
                if (this.selectedVictim === null || !res.deadlockedProcesses.includes(this.selectedVictim)) {
                    this.selectedVictim = res.deadlockedProcesses[0];
                }
            } else {
                this.selectedVictim = null;
            }
            this.renderRecoveryPage();
        } catch (e) {
            console.error('Detection error:', e);
        }
    },

    // -------------------------------------------------------------------------
    // CYCLE FINDER FOR RESOURCE-ALLOCATION GRAPH
    // -------------------------------------------------------------------------
    findCycleEdges(n, r, alloc, request, deadlockedPids, terminatedPids) {
        const cycleEdgeSet = new Set();
        if (!deadlockedPids || deadlockedPids.length === 0) return cycleEdgeSet;

        // Bipartite graph representation:
        // Process i: 0..n-1
        // Resource j: n..(n+r-1)
        const adj = new Map();
        for (let i = 0; i < n; i++) adj.set(i, []);
        for (let j = 0; j < r; j++) adj.set(n + j, []);

        for (let i = 0; i < n; i++) {
            if (terminatedPids.includes(i)) continue;
            for (let j = 0; j < r; j++) {
                if (request[i][j] > 0) {
                    adj.get(i).push({ to: n + j, type: 'req', p: i, r: j });
                }
                if (alloc[i][j] > 0) {
                    adj.get(n + j).push({ to: i, type: 'alloc', p: i, r: j });
                }
            }
        }

        // DFS with path tracking
        const visited = new Set();
        const inStack = new Set();
        const pathEdges = [];

        function dfs(u) {
            visited.add(u);
            inStack.add(u);

            const neighbors = adj.get(u) || [];
            for (const edge of neighbors) {
                const v = edge.to;
                pathEdges.push(edge);

                if (!visited.has(v)) {
                    dfs(v);
                } else if (inStack.has(v)) {
                    // Cycle detected! Backtrack and mark all edges in the cycle loop
                    for (let k = pathEdges.length - 1; k >= 0; k--) {
                        const cur = pathEdges[k];
                        cycleEdgeSet.add(`${cur.type}-${cur.p}-${cur.r}`);
                        if (cur.to === v) break;
                    }
                }

                pathEdges.pop();
            }

            inStack.delete(u);
        }

        for (let i = 0; i < n; i++) {
            if (!visited.has(i) && deadlockedPids.includes(i) && !terminatedPids.includes(i)) {
                dfs(i);
            }
        }

        return cycleEdgeSet;
    },

    // -------------------------------------------------------------------------
    // SVG RESOURCE ALLOCATION GRAPH GENERATOR
    // -------------------------------------------------------------------------
    generateRagSvg(alloc, request, available, deadlockedPids, terminatedPids, selectedVictim) {
        const n = this.simData.n;
        const r = this.simData.r;
        const labels = this.simData.resourceLabels;

        const width = 640;
        const rowHeight = 75;
        const height = Math.max(260, Math.max(n, r) * rowHeight + 40);

        const xProcess = 130;
        const xResource = 510;

        // Calculate node Y coordinates
        const processY = [];
        const resourceY = [];

        const pStart = (height - (n - 1) * rowHeight) / 2;
        for (let i = 0; i < n; i++) {
            processY.push(pStart + i * rowHeight);
        }

        const rStart = (height - (r - 1) * rowHeight) / 2;
        for (let j = 0; j < r; j++) {
            resourceY.push(rStart + j * rowHeight);
        }

        const cycleEdges = this.findCycleEdges(n, r, alloc, request, deadlockedPids, terminatedPids);

        let edgesSvg = '';

        // 1. Render Allocation Edges: Resource -> Process
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < r; j++) {
                const qty = alloc[i][j];
                if (qty > 0) {
                    const isTerminated = terminatedPids.includes(i);
                    const isCycle = cycleEdges.has(`alloc-${i}-${j}`);
                    const x1 = xResource - 28;
                    const y1 = resourceY[j];
                    const x2 = xProcess + 24;
                    const y2 = processY[i];

                    // Gentle curve for separation
                    const cx = (x1 + x2) / 2;
                    const cy = (y1 + y2) / 2 - 20;

                    let strokeColor = '#0D9488'; // Teal
                    let strokeWidth = '1.8';
                    let markerId = 'rag-arrow-alloc';
                    let dashArray = '';
                    let opacity = '1';

                    if (isTerminated) {
                        strokeColor = '#CBD5E1';
                        dashArray = '4,4';
                        opacity = '0.35';
                        markerId = 'rag-arrow-dim';
                    } else if (isCycle) {
                        strokeColor = '#DC2626'; // Bold Red for Deadlock Cycle
                        strokeWidth = '3';
                        markerId = 'rag-arrow-cycle';
                    }

                    edgesSvg += `
                        <path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" 
                              fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                              ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}
                              opacity="${opacity}"
                              marker-end="url(#${markerId})" />
                        <text x="${cx}" y="${cy - 4}" font-size="11" font-weight="700" 
                              fill="${isCycle ? '#DC2626' : (isTerminated ? '#94A3B8' : '#0D9488')}" 
                              text-anchor="middle" opacity="${opacity}">
                            alloc: ${qty}
                        </text>
                    `;
                }
            }
        }

        // 2. Render Request Edges: Process -> Resource
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < r; j++) {
                const qty = request[i][j];
                if (qty > 0) {
                    const isTerminated = terminatedPids.includes(i);
                    const isCycle = cycleEdges.has(`req-${i}-${j}`);
                    const x1 = xProcess + 24;
                    const y1 = processY[i];
                    const x2 = xResource - 28;
                    const y2 = resourceY[j];

                    // Gentle curve in opposite direction for clarity
                    const cx = (x1 + x2) / 2;
                    const cy = (y1 + y2) / 2 + 20;

                    let strokeColor = '#D97706'; // Amber
                    let strokeWidth = '1.8';
                    let markerId = 'rag-arrow-req';
                    let dashArray = '5,4';
                    let opacity = '1';

                    if (isTerminated) {
                        strokeColor = '#CBD5E1';
                        dashArray = '4,4';
                        opacity = '0.35';
                        markerId = 'rag-arrow-dim';
                    } else if (isCycle) {
                        strokeColor = '#DC2626'; // Bold Red
                        strokeWidth = '3';
                        dashArray = '';
                        markerId = 'rag-arrow-cycle';
                    }

                    edgesSvg += `
                        <path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}" 
                              fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
                              ${dashArray ? `stroke-dasharray="${dashArray}"` : ''}
                              opacity="${opacity}"
                              marker-end="url(#${markerId})" />
                        <text x="${cx}" y="${cy + 13}" font-size="11" font-weight="700" 
                              fill="${isCycle ? '#DC2626' : (isTerminated ? '#94A3B8' : '#D97706')}" 
                              text-anchor="middle" opacity="${opacity}">
                            req: ${qty}
                        </text>
                    `;
                }
            }
        }

        // 3. Render Process Nodes
        let processNodesSvg = '';
        for (let i = 0; i < n; i++) {
            const x = xProcess;
            const y = processY[i];
            const isTerminated = terminatedPids.includes(i);
            const isDeadlocked = deadlockedPids && deadlockedPids.includes(i) && !isTerminated;
            const isVictim = selectedVictim === i && !isTerminated;

            let fillColor = '#EFF6FF';
            let strokeColor = '#2563EB';
            let textColor = '#172033';
            let statusText = 'ACTIVE';

            if (isTerminated) {
                fillColor = '#F1F5F9';
                strokeColor = '#94A3B8';
                textColor = '#94A3B8';
                statusText = 'TERMINATED';
            } else if (isDeadlocked) {
                fillColor = '#FEE2E2';
                strokeColor = '#DC2626';
                textColor = '#991B1B';
                statusText = 'DEADLOCKED';
            } else {
                fillColor = '#DCFCE7';
                strokeColor = '#16A34A';
                textColor = '#166534';
                statusText = 'RESOLVED';
            }

            processNodesSvg += `
                <g class="rag-node process-node" style="cursor: pointer;" onclick="RecoveryUI.selectVictim(${i})">
                    ${isVictim ? `
                        <circle cx="${x}" cy="${y}" r="32" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-dasharray="4,3">
                            <animateTransform attributeName="transform" type="rotate" from="0 ${x} ${y}" to="360 ${x} ${y}" dur="8s" repeatCount="indefinite"/>
                        </circle>
                    ` : ''}
                    <circle cx="${x}" cy="${y}" r="24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.2" 
                            ${isTerminated ? 'stroke-dasharray="3,3"' : ''} />
                    <text x="${x}" y="${y + 5}" font-size="14" font-weight="700" fill="${textColor}" text-anchor="middle" 
                          font-family="monospace">
                        P${i}
                    </text>
                    <text x="${x}" y="${y + 36}" font-size="9" font-weight="700" 
                          fill="${isTerminated ? '#94A3B8' : (isDeadlocked ? '#DC2626' : '#16A34A')}" text-anchor="middle">
                        ${statusText}
                    </text>
                </g>
            `;
        }

        // 4. Render Resource Nodes
        let resourceNodesSvg = '';
        for (let j = 0; j < r; j++) {
            const x = xResource;
            const y = resourceY[j];
            const availQty = available[j] !== undefined ? available[j] : 0;

            resourceNodesSvg += `
                <g class="rag-node resource-node">
                    <rect x="${x - 28}" y="${y - 25}" width="56" height="50" rx="8" ry="8"
                          fill="#EFF6FF" stroke="#2563EB" stroke-width="2" />
                    <text x="${x}" y="${y + 2}" font-size="16" font-weight="700" fill="#1E40AF" text-anchor="middle" font-family="sans-serif">
                        ${labels[j]}
                    </text>
                    <text x="${x}" y="${y + 17}" font-size="9" font-weight="600" fill="#64748B" text-anchor="middle">
                        avail: ${availQty}
                    </text>
                    <text x="${x}" y="${y - 32}" font-size="10" font-weight="700" fill="#475569" text-anchor="middle">
                        Resource
                    </text>
                </g>
            `;
        }

        return `
            <svg class="rag-svg" viewBox="0 0 ${width} ${height}">
                <defs>
                    <!-- Allocation Arrowhead (Teal) -->
                    <marker id="rag-arrow-alloc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#0D9488" />
                    </marker>
                    <!-- Request Arrowhead (Amber) -->
                    <marker id="rag-arrow-req" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#D97706" />
                    </marker>
                    <!-- Cycle Arrowhead (Bold Red) -->
                    <marker id="rag-arrow-cycle" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#DC2626" />
                    </marker>
                    <!-- Dimmed Arrowhead -->
                    <marker id="rag-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 1 L 10 5 L 0 9 z" fill="#CBD5E1" />
                    </marker>
                </defs>

                <!-- Section Column Background Labels -->
                <text x="${xProcess}" y="24" font-size="11" font-weight="700" fill="#64748B" text-anchor="middle" letter-spacing="0.05em">
                    PROCESSES (CIRCLES)
                </text>
                <text x="${xResource}" y="24" font-size="11" font-weight="700" fill="#64748B" text-anchor="middle" letter-spacing="0.05em">
                    RESOURCES (BOXES)
                </text>

                <!-- Edges -->
                ${edgesSvg}

                <!-- Nodes -->
                ${processNodesSvg}
                ${resourceNodesSvg}
            </svg>
        `;
    },

    // -------------------------------------------------------------------------
    // RENDER MAIN RECOVERY PAGE
    // -------------------------------------------------------------------------
    renderRecoveryPage() {
        const container = document.getElementById('view-recovery');
        if (!container) return;

        // Initialize snapshot if not yet set
        if (!this.initialSnapshot) {
            this.initSimulatorState('classic');
            return;
        }

        const n = this.simData.n;
        const r = this.simData.r;
        const labels = this.simData.resourceLabels;
        const initialDet = this.initialDetection;
        const isInitialDeadlock = initialDet ? initialDet.isDeadlocked : false;
        const deadlockedPids = initialDet ? initialDet.deadlockedProcesses : [];

        // Determine current display state based on currentStep:
        // Steps 1 to 4 show pre-mutation state.
        // Steps 5 to 7 show post-mutation / recovery state.
        const isPostMutation = this.currentStep >= 5;

        // Active matrices for rendering the graph and tables
        let displayAlloc = this.initialSnapshot.alloc;
        let displayRequest = this.initialSnapshot.request;
        let displayAvailable = this.initialSnapshot.available;
        let displayDeadlockedPids = deadlockedPids;

        if (isPostMutation && this.recoveryResult) {
            displayAlloc = this.recoveryResult.updatedAlloc;
            displayRequest = this.recoveryResult.updatedRequest;
            displayAvailable = this.recoveryResult.updatedAvailable;
            displayDeadlockedPids = this.recoveryResult.remainingDeadlockedProcesses;
        }

        // Timeline Step Titles
        const timelineSteps = [
            { num: 1, title: '1. Detect Deadlock' },
            { num: 2, title: '2. Select Victim' },
            { num: 3, title: '3. Held Inventory' },
            { num: 4, title: '4. Reclaim Resources' },
            { num: 5, title: '5. Abort Process' },
            { num: 6, title: '6. Re-detect in C' },
            { num: 7, title: '7. Final Verdict' }
        ];

        let html = `
            <!-- Top Simulator Controls & Presets Header -->
            <div class="card" style="margin-bottom: 20px;">
                <div class="card-header">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--status-deadlock-bg); color: var(--status-deadlock);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        </div>
                        <div>
                            <h3>Deadlock Recovery Simulator & Graph Visualizer</h3>
                            <p>Step-by-step process termination, resource reclamation, and C-verified circular wait resolution</p>
                        </div>
                    </div>

                    <!-- Preset Selector Buttons -->
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.initSimulatorState('classic')" title="P0 and P1 in circular deadlock; terminating 1 breaks cycle">
                            Classic Circular (P0 ↔ P1)
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.initSimulatorState('complex')" title="3-process complex deadlock where 1 termination leaves partial deadlock">
                            Complex 3-Process Case
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.initSimulatorState('nodeadlock')" title="System has no deadlock">
                            No Deadlock Case
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.initSimulatorState('sync')" title="Sync matrices from Deadlock Detection page">
                            Sync from Detection Page
                        </button>
                    </div>
                </div>

                <!-- 7-Stage Interactive Recovery Timeline Bar -->
                <div class="recovery-timeline-bar">
                    ${timelineSteps.map((st, idx) => {
                        const isCur = this.currentStep === st.num;
                        const isDone = this.currentStep > st.num;
                        let itemClass = 'timeline-step-item';
                        if (isCur) itemClass += ' active';
                        if (isDone) itemClass += ' completed';

                        return `
                            <div class="${itemClass}" onclick="RecoveryUI.jumpToStep(${st.num})">
                                <span class="timeline-step-number">${isDone ? '✓' : st.num}</span>
                                <span>${st.title}</span>
                            </div>
                            ${idx < timelineSteps.length - 1 ? '<span class="timeline-arrow">›</span>' : ''}
                        `;
                    }).join('')}
                </div>

                <!-- Step Controls Bar -->
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">
                            Stage: <strong style="color: var(--primary-blue);">Step ${this.currentStep} of 7</strong>
                        </span>
                        ${this.selectedVictim !== null ? `
                            <span style="font-size: 0.78rem; background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
                                Target Victim: P${this.selectedVictim}
                            </span>
                        ` : ''}
                    </div>

                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.prevStep()" ${this.currentStep === 1 ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="15 18 9 12 15 6"/></svg>
                            Previous Step
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.nextStep()" ${this.currentStep === 7 ? 'disabled' : ''}>
                            Next Step
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="RecoveryUI.runFullRecovery()" ${!isInitialDeadlock ? 'disabled' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Run Recovery
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="RecoveryUI.resetSimulator()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            <!-- DEADLOCK RESOURCE ALLOCATION GRAPH (RAG) -->
            <div class="rag-graph-card">
                <div class="rag-header">
                    <div>
                        <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                            <span>Resource-Allocation Graph (RAG)</span>
                            ${isInitialDeadlock && !isPostMutation ? `
                                <span style="background: var(--status-deadlock-bg); color: var(--status-deadlock); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
                                    Circular Wait Highlighted in Red
                                </span>
                            ` : (isPostMutation && (!this.recoveryResult || !this.recoveryResult.isDeadlockedAfterRecovery)) ? `
                                <span style="background: var(--status-safe-bg); color: var(--status-safe); font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; font-weight: 700;">
                                    Cycle Broken & Resolved
                                </span>
                            ` : ''}
                        </h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary);">
                            Directed bipartite graph: Resource → Process (Allocation) | Process → Resource (Request). Cycles prove circular wait.
                        </p>
                    </div>
                </div>

                <div class="rag-svg-wrap">
                    ${this.generateRagSvg(
                        displayAlloc,
                        displayRequest,
                        displayAvailable,
                        displayDeadlockedPids,
                        this.terminatedProcesses,
                        this.selectedVictim
                    )}
                </div>

                <!-- Legend -->
                <div class="rag-legend">
                    <span class="legend-item"><span class="legend-circle"></span> Process Node ($P_i$)</span>
                    <span class="legend-item"><span class="legend-square"></span> Resource Node ($R_j$)</span>
                    <span class="legend-item"><span class="legend-line alloc"></span> Allocation Edge ($R \to P$)</span>
                    <span class="legend-item"><span class="legend-line request"></span> Request Edge ($P \to R$)</span>
                    <span class="legend-item"><span class="legend-line cycle"></span> Circular Wait Cycle (Red)</span>
                </div>
            </div>

            <!-- STAGE SPECIFIC CARD CONTENT -->
            ${this.renderStageContent(n, r, labels, isInitialDeadlock, deadlockedPids, isPostMutation)}

            <!-- BEFORE AND AFTER TABLES (Available & Alloc Reconciliation) -->
            ${this.renderReconciliationTables(n, r, labels, isPostMutation)}

            <!-- CONFIRMATION MODAL -->
            <div id="recovery-confirm-modal" class="modal-overlay">
                <div class="modal-dialog">
                    <div class="modal-header">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--status-deadlock)">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <h3 class="modal-title">Confirm Process Termination</h3>
                    </div>
                    <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 14px;">
                        Are you sure you want to abort <strong>Process P<span id="modal-target-pid"></span></strong>?
                    </p>
                    <p style="font-size: 0.85rem; color: var(--text-main); background: #FEF2F2; padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid #FEE2E2; line-height: 1.5;">
                        Terminating this process will immediately revoke all its currently held resource instances, returning them to the system Available pool. Its pending requests will be wiped to break the circular dependency.
                    </p>
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="RecoveryUI.closeModal()">Cancel</button>
                        <button class="btn btn-danger" onclick="RecoveryUI.confirmTerminationModal()">
                            Yes, Terminate Process
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    // -------------------------------------------------------------------------
    // RENDER CONTENT FOR CURRENT TIMELINE STAGE (1 to 7)
    // -------------------------------------------------------------------------
    renderStageContent(n, r, labels, isInitialDeadlock, deadlockedPids, isPostMutation) {
        const step = this.currentStep;
        const victim = this.selectedVictim;

        if (step === 1) {
            // STEP 1: DETECT DEADLOCK
            if (!isInitialDeadlock) {
                return `
                    <div class="card">
                        <div class="status-banner safe" style="margin-bottom: 0;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                            <div>
                                <h4 style="font-weight: 700; font-size: 1.05rem;">No Deadlock Detected</h4>
                                <p style="font-size: 0.88rem; margin-top: 4px;">
                                    The C multi-instance detection engine confirms that all processes can finish with currently available resources. No recovery action is required.
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }

            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 1: Deadlock Diagnosis & Cycle Identification</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Identifies permanently blocked processes via multi-instance detection in C</p>
                            </div>
                        </div>
                        <span class="badge-status badge-deadlocked">Deadlock Confirmed</span>
                    </div>

                    <div class="status-banner deadlock" style="margin-bottom: 16px;">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div>
                            <h4 style="font-weight: 700;">Deadlocked Processes: { ${deadlockedPids.map(p => `P${p}`).join(', ')} }</h4>
                            <p style="font-size: 0.88rem; margin-top: 2px;">
                                These processes are in circular wait. Each process is holding at least one resource and waiting for another resource held by a process in the cycle.
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end;">
                        <button class="btn btn-primary" onclick="RecoveryUI.nextStep()">
                            Proceed to Step 2: Select Victim Process
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 2) {
            // STEP 2: SELECT VICTIM PROCESS
            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 2: Select Process to Terminate (Victim Selection)</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Choose which process to abort to break the circular dependency cycle</p>
                            </div>
                        </div>
                    </div>

                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">
                        Select a deadlocked process below. In operating systems, victims are typically chosen based on lowest priority, fewest resources held, or shortest remaining CPU time.
                    </p>

                    <div class="victim-cards-grid">
                        ${deadlockedPids.map(pid => {
                            const isSel = victim === pid;
                            const allocRow = this.initialSnapshot.alloc[pid];
                            const reqRow = this.initialSnapshot.request[pid];
                            const totalAlloc = allocRow.reduce((a, b) => a + b, 0);

                            return `
                                <div class="victim-card ${isSel ? 'selected' : ''}" onclick="RecoveryUI.selectVictim(${pid})">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <span style="font-size: 1.05rem; font-weight: 700; font-family: monospace; color: var(--text-main);">Process P${pid}</span>
                                        <input type="radio" name="victim-choice" ${isSel ? 'checked' : ''} style="cursor: pointer;">
                                    </div>
                                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                                        <strong>Held Allocation:</strong> [${allocRow.join(', ')}] (${totalAlloc} total instances)
                                    </div>
                                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                                        <strong>Pending Request:</strong> [${reqRow.join(', ')}]
                                    </div>
                                    <div style="font-size: 0.78rem; color: ${isSel ? '#DC2626' : 'var(--primary-blue)'}; font-weight: 600; margin-top: 4px;">
                                        ${isSel ? '✓ Selected as Victim' : 'Click to Select as Victim'}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-danger" onclick="RecoveryUI.openModal(${victim})">
                            Confirm Victim P${victim} & Proceed
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 3) {
            // STEP 3: DISPLAY SELECTED PROCESS'S CURRENT ALLOCATED RESOURCES
            const allocRow = this.initialSnapshot.alloc[victim];
            const reqRow = this.initialSnapshot.request[victim];

            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 3: Inventory of Victim Process P${victim}</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Detailed breakdown of resources that will be seized upon termination</p>
                            </div>
                        </div>
                        <span class="badge-status badge-deadlocked">Target: P${victim}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 16px;">
                        <div style="background: #FAFBFD; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
                            <h5 style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Currently Held Allocations</h5>
                            <div style="display: flex; gap: 8px;">
                                ${labels.map((lbl, idx) => `
                                    <div style="padding: 6px 12px; background: white; border: 1px solid #CBD5E1; border-radius: 6px; text-align: center;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${lbl}</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: var(--teal-accent);">${allocRow[idx]}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="background: #FAFBFD; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
                            <h5 style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 8px;">Outstanding Requests to Cancel</h5>
                            <div style="display: flex; gap: 8px;">
                                ${labels.map((lbl, idx) => `
                                    <div style="padding: 6px 12px; background: white; border: 1px solid #CBD5E1; border-radius: 6px; text-align: center;">
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${lbl}</div>
                                        <div style="font-size: 1.15rem; font-weight: 700; color: #D97706;">${reqRow[idx]}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--pale-blue); border: 1px solid var(--light-blue); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; color: #1E3A8A; margin-bottom: 16px;">
                        <strong>OS Theory:</strong> By terminating $P_{${victim}}$, the operating system breaks <strong>Hold and Wait</strong> (Condition 2) and forcibly exercises <strong>Preemption</strong> (Condition 3).
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-primary" onclick="RecoveryUI.nextStep()">
                            Proceed to Step 4: Reclaim Resources
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 4) {
            // STEP 4: RECLAIM RESOURCES INTO AVAILABLE POOL
            const availBefore = this.initialSnapshot.available;
            const reclaimed = this.initialSnapshot.alloc[victim];
            const availAfter = availBefore.map((v, idx) => v + reclaimed[idx]);

            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 4: Resource Release Calculation</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Transfers reclaimed allocations from victim process to the global Available pool</p>
                            </div>
                        </div>
                        <span class="badge-status badge-active">Available Update</span>
                    </div>

                    <div style="display: flex; align-items: center; justify-content: center; gap: 14px; padding: 20px; background: #F8FAFC; border: 1px solid var(--border-color); border-radius: var(--radius-sm); margin-bottom: 16px; flex-wrap: wrap;">
                        <div style="text-align: center;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); display: block;">Available Before</span>
                            <span style="font-size: 1.25rem; font-weight: 700; font-family: monospace; color: var(--text-main);">
                                [${availBefore.join(', ')}]
                            </span>
                        </div>

                        <span style="font-size: 1.4rem; font-weight: 700; color: var(--teal-accent);">+</span>

                        <div style="text-align: center;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: var(--teal-accent); display: block;">Reclaimed from P${victim}</span>
                            <span style="font-size: 1.25rem; font-weight: 700; font-family: monospace; color: var(--teal-accent);">
                                [${reclaimed.join(', ')}]
                            </span>
                        </div>

                        <span style="font-size: 1.4rem; font-weight: 700; color: var(--primary-blue);">=</span>

                        <div style="text-align: center;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: var(--primary-blue); display: block;">New Available Vector</span>
                            <span style="font-size: 1.25rem; font-weight: 700; font-family: monospace; color: var(--primary-blue);">
                                [${availAfter.join(', ')}]
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-primary" onclick="RecoveryUI.executeStep5()">
                            Proceed to Step 5: Mutate State & Abort Process
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 5) {
            // STEP 5: STATE MUTATION & PROCESS REMOVAL
            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 5: Process P${victim} Terminated</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Victim removed from active simulation and resources restored to Available vector</p>
                            </div>
                        </div>
                        <span class="badge-status badge-terminated">P${victim} Terminated</span>
                    </div>

                    <div class="status-banner info" style="margin-bottom: 16px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                        <div>
                            <h4 style="font-weight: 700;">State Mutated</h4>
                            <p style="font-size: 0.88rem;">
                                Process P${victim}'s allocation and request rows have been reset to 0. Notice on the Resource-Allocation Graph above that P${victim} is now marked as TERMINATED and its circular wait edge has been severed.
                            </p>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-primary" onclick="RecoveryUI.executeStep6()">
                            Proceed to Step 6: Run C Detection
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 6) {
            // STEP 6: POST-RECOVERY C DEADLOCK DETECTION TRACE
            const trace = this.recoveryResult ? this.recoveryResult.detectionTrace : [];

            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 6: Re-running Deadlock Detection in C</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Validates whether remaining processes can now execute to completion</p>
                            </div>
                        </div>
                        <span class="badge-status badge-active">C Engine Trace</span>
                    </div>

                    ${trace && trace.length > 0 ? `
                        <div class="table-container" style="margin-bottom: 16px;">
                            <table class="os-table">
                                <thead>
                                    <tr>
                                        <th>Step</th>
                                        <th>Process</th>
                                        <th>Work Before</th>
                                        <th>Outstanding Request</th>
                                        <th>Request ≤ Work?</th>
                                        <th>Work After Release</th>
                                        <th>Execution Note</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${trace.map(st => `
                                        <tr>
                                            <td>${st.stepNumber}</td>
                                            <td class="process-label">P${st.process}</td>
                                            <td style="font-family: monospace;">[${st.workBefore.join(', ')}]</td>
                                            <td style="font-family: monospace;">[${st.request.join(', ')}]</td>
                                            <td style="font-weight: 700; color: ${st.canComplete ? 'var(--status-safe)' : 'var(--status-deadlock)'};">
                                                ${st.canComplete ? '✔ YES' : '✘ NO'}
                                            </td>
                                            <td style="font-family: monospace; font-weight: 700;">[${st.workAfter.join(', ')}]</td>
                                            <td style="text-align: left; font-size: 0.8rem; color: var(--text-secondary);">${st.note}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : `
                        <p style="padding: 16px; color: var(--text-secondary);">No detection trace generated.</p>
                    `}

                    <div style="display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-primary" onclick="RecoveryUI.nextStep()">
                            Proceed to Step 7: Final Verdict
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                    </div>
                </div>
            `;
        } else if (step === 7) {
            // STEP 7: FINAL OUTCOME & VERDICT
            const res = this.recoveryResult;
            const isDeadlocked = res ? res.isDeadlockedAfterRecovery : false;

            let verdictBanner = '';
            if (!isDeadlocked) {
                verdictBanner = `
                    <div class="status-banner safe" style="margin-bottom: 16px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <div>
                            <h4 style="font-weight: 700; font-size: 1.15rem;">DEADLOCK RESOLVED</h4>
                            <p style="font-size: 0.9rem; margin-top: 4px;">
                                ${res ? res.explanation : 'The deadlock cycle has been eliminated and all remaining processes can complete.'}
                            </p>
                            ${res && res.resolvedSequence ? `
                                <div style="margin-top: 8px; font-weight: 600; font-size: 0.84rem; color: #166534;">
                                    Remaining Safe Execution Sequence: ${res.resolvedSequence.map(p => `P${p}`).join(' → ')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                verdictBanner = `
                    <div class="status-banner deadlock" style="margin-bottom: 16px;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <div style="flex: 1;">
                            <h4 style="font-weight: 700; font-size: 1.15rem;">DEADLOCK STILL EXISTS</h4>
                            <p style="font-size: 0.9rem; margin-top: 4px;">
                                ${res ? res.explanation : 'Deadlock cycle still persists among remaining processes.'}
                            </p>
                            <p style="font-size: 0.8rem; margin-top: 4px; color: #7F1D1D;">
                                Terminating P${victim} was insufficient to resolve this complex multi-cycle deadlock. Another recovery action is required.
                            </p>
                        </div>
                        <button class="btn btn-danger btn-sm" onclick="RecoveryUI.prepareNextVictimTermination()">
                            Terminate Another Process
                        </button>
                    </div>
                `;
            }

            return `
                <div class="card">
                    <div class="card-header" style="margin-bottom: 12px;">
                        <div class="card-title">
                            <div>
                                <h4 style="font-size: 1.05rem; font-weight: 700;">Step 7: Final Recovery Evaluation & Audit</h4>
                                <p style="font-size: 0.82rem; color: var(--text-secondary);">Authoritative C detection outcome after process termination</p>
                            </div>
                        </div>
                    </div>

                    ${verdictBanner}

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="RecoveryUI.prevStep()">Back</button>
                        <button class="btn btn-secondary" onclick="RecoveryUI.resetSimulator()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Reset to Initial State
                        </button>
                    </div>
                </div>
            `;
        }

        return '';
    },

    // -------------------------------------------------------------------------
    // RENDER BEFORE & AFTER RESOURCE RECONCILIATION TABLES
    // -------------------------------------------------------------------------
    renderReconciliationTables(n, r, labels, isPostMutation) {
        const victim = this.selectedVictim;
        const initialAvail = this.initialSnapshot.available;
        const reclaimed = victim !== null ? this.initialSnapshot.alloc[victim] : Array(r).fill(0);
        const updatedAvail = this.recoveryResult ? this.recoveryResult.updatedAvailable : initialAvail.map((v, j) => v + reclaimed[j]);

        const initialAlloc = this.initialSnapshot.alloc;
        const updatedAlloc = this.recoveryResult ? this.recoveryResult.updatedAlloc : initialAlloc;
        const initialDeadlocked = this.initialDetection ? this.initialDetection.deadlockedProcesses : [];
        const remainingDeadlocked = this.recoveryResult ? this.recoveryResult.remainingDeadlockedProcesses : initialDeadlocked;

        return `
            <!-- Table 1: Available Resources Reconciliation -->
            <div class="card" style="margin-top: 20px;">
                <div class="card-header" style="margin-bottom: 12px;">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--teal-light); color: var(--teal-accent);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        </div>
                        <div>
                            <h4 style="font-size: 1.05rem; font-weight: 700;">Available Resources: Before vs After Recovery</h4>
                            <p style="font-size: 0.82rem; color: var(--text-secondary);">Direct reconciliation of physical resource release into system Available vector</p>
                        </div>
                    </div>
                </div>

                <div class="table-container" style="margin-bottom: 24px;">
                    <table class="os-table">
                        <thead>
                            <tr>
                                <th>Resource Type</th>
                                <th>Available Before Recovery</th>
                                <th>Released by Terminated Process</th>
                                <th>Available After Recovery</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${labels.map((lbl, j) => `
                                <tr>
                                    <td style="font-weight: 700; color: var(--primary-blue); font-family: monospace;">${lbl}</td>
                                    <td style="font-family: monospace;">${initialAvail[j]}</td>
                                    <td style="font-family: monospace; font-weight: 700; color: var(--teal-accent);">
                                        ${victim !== null ? `+${reclaimed[j]}` : '0'}
                                    </td>
                                    <td style="font-family: monospace; font-weight: 700; color: ${isPostMutation ? 'var(--status-safe)' : 'var(--text-main)'};">
                                        ${isPostMutation ? updatedAvail[j] : `${initialAvail[j]} (pending)`}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Table 2: Process Allocation Matrix & Status Transition -->
                <div class="card-header" style="margin-bottom: 12px;">
                    <div class="card-title">
                        <div class="card-title-icon" style="background: var(--pale-blue); color: var(--primary-blue);">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                        </div>
                        <div>
                            <h4 style="font-size: 1.05rem; font-weight: 700;">Process Allocation Matrix & State Transition</h4>
                            <p style="font-size: 0.82rem; color: var(--text-secondary);">Shows status before abortion vs status after termination and resource preemption</p>
                        </div>
                    </div>
                </div>

                <div class="table-container" style="margin-bottom: 0;">
                    <table class="os-table">
                        <thead>
                            <tr>
                                <th rowspan="2">Process</th>
                                <th colspan="${r}">Allocation Before</th>
                                <th colspan="${r}">Allocation After</th>
                                <th rowspan="2">Status Before</th>
                                <th rowspan="2">Status After</th>
                            </tr>
                            <tr>
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                                ${labels.map(l => `<th>${l}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from({ length: n }, (_, i) => {
                                const isTerm = this.terminatedProcesses.includes(i) || (isPostMutation && i === victim);
                                const isDeadBefore = initialDeadlocked.includes(i);
                                const isDeadAfter = isPostMutation ? remainingDeadlocked.includes(i) : isDeadBefore;

                                let rowClass = '';
                                if (isTerm) rowClass = 'table-row-terminated';

                                return `
                                    <tr class="${rowClass}">
                                        <td class="process-label">P${i}</td>
                                        <!-- Alloc Before -->
                                        ${initialAlloc[i].map(v => `<td>${v}</td>`).join('')}
                                        <!-- Alloc After -->
                                        ${isPostMutation 
                                            ? updatedAlloc[i].map(v => `<td style="font-weight: 700;">${v}</td>`).join('')
                                            : initialAlloc[i].map(v => `<td style="color: var(--text-muted);">${v}</td>`).join('')}
                                        <!-- Status Before -->
                                        <td>
                                            <span class="badge-status ${isDeadBefore ? 'badge-deadlocked' : 'badge-active'}">
                                                ${isDeadBefore ? 'DEADLOCKED' : 'ACTIVE'}
                                            </span>
                                        </td>
                                        <!-- Status After -->
                                        <td>
                                            ${isTerm ? `
                                                <span class="badge-status badge-terminated">TERMINATED</span>
                                            ` : isPostMutation ? (
                                                isDeadAfter ? `
                                                    <span class="badge-status badge-deadlocked">DEADLOCKED</span>
                                                ` : `
                                                    <span class="badge-status badge-resolved">RESOLVED</span>
                                                `
                                            ) : `
                                                <span class="badge-status badge-active">PENDING</span>
                                            `}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // -------------------------------------------------------------------------
    // STEP CONTROLS & INTERACTIVE ACTIONS
    // -------------------------------------------------------------------------
    nextStep() {
        if (this.currentStep < 7) {
            if (this.currentStep === 4) {
                this.executeStep5();
            } else if (this.currentStep === 5) {
                this.executeStep6();
            } else {
                this.currentStep++;
                this.renderRecoveryPage();
            }
        }
    },

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.renderRecoveryPage();
        }
    },

    jumpToStep(targetStep) {
        // If jumping to step 5 or later, execute backend recovery first if not done
        if (targetStep >= 5 && !this.recoveryResult) {
            this.executeRecoveryBackend(() => {
                this.currentStep = targetStep;
                this.renderRecoveryPage();
            });
        } else {
            this.currentStep = targetStep;
            this.renderRecoveryPage();
        }
    },

    selectVictim(pid) {
        if (this.terminatedProcesses.includes(pid)) return; // Already terminated
        this.selectedVictim = pid;
        this.renderRecoveryPage();
    },

    openModal(pid) {
        this.selectedVictim = pid;
        const modal = document.getElementById('recovery-confirm-modal');
        const span = document.getElementById('modal-target-pid');
        if (span) span.innerText = pid;
        if (modal) modal.classList.add('active');
    },

    closeModal() {
        const modal = document.getElementById('recovery-confirm-modal');
        if (modal) modal.classList.remove('active');
    },

    confirmTerminationModal() {
        this.closeModal();
        this.currentStep = 3;
        this.renderRecoveryPage();
        App.showGlobalAlert(`Target victim confirmed: Process P${this.selectedVictim}`, 'info');
    },

    async executeStep5() {
        // Run C recovery to mutate state and obtain results
        await this.executeRecoveryBackend(() => {
            this.currentStep = 5;
            this.renderRecoveryPage();
            App.showGlobalAlert(`Process P${this.selectedVictim} terminated and resources reclaimed.`, 'info');
        });
    },

    async executeStep6() {
        if (!this.recoveryResult) {
            await this.executeRecoveryBackend(() => {
                this.currentStep = 6;
                this.renderRecoveryPage();
            });
        } else {
            this.currentStep = 6;
            this.renderRecoveryPage();
        }
    },

    async runFullRecovery() {
        if (this.selectedVictim === null) {
            App.showGlobalAlert('No victim process selected.', 'warning');
            return;
        }

        App.showGlobalAlert(`Executing full recovery termination for P${this.selectedVictim} in C...`, 'info');
        await this.executeRecoveryBackend(() => {
            this.currentStep = 7;
            this.renderRecoveryPage();
            if (this.recoveryResult && !this.recoveryResult.isDeadlockedAfterRecovery) {
                App.showGlobalAlert('DEADLOCK RESOLVED: System safely cleared!', 'success');
            } else {
                App.showGlobalAlert('DEADLOCK STILL EXISTS: Further recovery needed.', 'warning');
            }
        });
    },

    async executeRecoveryBackend(callback) {
        try {
            const res = await API.recoverDeadlock({
                n: this.simData.n,
                r: this.simData.r,
                alloc: this.simData.alloc,
                request: this.simData.request,
                available: this.simData.available,
                victim: this.selectedVictim
            });

            this.recoveryResult = res;
            if (!this.terminatedProcesses.includes(this.selectedVictim)) {
                this.terminatedProcesses.push(this.selectedVictim);
            }

            if (callback) callback();
        } catch (err) {
            App.showGlobalAlert(`Recovery Error: ${err.message}`, 'error');
        }
    },

    prepareNextVictimTermination() {
        if (!this.recoveryResult || !this.recoveryResult.remainingDeadlockedProcesses) return;
        const remaining = this.recoveryResult.remainingDeadlockedProcesses;
        if (remaining.length === 0) return;

        // Update working simData with the mutated state
        this.simData.alloc = this.recoveryResult.updatedAlloc;
        this.simData.request = this.recoveryResult.updatedRequest;
        this.simData.available = this.recoveryResult.updatedAvailable;

        // New snapshot based on current state
        this.initialSnapshot = {
            n: this.simData.n,
            r: this.simData.r,
            resourceLabels: [...this.simData.resourceLabels],
            alloc: this.simData.alloc.map(r => [...r]),
            request: this.simData.request.map(r => [...r]),
            available: [...this.simData.available]
        };

        this.selectedVictim = remaining[0];
        this.initialDetection = {
            isDeadlocked: true,
            deadlockedProcesses: [...remaining]
        };
        this.recoveryResult = null;
        this.currentStep = 2; // Jump to Step 2 to select next victim
        this.renderRecoveryPage();
        App.showGlobalAlert(`Select the next process to terminate from remaining deadlocked set: { ${remaining.map(p => `P${p}`).join(', ')} }`, 'info');
    },

    resetSimulator() {
        if (!this.initialSnapshot) return;
        this.simData.alloc = this.initialSnapshot.alloc.map(r => [...r]);
        this.simData.request = this.initialSnapshot.request.map(r => [...r]);
        this.simData.available = [...this.initialSnapshot.available];
        this.currentStep = 1;
        this.terminatedProcesses = [];
        this.recoveryResult = null;
        this.runInitialDetection();
        App.showGlobalAlert('Recovery Simulator reset to initial state.', 'info');
    }
};

window.RecoveryUI = RecoveryUI;
