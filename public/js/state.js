/**
 * DEADLOCK LAB: Global State Management
 */
const AppState = {
    // Current Matrix Configuration
    n: 5,
    r: 3,
    resourceLabels: ['A', 'B', 'C'],
    inputMode: 'MODE_B', // 'MODE_B' (Available directly, matches reference) or 'MODE_A' (Total resources)

    // Current State Data
    alloc: [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2]
    ],
    max: [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3]
    ],
    available: [3, 3, 2],
    total: [10, 5, 7],
    need: [
        [7, 4, 3],
        [1, 2, 2],
        [6, 0, 0],
        [0, 1, 1],
        [4, 3, 1]
    ],

    // Latest Simulation Results from C
    latestResult: null,
    currentStepIndex: 0,
    isPlaying: false,
    playInterval: null,

    // Deadlock Detection State
    detectionState: {
        n: 2,
        r: 2,
        resourceLabels: ['A', 'B'],
        alloc: [[1, 0], [0, 1]],
        request: [[0, 1], [1, 0]],
        available: [0, 0],
        result: null
    },

    // Reset to Textbook Preset
    loadTextbookPreset() {
        this.n = 5;
        this.r = 3;
        this.resourceLabels = ['A', 'B', 'C'];
        this.alloc = [
            [0, 1, 0],
            [2, 0, 0],
            [3, 0, 2],
            [2, 1, 1],
            [0, 0, 2]
        ];
        this.max = [
            [7, 5, 3],
            [3, 2, 2],
            [9, 0, 2],
            [2, 2, 2],
            [4, 3, 3]
        ];
        this.available = [3, 3, 2];
        this.total = [10, 5, 7];
        this.need = [
            [7, 4, 3],
            [1, 2, 2],
            [6, 0, 0],
            [0, 1, 1],
            [4, 3, 1]
        ];
        this.latestResult = null;
        this.currentStepIndex = 0;
    },

    // Generate dynamic resource labels based on M
    getLabels(count) {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const labels = [];
        for (let j = 0; j < count; j++) {
            if (j < letters.length) {
                labels.push(letters[j]);
            } else {
                labels.push(`R${j}`);
            }
        }
        return labels;
    },

    // Clear form to empty state
    clearState(n, r) {
        this.n = n || 5;
        this.r = r || 3;
        this.resourceLabels = this.getLabels(this.r);
        this.alloc = Array.from({ length: this.n }, () => Array(this.r).fill(0));
        this.max = Array.from({ length: this.n }, () => Array(this.r).fill(0));
        this.available = Array(this.r).fill(0);
        this.total = Array(this.r).fill(0);
        this.need = Array.from({ length: this.n }, () => Array(this.r).fill(0));
        this.latestResult = null;
        this.currentStepIndex = 0;
    }
};

window.AppState = AppState;
