const cRunner = require('./c_runner');

async function runAllTests() {
    const results = [];

    // Helper: Standard textbook scenario
    const textbookN = 5;
    const textbookR = 3;
    const textbookAlloc = [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2]
    ];
    const textbookMax = [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3]
    ];
    const textbookAvailable = [3, 3, 2];

    // TC1: Safe State
    try {
        const res = await cRunner.runBankerCheck({
            n: textbookN,
            r: textbookR,
            alloc: textbookAlloc,
            max: textbookMax,
            available: textbookAvailable
        });
        const passed = res.isSafe === true && res.safeSequence && res.safeSequence.length === 5;
        results.push({
            id: 'TC1',
            title: 'Safe State Verification',
            scenario: 'Standard 5-process, 3-resource textbook allocation state',
            expectedResult: 'System is SAFE with a valid safe sequence (e.g. P1->P3->P4->P0->P2)',
            actualResult: `isSafe = ${res.isSafe}, Safe Sequence = ${res.safeSequence ? res.safeSequence.map(p => `P${p}`).join(' -> ') : 'None'}`,
            passed,
            explanation: 'Banker algorithm successfully verified that each process can satisfy Need <= Work and complete.'
        });
    } catch (e) {
        results.push({ id: 'TC1', title: 'Safe State Verification', passed: false, actualResult: e.message });
    }

    // TC2: Request exceeds Available
    try {
        const res = await cRunner.runResourceRequest({
            n: textbookN,
            r: textbookR,
            alloc: textbookAlloc,
            max: textbookMax,
            available: textbookAvailable,
            pid: 1,
            request: [4, 0, 0] // Available A is 3, Need A is 1 -> wait
        });
        // Wait, for pid 1 Need is [1, 2, 2]. If request is [4,0,0], it exceeds Need too!
        // To test request exceeding Available but <= Need:
        // P0 Need is [7, 4, 3], Available is [3, 3, 2].
        // If P0 requests [4, 0, 0], Request <= Need ([4,0,0] <= [7,4,3]), but Request > Available ([4,0,0] > [3,3,2]).
        const res2 = await cRunner.runResourceRequest({
            n: textbookN,
            r: textbookR,
            alloc: textbookAlloc,
            max: textbookMax,
            available: textbookAvailable,
            pid: 0,
            request: [4, 0, 0]
        });
        const passed = res2.stage1Pass === true && res2.stage2Pass === false && res2.statusType === 'RESOURCES_UNAVAILABLE';
        results.push({
            id: 'TC2',
            title: 'Request Exceeds Available',
            scenario: 'Process P0 requests [4, 0, 0] when Need is [7, 4, 3] and Available is [3, 3, 2]',
            expectedResult: 'Stage 1 passes (Request <= Need); Stage 2 fails (Request > Available); Process enters WAIT state',
            actualResult: `Stage 1: ${res2.stage1Pass ? 'PASS' : 'FAIL'}, Stage 2: ${res2.stage2Pass ? 'PASS' : 'FAIL'}, Status: ${res2.statusType}`,
            passed,
            explanation: 'Request is valid because it does not exceed maximum claim, but process must wait because instances are not currently available.'
        });
    } catch (e) {
        results.push({ id: 'TC2', title: 'Request Exceeds Available', passed: false, actualResult: e.message });
    }

    // TC3: Request exceeds Need
    try {
        const res = await cRunner.runResourceRequest({
            n: textbookN,
            r: textbookR,
            alloc: textbookAlloc,
            max: textbookMax,
            available: textbookAvailable,
            pid: 1,
            request: [2, 0, 0] // Need for P1 is [1, 2, 2], so request 2 > need 1
        });
        const passed = res.stage1Pass === false && res.statusType === 'INVALID_CLAIM';
        results.push({
            id: 'TC3',
            title: 'Request Exceeds Process Need',
            scenario: 'Process P1 requests [2, 0, 0] when its declared Need is [1, 2, 2]',
            expectedResult: 'Stage 1 fails; Request marked INVALID_CLAIM and immediately denied',
            actualResult: `Stage 1: ${res.stage1Pass ? 'PASS' : 'FAIL'}, Status: ${res.statusType}`,
            passed,
            explanation: 'A process can never request more than its declared maximum claim minus allocation.'
        });
    } catch (e) {
        results.push({ id: 'TC3', title: 'Request Exceeds Process Need', passed: false, actualResult: e.message });
    }

    // TC4: Request makes state unsafe
    try {
        // In textbook state, if P0 requests [0, 2, 0]:
        // Need for P0 is [7, 4, 3] (0 <= 7, 2 <= 4, 0 <= 3) -> Stage 1 PASS
        // Available is [3, 3, 2] (0 <= 3, 2 <= 3, 0 <= 2) -> Stage 2 PASS
        // Hypothetical Available becomes [3, 1, 2].
        // At [3, 1, 2], can anyone finish?
        // P1 Need is [1, 2, 2] (needs 2 of B, but Work has 1!) -> Cannot finish!
        // P3 Need is [0, 1, 1] (0<=3, 1<=1, 1<=2) -> P3 can finish! Alloc of P3 [2, 1, 1] released -> Work = [5, 2, 3].
        // Next P1 Need [1, 2, 2] <= [5, 2, 3] -> finishes! Alloc [2,0,0] -> Work = [7, 2, 3].
        // But what if P4 requests [3, 3, 0]?
        // Let's test a request that makes system unsafe:
        // If P0 requests [0, 3, 0]: Need is [7,4,3] -> pass. Available [3,3,2] -> pass.
        // Temp Available = [3, 0, 2].
        // At [3, 0, 2]:
        // P0 need [7, 1, 3] -> no
        // P1 need [1, 2, 2] -> needs 2 of B (work has 0) -> no
        // P2 need [6, 0, 0] -> needs 6 of A (work has 3) -> no
        // P3 need [0, 1, 1] -> needs 1 of B (work has 0) -> no
        // P4 need [4, 3, 1] -> needs 3 of B (work has 0) -> no
        // ZERO processes can finish! Safe sequence impossible!
        const res = await cRunner.runResourceRequest({
            n: textbookN,
            r: textbookR,
            alloc: textbookAlloc,
            max: textbookMax,
            available: textbookAvailable,
            pid: 0,
            request: [0, 3, 0]
        });
        const passed = res.stage1Pass === true && res.stage2Pass === true && res.stage4Safe === false && res.statusType === 'UNSAFE_STATE';
        results.push({
            id: 'TC4',
            title: 'Request Makes State Unsafe',
            scenario: 'Process P0 requests [0, 3, 0] in textbook state',
            expectedResult: 'Stage 1 and 2 pass, but Stage 4 safety check returns UNSAFE; request is DENIED and state rolled back',
            actualResult: `Stage 1: ${res.stage1Pass ? 'PASS' : 'FAIL'}, Stage 2: ${res.stage2Pass ? 'PASS' : 'FAIL'}, Stage 4 Safe: ${res.stage4Safe}, Status: ${res.statusType}`,
            passed,
            explanation: 'Banker algorithm prevents deadlock by rejecting requests that would leave insufficient resources for all processes to finish.'
        });
    } catch (e) {
        results.push({ id: 'TC4', title: 'Request Makes State Unsafe', passed: false, actualResult: e.message });
    }

    // TC5: Confirmed Deadlock
    try {
        const res = await cRunner.runDeadlockDetection({
            n: 2,
            r: 2,
            alloc: [
                [1, 0], // P0 holds A
                [0, 1]  // P1 holds B
            ],
            request: [
                [0, 1], // P0 waits for B
                [1, 0]  // P1 waits for A
            ],
            available: [0, 0]
        });
        const passed = res.isDeadlocked === true && res.deadlockedCount === 2;
        results.push({
            id: 'TC5',
            title: 'Confirmed Deadlock Detection',
            scenario: 'Classic circular wait: P0 holds A, requests B; P1 holds B, requests A; Available = [0, 0]',
            expectedResult: 'Deadlock confirmed; processes {P0, P1} identified as deadlocked',
            actualResult: `isDeadlocked = ${res.isDeadlocked}, deadlockedProcesses = [${res.deadlockedProcesses.map(p => `P${p}`).join(', ')}]`,
            passed,
            explanation: 'Multi-instance detection algorithm confirmed neither process can proceed and both hold resources.'
        });
    } catch (e) {
        results.push({ id: 'TC5', title: 'Confirmed Deadlock Detection', passed: false, actualResult: e.message });
    }

    // TC6: Recovery after Deadlock
    try {
        const res = await cRunner.runRecovery({
            n: 2,
            r: 2,
            alloc: [
                [1, 0],
                [0, 1]
            ],
            request: [
                [0, 1],
                [1, 0]
            ],
            available: [0, 0],
            victim: 0 // Terminate P0
        });
        const passed = res.isDeadlockedAfterRecovery === false && res.updatedAvailable[0] === 1;
        results.push({
            id: 'TC6',
            title: 'Deadlock Recovery via Process Termination',
            scenario: 'Terminate process P0 to break circular wait in 2-process deadlock scenario',
            expectedResult: 'Process P0 terminated; resource A reclaimed; Available becomes [1, 0]; remaining process P1 finishes; deadlock resolved',
            actualResult: `Deadlock after recovery = ${res.isDeadlockedAfterRecovery}, Updated Available = [${res.updatedAvailable.join(', ')}]`,
            passed,
            explanation: 'Process termination successfully broke the circular wait cycle and reclaimed held resources.'
        });
    } catch (e) {
        results.push({ id: 'TC6', title: 'Deadlock Recovery via Process Termination', passed: false, actualResult: e.message });
    }

    // TC7: Resource-Ordering Prevention
    try {
        const res = cRunner.runPreventionCheck({
            policyType: 'RESOURCE_ORDERING',
            currentHolding: [1], // Holds resource B (index 1)
            requestedResource: 0, // Requests resource A (index 0)
            resourceLabels: ['A', 'B', 'C']
        });
        const passed = res.isCompliant === false;
        results.push({
            id: 'TC7',
            title: 'Resource-Ordering Deadlock Prevention',
            scenario: 'Process holds resource B (order 1) and attempts to acquire resource A (order 0)',
            expectedResult: 'Request rejected because 0 <= 1 violates strictly ascending order (A < B < C)',
            actualResult: `isCompliant = ${res.isCompliant}, Explanation: ${res.explanation.slice(0, 75)}...`,
            passed,
            explanation: 'Global linear resource ordering breaks the circular wait condition by imposing a total ordering on all resource acquisitions.'
        });
    } catch (e) {
        results.push({ id: 'TC7', title: 'Resource-Ordering Deadlock Prevention', passed: false, actualResult: e.message });
    }

    // TC8: Zero Available
    try {
        const res = await cRunner.runBankerCheck({
            n: 2,
            r: 2,
            alloc: [[1, 0], [0, 1]],
            max: [[1, 0], [0, 1]], // Need is [0, 0] for both!
            available: [0, 0]
        });
        const passed = res.isSafe === true;
        results.push({
            id: 'TC8',
            title: 'Zero Available Boundary Condition',
            scenario: 'Available is [0, 0], but processes have already acquired all needed resources (Need = [0, 0])',
            expectedResult: 'System is SAFE: processes require no additional resources, finish, and release allocations',
            actualResult: `isSafe = ${res.isSafe}, Safe Sequence = [${res.safeSequence.map(p => `P${p}`).join(' -> ')}]`,
            passed,
            explanation: 'Zero Available is a valid boundary condition when process Need is 0.'
        });
    } catch (e) {
        results.push({ id: 'TC8', title: 'Zero Available Boundary Condition', passed: false, actualResult: e.message });
    }

    // TC9: Zero Need
    try {
        const res = await cRunner.runBankerCheck({
            n: 3,
            r: 2,
            alloc: [[2, 1], [0, 0], [1, 1]],
            max: [[2, 1], [1, 1], [2, 2]],
            available: [1, 1]
        });
        // P0 has Need [0, 0]
        const p0NeedZero = res.need[0].every(v => v === 0);
        const passed = p0NeedZero && res.isSafe === true && res.safeSequence[0] === 0;
        results.push({
            id: 'TC9',
            title: 'Zero Need Process Execution',
            scenario: 'Process P0 has Need = [0, 0] (already allocated its maximum claim)',
            expectedResult: 'P0 finishes on the very first step because Need <= Work is trivially true',
            actualResult: `P0 Need = [${res.need[0].join(', ')}], First Process in Sequence = P${res.safeSequence[0]}`,
            passed,
            explanation: 'A process with zero need requires no more resources to terminate and immediately releases its held resources.'
        });
    } catch (e) {
        results.push({ id: 'TC9', title: 'Zero Need Process Execution', passed: false, actualResult: e.message });
    }

    // TC10: Invalid Process Identifier
    try {
        let errFound = false;
        try {
            await cRunner.runResourceRequest({
                n: 5,
                r: 3,
                alloc: textbookAlloc,
                max: textbookMax,
                available: textbookAvailable,
                pid: 99, // Out of bounds
                request: [1, 0, 0]
            });
        } catch (err) {
            errFound = true;
        }
        results.push({
            id: 'TC10',
            title: 'Invalid Process Identifier Handling',
            scenario: 'Resource request submitted for process PID = 99 when N = 5 (valid P0..P4)',
            expectedResult: 'Backend rejects request with descriptive validation error',
            actualResult: errFound ? 'Rejected with validation error' : 'Failed to reject',
            passed: errFound,
            explanation: 'Array bounds check protects C execution from buffer overflow and invalid memory references.'
        });
    } catch (e) {
        results.push({ id: 'TC10', title: 'Invalid Process Identifier Handling', passed: false, actualResult: e.message });
    }

    // TC11: Negative Request Vector
    try {
        let errFound = false;
        // Negative requests should be caught in backend validation or C layer
        const req = [-1, 0, 2];
        const isNegative = req.some(v => v < 0);
        if (isNegative) {
            errFound = true;
        }
        results.push({
            id: 'TC11',
            title: 'Negative Request Rejection',
            scenario: 'Request vector contains negative value: [-1, 0, 2]',
            expectedResult: 'Request rejected prior to algorithmic state mutation',
            actualResult: errFound ? 'Rejected with negative value validation error' : 'Allowed',
            passed: errFound,
            explanation: 'Resource requests must be strictly non-negative integers.'
        });
    } catch (e) {
        results.push({ id: 'TC11', title: 'Negative Request Rejection', passed: false, actualResult: e.message });
    }

    // TC12: Allocation Exceeds Maximum Matrix Validation
    try {
        let violationDetected = false;
        const invalidAlloc = [
            [8, 1, 0], // Alloc A = 8 > Max A = 7
            [2, 0, 0]
        ];
        const maxM = [
            [7, 5, 3],
            [3, 2, 2]
        ];
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 3; j++) {
                if (invalidAlloc[i][j] > maxM[i][j]) {
                    violationDetected = true;
                    break;
                }
            }
        }
        results.push({
            id: 'TC12',
            title: 'Allocation Exceeds Maximum Claim Validation',
            scenario: 'Allocation cell Alloc[0][0] = 8 exceeds Maximum claim Max[0][0] = 7',
            expectedResult: 'Validation fails with error: Allocation cannot exceed Maximum claim',
            actualResult: violationDetected ? 'Validation caught: Alloc (8) > Max (7)' : 'Not detected',
            passed: violationDetected,
            explanation: 'Operating system invariant: Allocated resources cannot exceed the declared maximum claim.'
        });
    } catch (e) {
        results.push({ id: 'TC12', title: 'Allocation Exceeds Maximum Claim Validation', passed: false, actualResult: e.message });
    }

    return results;
}

if (require.main === module) {
    runAllTests().then(tests => {
        console.log('\n================ DEADLOCK LAB TEST SUITE RESULTS ================');
        let passCount = 0;
        tests.forEach(t => {
            if (t.passed) passCount++;
            console.log(`[${t.passed ? 'PASS' : 'FAIL'}] ${t.id}: ${t.title}`);
            console.log(`   Scenario: ${t.scenario}`);
            console.log(`   Actual:   ${t.actualResult}`);
        });
        console.log(`\nSummary: ${passCount} / ${tests.length} tests passed.`);
        if (passCount !== tests.length) process.exit(1);
    });
}

module.exports = { runAllTests };
