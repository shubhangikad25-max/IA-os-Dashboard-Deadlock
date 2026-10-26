const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cRunner = require('./c_runner');
const { runAllTests } = require('./test_suite');
const { getGccPath } = require('./compile');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------------------
// VALIDATION HELPERS
// ---------------------------------------------------------------------------
function validateDimensions(n, r) {
    if (typeof n !== 'number' || n < 1 || n > 50) {
        return 'Process count N must be an integer between 1 and 50.';
    }
    if (typeof r !== 'number' || r < 1 || r > 20) {
        return 'Resource count R must be an integer between 1 and 20.';
    }
    return null;
}

function validateMatrix(mat, n, r, name) {
    if (!Array.isArray(mat) || mat.length !== n) {
        return `Matrix ${name} must have exactly ${n} rows.`;
    }
    for (let i = 0; i < n; i++) {
        if (!Array.isArray(mat[i]) || mat[i].length !== r) {
            return `Matrix ${name} row P${i} must have exactly ${r} columns.`;
        }
        for (let j = 0; j < r; j++) {
            const val = mat[i][j];
            if (!Number.isInteger(val) || val < 0) {
                return `Matrix ${name} cell [P${i}, R${j}] must be a non-negative integer.`;
            }
        }
    }
    return null;
}

function validateVector(vec, r, name) {
    if (!Array.isArray(vec) || vec.length !== r) {
        return `Vector ${name} must have exactly ${r} elements.`;
    }
    for (let j = 0; j < r; j++) {
        const val = vec[j];
        if (!Number.isInteger(val) || val < 0) {
            return `Vector ${name} item R${j} must be a non-negative integer.`;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// API ENDPOINTS
// ---------------------------------------------------------------------------

// 1. Health check & C compiler status
app.get('/api/health', (req, res) => {
    const gcc = getGccPath();
    const cDir = path.resolve(__dirname, '..', 'c');
    const binaries = ['banker.exe', 'resource_request.exe', 'deadlock_detection.exe', 'recovery.exe'];
    const compiled = binaries.every(b => fs.existsSync(path.join(cDir, b)));

    res.json({
        status: 'UP',
        engine: 'Native C (MinGW GCC)',
        compiler: gcc,
        binariesCompiled: compiled,
        time: new Date().toISOString()
    });
});

// 2. Banker's Algorithm Safety Check
app.post('/api/banker/check', async (req, res) => {
    try {
        const { n, r, alloc, max, available, total } = req.body;

        const dimErr = validateDimensions(n, r);
        if (dimErr) return res.status(400).json({ error: dimErr });

        const allocErr = validateMatrix(alloc, n, r, 'Allocation');
        if (allocErr) return res.status(400).json({ error: allocErr });

        const maxErr = validateMatrix(max, n, r, 'Maximum');
        if (maxErr) return res.status(400).json({ error: maxErr });

        // Invariant: Alloc[i][j] <= Max[i][j]
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < r; j++) {
                if (alloc[i][j] > max[i][j]) {
                    return res.status(400).json({
                        error: `Invalid inputs: Allocation exceeds Maximum at process P${i}, resource index ${j} (${alloc[i][j]} > ${max[i][j]}).`
                    });
                }
            }
        }

        if (available) {
            const availErr = validateVector(available, r, 'Available');
            if (availErr) return res.status(400).json({ error: availErr });
        } else if (total) {
            const totalErr = validateVector(total, r, 'Total');
            if (totalErr) return res.status(400).json({ error: totalErr });
        } else {
            return res.status(400).json({ error: 'Either Available or Total resource vector must be provided.' });
        }

        const result = await cRunner.runBankerCheck({ n, r, alloc, max, available, total });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/banker/check:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Resource Request Simulation
app.post('/api/resource-request', async (req, res) => {
    try {
        const { n, r, alloc, max, available, pid, request } = req.body;

        const dimErr = validateDimensions(n, r);
        if (dimErr) return res.status(400).json({ error: dimErr });

        if (!Number.isInteger(pid) || pid < 0 || pid >= n) {
            return res.status(400).json({ error: `Invalid process identifier P${pid}. Must be between P0 and P${n - 1}.` });
        }

        const allocErr = validateMatrix(alloc, n, r, 'Allocation');
        if (allocErr) return res.status(400).json({ error: allocErr });

        const maxErr = validateMatrix(max, n, r, 'Maximum');
        if (maxErr) return res.status(400).json({ error: maxErr });

        const availErr = validateVector(available, r, 'Available');
        if (availErr) return res.status(400).json({ error: availErr });

        const reqErr = validateVector(request, r, 'Request');
        if (reqErr) return res.status(400).json({ error: reqErr });

        const result = await cRunner.runResourceRequest({ n, r, alloc, max, available, pid, request });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/resource-request:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Add/Remove Resources
app.post('/api/resources/change', async (req, res) => {
    try {
        const { n, r, alloc, max, available, total, change, isAdd } = req.body;

        const dimErr = validateDimensions(n, r);
        if (dimErr) return res.status(400).json({ error: dimErr });

        const changeErr = validateVector(change, r, 'Change');
        if (changeErr) return res.status(400).json({ error: changeErr });

        const result = await cRunner.runChangeResources({ n, r, alloc, max, available, total, change, isAdd });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/resources/change:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Deadlock Detection
app.post('/api/deadlock/detect', async (req, res) => {
    try {
        const { n, r, alloc, request, available } = req.body;

        const dimErr = validateDimensions(n, r);
        if (dimErr) return res.status(400).json({ error: dimErr });

        const allocErr = validateMatrix(alloc, n, r, 'Allocation');
        if (allocErr) return res.status(400).json({ error: allocErr });

        const reqErr = validateMatrix(request, n, r, 'Request');
        if (reqErr) return res.status(400).json({ error: reqErr });

        const availErr = validateVector(available, r, 'Available');
        if (availErr) return res.status(400).json({ error: availErr });

        const result = await cRunner.runDeadlockDetection({ n, r, alloc, request, available });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/deadlock/detect:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Deadlock Recovery via Process Termination
app.post('/api/deadlock/recover', async (req, res) => {
    try {
        const { n, r, alloc, request, available, victim } = req.body;

        const dimErr = validateDimensions(n, r);
        if (dimErr) return res.status(400).json({ error: dimErr });

        if (!Number.isInteger(victim) || victim < 0 || victim >= n) {
            return res.status(400).json({ error: `Invalid victim process identifier P${victim}. Must be between P0 and P${n - 1}.` });
        }

        const allocErr = validateMatrix(alloc, n, r, 'Allocation');
        if (allocErr) return res.status(400).json({ error: allocErr });

        const reqErr = validateMatrix(request, n, r, 'Request');
        if (reqErr) return res.status(400).json({ error: reqErr });

        const availErr = validateVector(available, r, 'Available');
        if (availErr) return res.status(400).json({ error: availErr });

        const result = await cRunner.runRecovery({ n, r, alloc, request, available, victim });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/deadlock/recover:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Deadlock Prevention Policy Check
app.post('/api/prevention/check', (req, res) => {
    try {
        const result = cRunner.runPreventionCheck(req.body);
        if (result.error) return res.status(400).json({ error: result.error });
        res.json(result);
    } catch (err) {
        console.error('Error in /api/prevention/check:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8. Run All Automated Test Cases
app.post('/api/tests/run', async (req, res) => {
    try {
        const results = await runAllTests();
        const passedCount = results.filter(r => r.passed).length;
        res.json({
            success: true,
            total: results.length,
            passed: passedCount,
            failed: results.length - passedCount,
            tests: results
        });
    } catch (err) {
        console.error('Error in /api/tests/run:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9. C Code Explorer - get files and structured viva documentation
app.get('/api/code', (req, res) => {
    try {
        const docs = cRunner.getCodeExplorations();
        const list = Object.keys(docs).map(key => ({
            key,
            filename: docs[key].filename,
            title: docs[key].title,
            summary: docs[key].summary
        }));
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/code/:file', (req, res) => {
    try {
        const filename = req.params.file;
        const docs = cRunner.getCodeExplorations();
        const doc = docs[filename];

        if (!doc) {
            return res.status(404).json({ error: 'Source file explanation not found' });
        }

        const sourceCode = fs.readFileSync(doc.path, 'utf8');
        res.json({
            ...doc,
            sourceCode
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`  DEADLOCK LAB: Operating Systems Simulator running!`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  C Engine: Connected via GCC`);
    console.log(`============================================================\n`);
});

module.exports = { app, server };
