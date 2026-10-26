/**
 * DEADLOCK LAB: API Client for C-Connected Backend
 */
const API = {
    async getHealth() {
        const res = await fetch('/api/health');
        return res.json();
    },

    async checkBanker(payload) {
        const res = await fetch('/api/banker/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Banker analysis failed');
        return data;
    },

    async requestResource(payload) {
        const res = await fetch('/api/resource-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Resource request failed');
        return data;
    },

    async changeResources(payload) {
        const res = await fetch('/api/resources/change', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Resource change failed');
        return data;
    },

    async detectDeadlock(payload) {
        const res = await fetch('/api/deadlock/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Deadlock detection failed');
        return data;
    },

    async recoverDeadlock(payload) {
        const res = await fetch('/api/deadlock/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recovery action failed');
        return data;
    },

    async checkPrevention(payload) {
        const res = await fetch('/api/prevention/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Prevention check failed');
        return data;
    },

    async runAllTests() {
        const res = await fetch('/api/tests/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Test suite execution failed');
        return data;
    },

    async getCodeList() {
        const res = await fetch('/api/code');
        return res.json();
    },

    async getCodeFile(file) {
        const res = await fetch(`/api/code/${file}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch code');
        return data;
    }
};

window.API = API;
