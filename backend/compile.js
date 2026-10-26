const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Locate GCC
function getGccPath() {
    const candidates = [
        'gcc',
        'C:\\Program Files\\CodeBlocks\\MinGW\\bin\\gcc.exe',
        'C:\\MinGW\\bin\\gcc.exe',
        'C:\\msys64\\ucrt64\\bin\\gcc.exe',
        'C:\\msys64\\mingw64\\bin\\gcc.exe'
    ];

    for (const c of candidates) {
        try {
            execSync(`"${c}" --version`, { stdio: 'pipe' });
            return c;
        } catch (e) {
            // continue
        }
    }
    return 'gcc';
}

function compileAll() {
    const gcc = getGccPath();
    console.log(`Using GCC compiler at: ${gcc}`);

    const cDir = path.resolve(__dirname, '..', 'c');
    const files = [
        { src: 'banker.c', exe: 'banker.exe' },
        { src: 'resource_request.c', exe: 'resource_request.exe' },
        { src: 'deadlock_detection.c', exe: 'deadlock_detection.exe' },
        { src: 'recovery.c', exe: 'recovery.exe' }
    ];

    const results = [];

    for (const item of files) {
        const srcPath = path.join(cDir, item.src);
        const exePath = path.join(cDir, item.exe);

        console.log(`Compiling ${item.src} -> ${item.exe}...`);
        try {
            const cmd = `"${gcc}" -O2 -Wall "${srcPath}" -o "${exePath}"`;
            execSync(cmd, { stdio: 'pipe' });
            if (fs.existsSync(exePath)) {
                try { fs.chmodSync(exePath, 0o755); } catch (_) {}
                console.log(`✓ Successfully compiled ${item.exe} (${fs.statSync(exePath).size} bytes)`);
                results.push({ name: item.src, exe: item.exe, success: true });
            } else {
                throw new Error('Executable not found after compilation');
            }
        } catch (err) {
            console.error(`✗ Error compiling ${item.src}:`, err.message);
            results.push({ name: item.src, exe: item.exe, success: false, error: err.message });
        }
    }

    return results;
}

if (require.main === module) {
    const res = compileAll();
    const allPassed = res.every(r => r.success);
    if (!allPassed) {
        process.exit(1);
    }
    console.log('\nAll 4 C algorithms compiled successfully!');
}

module.exports = { compileAll, getGccPath };
