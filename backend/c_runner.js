const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { compileAll } = require('./compile');

const cDir = path.resolve(__dirname, '..', 'c');

// Ensure all executables exist, otherwise compile them
function ensureBinaries() {
    const required = ['banker.exe', 'resource_request.exe', 'deadlock_detection.exe', 'recovery.exe'];
    const missing = required.some(bin => !fs.existsSync(path.join(cDir, bin)));
    if (missing) {
        console.log('One or more C executables missing. Compiling...');
        compileAll();
    }
}

// Fallback algorithmic implementations of the C modules
// Used seamlessly if native C executables are blocked by OS Application Control (e.g. Smart App Control)
function runBankerFallback(payload) {
    const { n, r, alloc, max, available, total } = payload;
    const need = [];
    for (let i = 0; i < n; i++) {
        need[i] = [];
        for (let j = 0; j < r; j++) {
            need[i][j] = max[i][j] - alloc[i][j];
        }
    }

    const work = [...available];
    const finish = Array(n).fill(false);
    const sequence = [];
    const steps = [];
    let count = 0;

    while (count < n) {
        let found = false;
        for (let i = 0; i < n; i++) {
            if (!finish[i]) {
                let canFinish = true;
                let failingRes = -1;
                for (let j = 0; j < r; j++) {
                    if (need[i][j] > work[j]) {
                        canFinish = false;
                        failingRes = j;
                        break;
                    }
                }

                const stepWorkBefore = [...work];
                const stepFinishBefore = [...finish];
                const stepNeed = [...need[i]];
                const stepAlloc = [...alloc[i]];
                const stepWorkAfter = canFinish ? work.map((w, j) => w + alloc[i][j]) : [...work];
                const stepFinishAfter = finish.map((f, p) => (canFinish && p === i) ? true : f);

                steps.push({
                    stepNumber: steps.length + 1,
                    process: i,
                    canFinish,
                    failingResource: failingRes,
                    workBefore: stepWorkBefore,
                    finishBefore: stepFinishBefore,
                    need: stepNeed,
                    alloc: stepAlloc,
                    workAfter: stepWorkAfter,
                    finishAfter: stepFinishAfter,
                    note: canFinish
                        ? `Need <= Work satisfied. P${i} executes and releases allocation.`
                        : `Need > Work for resource index ${failingRes}. P${i} must wait.`
                });

                if (canFinish) {
                    for (let j = 0; j < r; j++) {
                        work[j] += alloc[i][j];
                    }
                    finish[i] = true;
                    sequence.push(i);
                    found = true;
                    count++;
                }
            }
        }
        if (!found) break;
    }

    const safe = sequence.length === n;
    return {
        success: true,
        n,
        r,
        isSafe: safe,
        alloc,
        max,
        need,
        available,
        ...(total ? { total } : {}),
        safeSequence: safe ? sequence : [],
        steps,
        explanation: safe
            ? "System is in a SAFE state. A complete execution sequence exists where every process can acquire its maximum claim, terminate, and return all held resources."
            : "System is in an UNSAFE state. No remaining process has Need <= Work, so the system cannot guarantee safe completion for all processes without risk of deadlock."
    };
}

function runResourceRequestFallback(payload) {
    const { n, r, pid, alloc, max, available, request } = payload;
    const need = [];
    for (let i = 0; i < n; i++) {
        need[i] = [];
        for (let j = 0; j < r; j++) {
            need[i][j] = max[i][j] - alloc[i][j];
        }
    }

    let stage1Pass = true;
    let stage1FailingRes = -1;
    for (let j = 0; j < r; j++) {
        if (request[j] > need[pid][j]) {
            stage1Pass = false;
            stage1FailingRes = j;
            break;
        }
    }

    let stage2Pass = true;
    let stage2FailingRes = -1;
    for (let j = 0; j < r; j++) {
        if (request[j] > available[j]) {
            stage2Pass = false;
            stage2FailingRes = j;
            break;
        }
    }

    let stage3Success = false;
    let isSafeResult = false;
    let sequence = [];
    let safetySteps = [];

    const tempAlloc = alloc.map(row => [...row]);
    const tempNeed = need.map(row => [...row]);
    const tempAvailable = [...available];

    let decision = "";
    let statusType = "";
    let explanation = "";

    if (!stage1Pass) {
        statusType = "INVALID_CLAIM";
        decision = "DENIED";
        explanation = `Request DENIED: Process P${pid} requested more than its declared maximum claim (Request > Need for resource index ${stage1FailingRes}).`;
    } else if (!stage2Pass) {
        statusType = "RESOURCES_UNAVAILABLE";
        decision = "WAIT";
        explanation = `Process P${pid} MUST WAIT: System does not currently have sufficient available instances (Request > Available for resource index ${stage2FailingRes}). Request is valid, but process must wait.`;
    } else {
        stage3Success = true;
        for (let j = 0; j < r; j++) {
            tempAvailable[j] -= request[j];
            tempAlloc[pid][j] += request[j];
            tempNeed[pid][j] -= request[j];
        }

        const safetyCheck = runBankerFallback({
            n,
            r,
            alloc: tempAlloc,
            max,
            available: tempAvailable
        });

        isSafeResult = safetyCheck.isSafe;
        sequence = safetyCheck.safeSequence;
        safetySteps = safetyCheck.steps.map(st => ({
            stepNumber: st.stepNumber,
            process: st.process,
            canFinish: st.canFinish,
            workBefore: st.workBefore,
            need: st.need,
            alloc: st.alloc,
            workAfter: st.workAfter
        }));

        if (isSafeResult) {
            statusType = "GRANTED";
            decision = "GRANTED";
            explanation = `Request GRANTED: Allocating resources leaves the system in a SAFE state. Safe sequence: ${sequence.map(p => 'P' + p).join(' -> ')}`;
        } else {
            statusType = "UNSAFE_STATE";
            decision = "DENIED";
            explanation = "Request DENIED: Allocating resources would lead to an UNSAFE state with no guaranteed completion sequence. Original system state preserved.";
        }
    }

    const finalAlloc = isSafeResult ? tempAlloc : alloc;
    const finalNeed = isSafeResult ? tempNeed : need;
    const finalAvailable = isSafeResult ? tempAvailable : available;

    return {
        success: true,
        pid,
        decision,
        statusType,
        stage1Pass,
        stage1FailingRes,
        stage2Pass,
        stage2FailingRes,
        stage3Success,
        stage4Safe: isSafeResult,
        request,
        originalAvailable: available,
        originalAllocPid: alloc[pid],
        originalNeedPid: need[pid],
        tempAvailable,
        tempAllocPid: tempAlloc[pid],
        tempNeedPid: tempNeed[pid],
        committedAlloc: finalAlloc,
        committedNeed: finalNeed,
        committedAvailable: finalAvailable,
        safeSequence: sequence,
        safetySteps,
        explanation
    };
}

function runDeadlockDetectionFallback(payload) {
    const { n, r, alloc, request, available } = payload;
    const work = [...available];
    const finish = Array(n).fill(false);

    for (let i = 0; i < n; i++) {
        const holdsAny = alloc[i].some(v => v > 0);
        if (!holdsAny) finish[i] = true;
    }

    const trace = [];
    const resolvedSequence = [];

    while (true) {
        let found = false;
        for (let i = 0; i < n; i++) {
            if (!finish[i]) {
                let canSatisfy = true;
                for (let j = 0; j < r; j++) {
                    if (request[i][j] > work[j]) {
                        canSatisfy = false;
                        break;
                    }
                }

                trace.push({
                    stepNumber: trace.length + 1,
                    process: i,
                    canComplete: canSatisfy,
                    workBefore: [...work],
                    request: [...request[i]],
                    alloc: [...alloc[i]],
                    workAfter: canSatisfy ? work.map((w, j) => w + alloc[i][j]) : [...work],
                    finishAfter: finish.map((f, p) => (canSatisfy && p === i) ? true : f),
                    note: canSatisfy
                        ? `Request <= Work. P${i} can finish and release its allocated resources.`
                        : `Request > Work. P${i} cannot be satisfied with current available resources.`
                });

                if (canSatisfy) {
                    for (let j = 0; j < r; j++) work[j] += alloc[i][j];
                    finish[i] = true;
                    resolvedSequence.push(i);
                    found = true;
                    break;
                }
            }
        }
        if (!found) break;
    }

    const deadlockedProcesses = [];
    for (let i = 0; i < n; i++) {
        if (!finish[i]) deadlockedProcesses.push(i);
    }
    const isDeadlocked = deadlockedProcesses.length > 0;

    return {
        success: true,
        isDeadlocked,
        deadlockedCount: deadlockedProcesses.length,
        deadlockedProcesses,
        resolvedSequence,
        finalFinish: finish,
        finalWork: work,
        trace,
        explanation: isDeadlocked
            ? `DEADLOCK CONFIRMED: One or more processes are permanently blocked waiting for resources held by each other. Processes { ${deadlockedProcesses.map(p => `P${p}`).join(', ')} } cannot proceed without external preemption or termination.`
            : "NO DEADLOCK: All active processes can eventually obtain their requested resources and complete execution."
    };
}

function runRecoveryFallback(payload) {
    const { n, r, victim, alloc, request, available } = payload;
    const reclaimed = [...alloc[victim]];
    const totalVictimAlloc = reclaimed.reduce((sum, v) => sum + v, 0);

    const updatedAvailable = available.map((a, j) => a + reclaimed[j]);
    const updatedAlloc = alloc.map((row, i) => i === victim ? Array(r).fill(0) : [...row]);
    const updatedRequest = request.map((row, i) => i === victim ? Array(r).fill(0) : [...row]);

    const work = [...updatedAvailable];
    const finish = Array(n).fill(false);
    finish[victim] = true;

    for (let i = 0; i < n; i++) {
        if (i !== victim) {
            const holdsAny = updatedAlloc[i].some(v => v > 0);
            if (!holdsAny) finish[i] = true;
        }
    }

    const detectionTrace = [];
    const resolvedSequence = [];

    while (true) {
        let found = false;
        for (let i = 0; i < n; i++) {
            if (!finish[i]) {
                let canSatisfy = true;
                for (let j = 0; j < r; j++) {
                    if (updatedRequest[i][j] > work[j]) {
                        canSatisfy = false;
                        break;
                    }
                }

                detectionTrace.push({
                    stepNumber: detectionTrace.length + 1,
                    process: i,
                    canComplete: canSatisfy,
                    workBefore: [...work],
                    request: [...updatedRequest[i]],
                    alloc: [...updatedAlloc[i]],
                    workAfter: canSatisfy ? work.map((w, j) => w + updatedAlloc[i][j]) : [...work],
                    finishAfter: finish.map((f, p) => (canSatisfy && p === i) ? true : f),
                    note: canSatisfy
                        ? `Request <= Work. P${i} can finish and release its resources.`
                        : `Request > Work. P${i} cannot be satisfied with current available resources.`
                });

                if (canSatisfy) {
                    for (let j = 0; j < r; j++) work[j] += updatedAlloc[i][j];
                    finish[i] = true;
                    resolvedSequence.push(i);
                    found = true;
                    break;
                }
            }
        }
        if (!found) break;
    }

    const remainingDeadlocked = [];
    for (let i = 0; i < n; i++) {
        if (i !== victim && !finish[i]) {
            remainingDeadlocked.push(i);
        }
    }
    const stillDeadlocked = remainingDeadlocked.length > 0;

    return {
        success: true,
        terminatedPid: victim,
        totalVictimAlloc,
        isDeadlockedAfterRecovery: stillDeadlocked,
        reclaimedResources: reclaimed,
        updatedAvailable,
        updatedAlloc,
        updatedRequest,
        remainingDeadlockedProcesses: remainingDeadlocked,
        resolvedSequence,
        detectionTrace,
        explanation: !stillDeadlocked
            ? `DEADLOCK RESOLVED: Terminating process P${victim} released all its held resources back to Available. The circular wait cycle was broken, and all remaining processes can now finish.`
            : `DEADLOCK STILL EXISTS: Process P${victim} was terminated and its resources reclaimed, but a deadlock cycle still persists among remaining processes { ${remainingDeadlocked.map(p => `P${p}`).join(', ')} }. Another recovery action may be needed.`
    };
}

function runFallbackAlgorithm(binaryName, inputPayload) {
    if (binaryName.includes('banker')) {
        return runBankerFallback(inputPayload);
    } else if (binaryName.includes('resource_request')) {
        return runResourceRequestFallback(inputPayload);
    } else if (binaryName.includes('deadlock_detection')) {
        return runDeadlockDetectionFallback(inputPayload);
    } else if (binaryName.includes('recovery')) {
        return runRecoveryFallback(inputPayload);
    }
    throw new Error(`No fallback algorithm available for ${binaryName}`);
}

// Generic safe executor that passes JSON string via stdin to the C binary
function executeCBinary(binaryName, inputPayload) {
    return new Promise((resolve, reject) => {
        ensureBinaries();
        const exePath = path.join(cDir, binaryName);

        if (!fs.existsSync(exePath)) {
            try {
                return resolve(runFallbackAlgorithm(binaryName, inputPayload));
            } catch (err) {
                return reject(new Error(`Compiled binary not found: ${binaryName}.`));
            }
        }

        let settled = false;
        let child;

        try {
            child = execFile(exePath, ['--json'], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (settled) return;
                settled = true;

                if (error) {
                    try {
                        return resolve(runFallbackAlgorithm(binaryName, inputPayload));
                    } catch (fallbackErr) {
                        return reject(new Error(`C Execution Error in ${binaryName}: ${error.message}`));
                    }
                }
                try {
                    const parsed = JSON.parse(stdout.trim());
                    if (parsed.error) {
                        return reject(new Error(parsed.error));
                    }
                    resolve(parsed);
                } catch (jsonErr) {
                    try {
                        resolve(runFallbackAlgorithm(binaryName, inputPayload));
                    } catch (fallbackErr) {
                        reject(new Error(`Failed to parse C program JSON output: ${stdout}\n${jsonErr.message}`));
                    }
                }
            });

            child.on('error', (err) => {
                if (settled) return;
                settled = true;
                try {
                    resolve(runFallbackAlgorithm(binaryName, inputPayload));
                } catch (fallbackErr) {
                    reject(new Error(`C Execution Error in ${binaryName}: ${err.message}`));
                }
            });

            if (child.stdin) {
                child.stdin.on('error', () => {});
                try {
                    child.stdin.write(JSON.stringify(inputPayload));
                    child.stdin.end();
                } catch (e) {
                    // Ignore stdin write error
                }
            }
        } catch (spawnErr) {
            if (settled) return;
            settled = true;
            try {
                return resolve(runFallbackAlgorithm(binaryName, inputPayload));
            } catch (fallbackErr) {
                return reject(new Error(`C Execution Error in ${binaryName}: ${spawnErr.message}`));
            }
        }
    });
}

// Banker's Algorithm check
function runBankerCheck(payload) {
    return executeCBinary('banker.exe', payload);
}

// Resource-Request check
function runResourceRequest(payload) {
    return executeCBinary('resource_request.exe', payload);
}

// Resource add / remove simulation
async function runChangeResources(payload) {
    // payload: { n, r, alloc, max, available, total, change, isAdd }
    const { n, r, alloc, max, available, total, change, isAdd } = payload;
    const newAvailable = [...available];
    const newTotal = total ? [...total] : null;

    if (isAdd) {
        for (let j = 0; j < r; j++) {
            newAvailable[j] += change[j];
            if (newTotal) newTotal[j] += change[j];
        }
    } else {
        for (let j = 0; j < r; j++) {
            if (change[j] > available[j]) {
                return {
                    success: false,
                    accepted: false,
                    reason: `Cannot remove ${change[j]} units of resource R${j}: only ${available[j]} are currently Available.`,
                    available,
                    total
                };
            }
            newAvailable[j] -= change[j];
            if (newTotal) newTotal[j] -= change[j];
        }
    }

    // Now test safety of new available vector via C banker binary
    const safetyResult = await executeCBinary('banker.exe', {
        n,
        r,
        alloc,
        max,
        available: newAvailable,
        total: newTotal
    });

    if (safetyResult.isSafe) {
        return {
            success: true,
            accepted: true,
            isAdd,
            change,
            previousAvailable: available,
            updatedAvailable: newAvailable,
            previousTotal: total,
            updatedTotal: newTotal,
            safeSequence: safetyResult.safeSequence,
            steps: safetyResult.steps,
            explanation: `Change accepted. System remains in a SAFE state with new Available resources.`
        };
    } else {
        return {
            success: true,
            accepted: false,
            isAdd,
            change,
            previousAvailable: available,
            updatedAvailable: available, // Reverted
            previousTotal: total,
            updatedTotal: total, // Reverted
            explanation: `Change REJECTED. Decreasing available resources would leave the system in an UNSAFE state. Original state preserved.`
        };
    }
}

// Deadlock Detection
function runDeadlockDetection(payload) {
    return executeCBinary('deadlock_detection.exe', payload);
}

// Deadlock Recovery
function runRecovery(payload) {
    return executeCBinary('recovery.exe', payload);
}

// Deadlock Prevention check (Resource ordering and Hold & Wait)
function runPreventionCheck(payload) {
    const { policyType, resourceOrder, processRequests, proposedRequest } = payload;

    if (policyType === 'RESOURCE_ORDERING') {
        // resourceOrder: e.g. ['A', 'B', 'C'] or indices [0, 1, 2]
        // processRequests: list of currently held or acquired resource indices
        // proposedRequest: resource index to acquire next
        const { currentHolding, requestedResource, resourceLabels } = payload;

        // Find highest order index currently held
        let maxHeld = -1;
        if (currentHolding && currentHolding.length > 0) {
            maxHeld = Math.max(...currentHolding);
        }

        const isCompliant = requestedResource > maxHeld;
        const reqName = resourceLabels ? resourceLabels[requestedResource] : `R${requestedResource}`;
        const maxHeldName = maxHeld >= 0 ? (resourceLabels ? resourceLabels[maxHeld] : `R${maxHeld}`) : 'None';

        return {
            success: true,
            policy: 'Strict Linear Resource Ordering (A < B < C)',
            requestedResource,
            requestedResourceName: reqName,
            currentlyHeldMax: maxHeld,
            currentlyHeldMaxName: maxHeldName,
            isCompliant,
            explanation: isCompliant
                ? `COMPLIANT: Request for ${reqName} (index ${requestedResource}) is strictly greater than highest currently held resource ${maxHeldName} (index ${maxHeld}). Circular wait condition cannot occur.`
                : `VIOLATION REJECTED: Request for ${reqName} (index ${requestedResource}) is <= highest currently held resource ${maxHeldName} (index ${maxHeld}). To prevent circular wait, processes must request resources in strictly ascending global order. To acquire ${reqName}, the process must first release ${maxHeldName}.`,
            tradeOffs: [
                "Eliminates Circular Wait: The 4th necessary Coffman condition for deadlock is mathematically broken.",
                "Decreased Resource Utilization: Processes may need to acquire resources earlier than needed or release and re-acquire.",
                "Reduced Concurrency: Programming flexibility is constrained by rigid global ordering."
            ]
        };
    } else if (policyType === 'HOLD_AND_WAIT_PREVENTION') {
        const { holdsAny, requestingNew } = payload;
        const isCompliant = !holdsAny; // Protocol: process can only request resources when it has NONE allocated

        return {
            success: true,
            policy: 'Conservative Hold-and-Wait Prevention (All-or-Nothing / Release Before Request)',
            isCompliant,
            explanation: isCompliant
                ? `COMPLIANT: Process currently holds 0 resources. It can request its required resource set.`
                : `VIOLATION: Process currently holds resources while requesting additional resources. To satisfy Hold-and-Wait prevention, process must release all held resources before making a new request.`,
            tradeOffs: [
                "Eliminates Hold and Wait: A process never holds one resource while waiting for another.",
                "Low Resource Utilization: Resources allocated early sit idle until execution completes.",
                "Starvation Possible: A process requiring many popular resources may wait indefinitely."
            ]
        };
    }

    return { error: 'Unknown policy type' };
}

// Viva C Code Explorer helper
function getCodeExplorations() {
    return {
        'banker.c': {
            title: "Banker's Safety Algorithm & Resource Avoidance",
            filename: "banker.c",
            path: path.join(cDir, 'banker.c'),
            summary: "Calculates Need matrix, validates Total/Available resources, and executes Dijkstra's Banker's Safety Algorithm to find a safe execution sequence.",
            functions: [
                {
                    name: "calculateNeed",
                    purpose: "Computes the remaining resource requirement for each process by subtracting currently allocated resources from maximum claim.",
                    signature: "void calculateNeed(int n, int r, int alloc[MAX_P][MAX_R], int max[MAX_P][MAX_R], int need[MAX_P][MAX_R])",
                    inputs: "n (processes count), r (resource types count), alloc matrix, max matrix",
                    outputs: "Populates the need matrix in place",
                    importantVariables: "need[i][j]: Remaining instances of resource j required by process i",
                    loopExplanation: "Nested loop: Outer loop iterates through each process i (0 to n-1); inner loop iterates through each resource type j (0 to r-1), computing need[i][j] = max[i][j] - alloc[i][j].",
                    example: "If Max = 7 and Alloc = 2 for resource A, then Need = 7 - 2 = 5.",
                    timeComplexity: "O(n × r) - Single pass through all matrix cells.",
                    spaceComplexity: "O(1) auxiliary space (modifies provided matrix in place)."
                },
                {
                    name: "calculateAvailable",
                    purpose: "Calculates the Available resource vector from Total resources and the sum of current allocations across all processes.",
                    signature: "int calculateAvailable(int n, int r, int total[MAX_R], int alloc[MAX_P][MAX_R], int available[MAX_R])",
                    inputs: "n, r, total vector, alloc matrix",
                    outputs: "Populates available vector; returns 1 on success, 0 if total < allocated",
                    importantVariables: "allocated[j]: Running sum of allocated instances for resource type j",
                    loopExplanation: "Computes total allocated per resource, then subtracts from Total[j]. If available[j] < 0, an error is reported.",
                    example: "Total A = 10, Sum of Alloc A = 7. Available A = 10 - 7 = 3.",
                    timeComplexity: "O(n × r) to sum allocations, plus O(r) to calculate Available.",
                    spaceComplexity: "O(r) auxiliary space for allocated tracking array."
                },
                {
                    name: "isSafe",
                    purpose: "Core safety algorithm. Determines if the system is in a safe state and determines a valid safe sequence of process completion.",
                    signature: "int isSafe(int n, int r, int available[MAX_R], int alloc[MAX_P][MAX_R], int need[MAX_P][MAX_R], int sequence[MAX_P], int showSteps)",
                    inputs: "n, r, available vector, alloc matrix, need matrix, sequence output buffer, showSteps flag",
                    outputs: "Returns 1 if safe (populating sequence), 0 if unsafe",
                    importantVariables: "work[j]: Working copy of available resources; finish[i]: boolean flag whether process i can safely complete",
                    loopExplanation: "1. Initializes Work = Available and Finish[i] = 0. 2. Searches for an unfinished process i where Need[i] <= Work. 3. If found, simulates process completion by releasing its resources (Work = Work + Alloc[i]), sets Finish[i] = 1, and appends i to sequence. 4. Repeats until all processes finish (SAFE) or no candidate can proceed (UNSAFE).",
                    example: "Work = [3,3,2], P1 Need = [1,2,2]. Since Need <= Work, P1 completes, releasing Alloc [2,0,0], updating Work to [5,3,2].",
                    timeComplexity: "O(n² × r) worst-case comparison loop.",
                    spaceComplexity: "O(r + n) for Work vector and Finish flags."
                },
                {
                    name: "changeResources",
                    purpose: "Safely modifies available and total system resource instances (increase or decrease) while guaranteeing that the system remains safe.",
                    signature: "void changeResources(int n, int r, int total[MAX_R], int available[MAX_R], int change[MAX_R], int add, int alloc[MAX_P][MAX_R], int need[MAX_P][MAX_R])",
                    inputs: "System state, change vector, add flag (1 = add, 0 = remove)",
                    outputs: "Commits change if resulting state is safe, or rejects and preserves original state",
                    importantVariables: "newAvailable[j], newTotal[j]: Proposed values tested against isSafe()",
                    loopExplanation: "Computes proposed resources, verifies change <= available on removal, runs isSafe() on proposed state, and only commits if safe.",
                    example: "Removing 1 instance of B: Proposed Available = [3,2,2]. If isSafe() returns 1, the reduction is committed.",
                    timeComplexity: "O(n² × r) dominated by the safety check.",
                    spaceComplexity: "O(r + n) for temporary state buffers."
                }
            ]
        },
        'resource_request.c': {
            title: "Resource-Request Algorithm Simulator",
            filename: "resource_request.c",
            path: path.join(cDir, 'resource_request.c'),
            summary: "Validates process resource requests against process Need and system Available, performs hypothetical allocation, and checks safety before granting.",
            functions: [
                {
                    name: "Stage 1: Need Check",
                    purpose: "Verifies that Request[j] <= Need[pid][j] for all resource types j.",
                    signature: "for (int j = 0; j < r; j++) if (request[j] > need[pid][j]) fail();",
                    inputs: "request vector, need matrix row for process pid",
                    outputs: "Pass or Error: Process exceeded maximum claim",
                    importantVariables: "request[j]: Requested quantity of resource j; need[pid][j]: Declared remaining need",
                    loopExplanation: "Iterates through each resource type j. If any requested quantity exceeds remaining need, the request is permanently invalid.",
                    example: "Process P1 declares Need B = 2. If it requests 3, request is rejected.",
                    timeComplexity: "O(r) comparison loop.",
                    spaceComplexity: "O(1)."
                },
                {
                    name: "Stage 2: Available Check",
                    purpose: "Verifies that Request[j] <= Available[j] for all resource types j.",
                    signature: "for (int j = 0; j < r; j++) if (request[j] > available[j]) wait();",
                    inputs: "request vector, available vector",
                    outputs: "Pass or Wait: Resources not currently available",
                    importantVariables: "available[j]: Unallocated instances currently free in system",
                    loopExplanation: "Iterates through each resource type. If available instances are insufficient, the process is queued to wait. The request is valid, but cannot be satisfied immediately.",
                    example: "Available A = 3. Process requests 4. Process must wait.",
                    timeComplexity: "O(r) comparison loop.",
                    spaceComplexity: "O(1)."
                },
                {
                    name: "Stage 3 & 4: Hypothetical Allocation & Safety Verification",
                    purpose: "Temporarily adjusts vectors and invokes Banker's Safety algorithm. If safe, commits allocation; otherwise rolls back.",
                    signature: "Available -= Request; Alloc += Request; Need -= Request; isSafeResult = runSafetyCheck();",
                    inputs: "Full system state + request",
                    outputs: "Granted with updated state, or Denied with state restored",
                    importantVariables: "tempAvailable, tempAlloc, tempNeed: Scratch state for hypothetical simulation",
                    loopExplanation: "1. Creates hypothetical state. 2. Calls runSafetyCheck(). 3. If safe, commits changes to real system. 4. If unsafe, discards hypothetical state.",
                    example: "P1 requests [1,0,2]. Temp Available becomes [2,3,0]. Safety algorithm finds safe sequence P1->P3->P4->P0->P2. Request is GRANTED.",
                    timeComplexity: "O(n² × r) due to safety verification.",
                    spaceComplexity: "O(n × r) for hypothetical matrix copies."
                }
            ]
        },
        'deadlock_detection.c': {
            title: "Multi-Instance Deadlock Detection Algorithm",
            filename: "deadlock_detection.c",
            path: path.join(cDir, 'deadlock_detection.c'),
            summary: "Detects existing deadlocks in systems with multiple resource instances using Allocation, Outstanding Request, and Available matrices.",
            functions: [
                {
                    name: "Deadlock Detection Algorithm",
                    purpose: "Identifies whether an actual deadlock exists and pinpoints exactly which processes are locked in a circular dependency.",
                    signature: "int detectDeadlock(int n, int r, int alloc[MAX_P][MAX_R], int request[MAX_P][MAX_R], int available[MAX_R])",
                    inputs: "alloc matrix, outstanding request matrix, available vector",
                    outputs: "List of deadlocked processes and step-by-step resolution sequence",
                    importantVariables: "work[j]: Tracks available resources; finish[i]: Initialized to true if alloc[i]==0, else false",
                    loopExplanation: "1. Work = Available. 2. Finish[i] = (Alloc[i] == 0). Processes holding zero resources cannot cause deadlock. 3. Looks for unfinished process whose Request <= Work. If found, reclaims its allocation and sets Finish[i] = 1. 4. Any process with Finish[i] == 0 at the end is confirmed deadlocked.",
                    example: "P0 holds A, requests B. P1 holds B, requests A. Available = [0,0]. Neither can proceed. Both Finish flags remain 0 -> DEADLOCK.",
                    timeComplexity: "O(n² × r) worst case.",
                    spaceComplexity: "O(r + n) for Work vector and Finish flags."
                }
            ]
        },
        'recovery.c': {
            title: "Deadlock Recovery via Process Termination",
            filename: "recovery.c",
            path: path.join(cDir, 'recovery.c'),
            summary: "Terminates a selected deadlocked process, reclaims all held resource instances, clears its requests, and verifies if the remaining system is free of deadlock.",
            functions: [
                {
                    name: "terminateAndRecover",
                    purpose: "Simulates abortion of a victim process to break the circular wait cycle and restores system progress.",
                    signature: "void terminateAndRecover(int n, int r, int victim, int alloc[MAX_P][MAX_R], int request[MAX_P][MAX_R], int available[MAX_R])",
                    inputs: "victim process ID, alloc matrix, request matrix, available vector",
                    outputs: "Reclaimed resource quantities, updated Available, and new detection result",
                    importantVariables: "reclaimed[j]: Quantities returned to Available pool from victim's Alloc",
                    loopExplanation: "1. Loops through victim's allocation and adds to Available. 2. Sets victim's Alloc and Request to 0. 3. Re-runs detection algorithm to confirm if deadlock is broken.",
                    example: "Terminating P0 frees 1 instance of A. Now P1's request for A can be satisfied. P1 finishes and deadlock is broken.",
                    timeComplexity: "O(n² × r) due to re-running detection algorithm.",
                    spaceComplexity: "O(r + n) for state update buffers."
                }
            ]
        }
    };
}

module.exports = {
    runBankerCheck,
    runResourceRequest,
    runChangeResources,
    runDeadlockDetection,
    runRecovery,
    runPreventionCheck,
    getCodeExplorations
};
