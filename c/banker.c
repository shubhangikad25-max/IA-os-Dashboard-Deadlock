/*
 * ============================================================================
 * PROJECT: DEADLOCK LAB
 * MODULE: Banker's Algorithm (Safety & Resource Allocation Avoidance)
 * ============================================================================
 * Student Viva Reference:
 * - calculateNeed(): Need[i][j] = Max[i][j] - Alloc[i][j]
 * - calculateAvailable(): Available[j] = Total[j] - Sum(Alloc[i][j])
 * - isSafe(): Safety algorithm tracking Work[j] and Finish[i]
 * - changeResources(): Adds/removes system resource instances safely
 *
 * Supports two modes:
 * 1. Interactive CLI mode (when run without arguments - exact viva format)
 * 2. Structured JSON mode (when run with --json for web dashboard backend)
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_P 50
#define MAX_R 20
#define MAX_STEPS 200

/* Structure to capture step-by-step execution trace for visualization */
typedef struct {
    int stepNumber;
    int process;
    int workBefore[MAX_R];
    int finishBefore[MAX_P];
    int need[MAX_R];
    int canFinish;
    int failingResource; /* -1 if passed, or index of resource that exceeded work */
    int alloc[MAX_R];
    int workAfter[MAX_R];
    int finishAfter[MAX_P];
    char note[256];
} SafetyStep;

/* Global trace storage */
static SafetyStep g_steps[MAX_STEPS];
static int g_stepCount = 0;

/* -------------------------------------------------------------------------
 * CORE ALGORITHMIC FUNCTIONS (Exact signatures preserved for Viva)
 * ------------------------------------------------------------------------- */

// Calculate Need = Maximum - Allocation
void calculateNeed(int n, int r,
                   int alloc[MAX_P][MAX_R],
                   int max[MAX_P][MAX_R],
                   int need[MAX_P][MAX_R]) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < r; j++) {
            need[i][j] = max[i][j] - alloc[i][j];
        }
    }
}

// Calculate Available = Total - Total Allocation
int calculateAvailable(int n, int r, int total[MAX_R],
                       int alloc[MAX_P][MAX_R],
                       int available[MAX_R]) {
    int allocated[MAX_R] = {0};

    for (int i = 0; i < n; i++) {
        for (int j = 0; j < r; j++) {
            allocated[j] += alloc[i][j];
        }
    }

    for (int j = 0; j < r; j++) {
        available[j] = total[j] - allocated[j];
        if (available[j] < 0) {
            return 0; // Error: Total resources less than allocated
        }
    }
    return 1;
}

// Display Allocation, Maximum, or Need matrix
void displayMatrix(const char *name, int n, int r,
                   int matrix[MAX_P][MAX_R]) {
    printf("\n%s MATRIX\n", name);
    printf("Process\t");

    for (int j = 0; j < r; j++)
        printf("R%d\t", j);

    printf("\n");

    for (int i = 0; i < n; i++) {
        printf("P%d\t", i);

        for (int j = 0; j < r; j++)
            printf("%d\t", matrix[i][j]);

        printf("\n");
    }
}

// Display a resource vector
void displayVector(const char *name, int r, int v[MAX_R]) {
    printf("%s = ", name);

    for (int j = 0; j < r; j++)
        printf("%d ", v[j]);

    printf("\n");
}

// Banker's Safety Algorithm with step trace recording
int isSafe(int n, int r, int available[MAX_R],
           int alloc[MAX_P][MAX_R],
           int need[MAX_P][MAX_R],
           int sequence[MAX_P], int showSteps) {
    int work[MAX_R];
    int finish[MAX_P] = {0};
    int count = 0;
    g_stepCount = 0;

    // Initially, Work = Available
    for (int j = 0; j < r; j++)
        work[j] = available[j];

    if (showSteps) {
        displayVector("Initial Work", r, work);

        printf("Initial Finish = ");
        for (int i = 0; i < n; i++)
            printf("%d ", finish[i]);
        printf("\n");
    }

    // Safety search loop
    while (count < n) {
        int found = 0;

        for (int i = 0; i < n; i++) {
            if (finish[i] == 0) {
                int canFinish = 1;
                int failingRes = -1;

                // Check whether Need <= Work
                for (int j = 0; j < r; j++) {
                    if (need[i][j] > work[j]) {
                        canFinish = 0;
                        failingRes = j;
                        break;
                    }
                }

                // Record step attempt
                if (g_stepCount < MAX_STEPS) {
                    SafetyStep *step = &g_steps[g_stepCount++];
                    step->stepNumber = g_stepCount;
                    step->process = i;
                    for (int j = 0; j < r; j++) {
                        step->workBefore[j] = work[j];
                        step->need[j] = need[i][j];
                        step->alloc[j] = alloc[i][j];
                    }
                    for (int p = 0; p < n; p++) {
                        step->finishBefore[p] = finish[p];
                    }
                    step->canFinish = canFinish;
                    step->failingResource = failingRes;

                    if (canFinish) {
                        for (int j = 0; j < r; j++) {
                            step->workAfter[j] = work[j] + alloc[i][j];
                        }
                        for (int p = 0; p < n; p++) {
                            step->finishAfter[p] = (p == i) ? 1 : finish[p];
                        }
                        snprintf(step->note, sizeof(step->note),
                                 "Need <= Work satisfied. P%d executes and releases allocation.", i);
                    } else {
                        for (int j = 0; j < r; j++) {
                            step->workAfter[j] = work[j];
                        }
                        for (int p = 0; p < n; p++) {
                            step->finishAfter[p] = finish[p];
                        }
                        snprintf(step->note, sizeof(step->note),
                                 "Need > Work for resource index %d. P%d must wait.", failingRes, i);
                    }
                }

                if (canFinish) {
                    // Process finishes and releases its resources
                    for (int j = 0; j < r; j++)
                        work[j] += alloc[i][j];

                    finish[i] = 1;
                    sequence[count++] = i;
                    found = 1;

                    if (showSteps) {
                        printf("\nP%d finishes.\n", i);
                        displayVector("Updated Work", r, work);

                        printf("Updated Finish = ");
                        for (int k = 0; k < n; k++)
                            printf("%d ", finish[k]);
                        printf("\n");
                    }
                }
            }
        }

        // No unfinished process can proceed
        if (!found) {
            return 0; // UNSAFE state
        }
    }

    return 1; // SAFE state
}

// Display the safe sequence
void displaySequence(int n, int sequence[MAX_P]) {
    printf("Safe Sequence: ");

    for (int i = 0; i < n; i++) {
        printf("P%d", sequence[i]);

        if (i < n - 1)
            printf(" -> ");
    }

    printf("\n");
}

// Add or remove resources and check safety
void changeResources(int n, int r, int total[MAX_R],
                     int available[MAX_R], int change[MAX_R],
                     int add, int alloc[MAX_P][MAX_R],
                     int need[MAX_P][MAX_R]) {
    int newTotal[MAX_R];
    int newAvailable[MAX_R];
    int sequence[MAX_P];

    for (int j = 0; j < r; j++) {
        if (add) {
            newTotal[j] = total[j] + change[j];
            newAvailable[j] = available[j] + change[j];
        } else {
            if (change[j] > available[j]) {
                printf("Change rejected: insufficient Available resources.\n");
                displayVector("Available", r, available);
                return;
            }

            newTotal[j] = total[j] - change[j];
            newAvailable[j] = available[j] - change[j];
        }
    }

    displayVector("Proposed Available", r, newAvailable);

    if (isSafe(n, r, newAvailable, alloc, need, sequence, 0)) {
        for (int j = 0; j < r; j++) {
            total[j] = newTotal[j];
            available[j] = newAvailable[j];
        }

        printf("Change accepted. System is SAFE.\n");
        displayVector("Updated Total", r, total);
        displayVector("Updated Available", r, available);
        displaySequence(n, sequence);
    } else {
        printf("Change rejected. New state is UNSAFE.\n");
        printf("Original resources remain unchanged.\n");
        displayVector("Available", r, available);
    }
}

/* -------------------------------------------------------------------------
 * LIGHTWEIGHT JSON PARSER & EMITTER FOR NODE.JS INTEGRATION
 * ------------------------------------------------------------------------- */

static char *skipWhitespace(char *p) {
    while (*p && isspace((unsigned char)*p)) p++;
    return p;
}

static char *findKey(char *json, const char *key) {
    char search[128];
    snprintf(search, sizeof(search), "\"%s\"", key);
    char *loc = strstr(json, search);
    if (!loc) return NULL;
    loc += strlen(search);
    loc = skipWhitespace(loc);
    if (*loc == ':') loc++;
    return skipWhitespace(loc);
}

static int parseInteger(char **p) {
    *p = skipWhitespace(*p);
    int sign = 1;
    if (**p == '-') {
        sign = -1;
        (*p)++;
    }
    int val = 0;
    while (isdigit((unsigned char)**p)) {
        val = val * 10 + (**p - '0');
        (*p)++;
    }
    return sign * val;
}

static int parseIntArray(char *start, int *arr, int maxLen) {
    char *p = skipWhitespace(start);
    if (*p != '[') return 0;
    p++;
    int count = 0;
    while (*p && *p != ']' && count < maxLen) {
        p = skipWhitespace(p);
        if (*p == ']') break;
        if (isdigit((unsigned char)*p) || *p == '-') {
            arr[count++] = parseInteger(&p);
        } else {
            p++;
        }
    }
    return count;
}

static int parse2DArray(char *start, int arr[MAX_P][MAX_R], int maxRows, int maxCols) {
    char *p = skipWhitespace(start);
    if (*p != '[') return 0;
    p++;
    int row = 0;
    while (*p && *p != ']' && row < maxRows) {
        p = skipWhitespace(p);
        if (*p == '[') {
            int subArr[MAX_R] = {0};
            int cols = parseIntArray(p, subArr, maxCols);
            for (int j = 0; j < cols && j < maxCols; j++) {
                arr[row][j] = subArr[j];
            }
            row++;
            // Skip until closing bracket of this row
            while (*p && *p != ']') p++;
            if (*p == ']') p++;
        } else {
            p++;
        }
    }
    return row;
}

/* Run safety analysis and output JSON to stdout */
static void runJsonMode(void) {
    // Read entire JSON payload from stdin
    size_t cap = 131072;
    char *buf = (char *)malloc(cap);
    if (!buf) {
        printf("{\"error\":\"Memory allocation failed\"}\n");
        return;
    }
    size_t len = 0;
    int ch;
    while ((ch = getchar()) != EOF && len < cap - 1) {
        buf[len++] = (char)ch;
    }
    buf[len] = '\0';

    int n = 0, r = 0;
    int alloc[MAX_P][MAX_R] = {0};
    int max[MAX_P][MAX_R] = {0};
    int need[MAX_P][MAX_R] = {0};
    int available[MAX_R] = {0};
    int total[MAX_R] = {0};
    int hasTotal = 0;

    // Parse n and r
    char *p = findKey(buf, "n");
    if (p) n = parseInteger(&p);

    p = findKey(buf, "r");
    if (p) r = parseInteger(&p);

    if (n < 1 || n > MAX_P || r < 1 || r > MAX_R) {
        printf("{\"error\":\"Invalid dimensions: N must be 1..%d, R must be 1..%d\"}\n", MAX_P, MAX_R);
        free(buf);
        return;
    }

    // Parse alloc
    p = findKey(buf, "alloc");
    if (p) parse2DArray(p, alloc, n, r);

    // Parse max
    p = findKey(buf, "max");
    if (p) parse2DArray(p, max, n, r);

    // Parse total if present
    p = findKey(buf, "total");
    if (p) {
        int count = parseIntArray(p, total, r);
        if (count == r) hasTotal = 1;
    }

    // Parse available
    p = findKey(buf, "available");
    if (p) {
        parseIntArray(p, available, r);
    } else if (hasTotal) {
        if (!calculateAvailable(n, r, total, alloc, available)) {
            printf("{\"error\":\"Total resources less than allocated sum\"}\n");
            free(buf);
            return;
        }
    }

    // Calculate Need
    calculateNeed(n, r, alloc, max, need);

    // Execute Safety Algorithm
    int sequence[MAX_P] = {0};
    int safe = isSafe(n, r, available, alloc, need, sequence, 0);

    // Emit JSON response
    printf("{\n");
    printf("  \"success\": true,\n");
    printf("  \"n\": %d,\n", n);
    printf("  \"r\": %d,\n", r);
    printf("  \"isSafe\": %s,\n", safe ? "true" : "false");

    // Allocation matrix
    printf("  \"alloc\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", alloc[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    // Max matrix
    printf("  \"max\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", max[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    // Need matrix
    printf("  \"need\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", need[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    // Available vector
    printf("  \"available\": [");
    for (int j = 0; j < r; j++) printf("%d%s", available[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    // Total vector if provided
    if (hasTotal) {
        printf("  \"total\": [");
        for (int j = 0; j < r; j++) printf("%d%s", total[j], (j < r - 1) ? ", " : "");
        printf("],\n");
    }

    // Safe sequence
    printf("  \"safeSequence\": [");
    if (safe) {
        for (int i = 0; i < n; i++) printf("%d%s", sequence[i], (i < n - 1) ? ", " : "");
    }
    printf("],\n");

    // Step-by-step trace
    printf("  \"steps\": [\n");
    for (int s = 0; s < g_stepCount; s++) {
        SafetyStep *st = &g_steps[s];
        printf("    {\n");
        printf("      \"stepNumber\": %d,\n", st->stepNumber);
        printf("      \"process\": %d,\n", st->process);
        printf("      \"canFinish\": %s,\n", st->canFinish ? "true" : "false");
        printf("      \"failingResource\": %d,\n", st->failingResource);

        printf("      \"workBefore\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workBefore[j], (j < r - 1) ? ", " : "");
        printf("],\n");

        printf("      \"finishBefore\": [");
        for (int p = 0; p < n; p++) printf("%s%s", st->finishBefore[p] ? "true" : "false", (p < n - 1) ? ", " : "");
        printf("],\n");

        printf("      \"need\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->need[j], (j < r - 1) ? ", " : "");
        printf("],\n");

        printf("      \"alloc\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->alloc[j], (j < r - 1) ? ", " : "");
        printf("],\n");

        printf("      \"workAfter\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workAfter[j], (j < r - 1) ? ", " : "");
        printf("],\n");

        printf("      \"finishAfter\": [");
        for (int p = 0; p < n; p++) printf("%s%s", st->finishAfter[p] ? "true" : "false", (p < n - 1) ? ", " : "");
        printf("],\n");

        printf("      \"note\": \"%s\"\n", st->note);
        printf("    }%s\n", (s < g_stepCount - 1) ? "," : "");
    }
    printf("  ],\n");

    // Explanation
    if (safe) {
        printf("  \"explanation\": \"System is in a SAFE state. A complete execution sequence exists where every process can acquire its maximum claim, terminate, and return all held resources.\"\n");
    } else {
        printf("  \"explanation\": \"System is in an UNSAFE state. No remaining process has Need <= Work, so the system cannot guarantee safe completion for all processes without risk of deadlock.\"\n");
    }
    printf("}\n");

    free(buf);
}

/* -------------------------------------------------------------------------
 * MAIN FUNCTION: Dispatches to JSON mode or User's exact interactive CLI
 * ------------------------------------------------------------------------- */
int main(int argc, char *argv[]) {
    if (argc > 1 && strcmp(argv[1], "--json") == 0) {
        runJsonMode();
        return 0;
    }

    /* USER'S EXACT ORIGINAL INTERACTIVE CODE FOR TERMINAL/CODEBLOCKS */
    int n, r;
    int alloc[MAX_P][MAX_R] = {0};
    int max[MAX_P][MAX_R] = {0};
    int need[MAX_P][MAX_R] = {0};
    int total[MAX_R] = {0};
    int available[MAX_R] = {0};
    int sequence[MAX_P];
    int add[MAX_R] = {0};
    int remove[MAX_R] = {0};

    printf("============================================================\n");
    printf("   DEADLOCK LAB: Banker's Algorithm (Interactive Mode)\n");
    printf("============================================================\n");

    printf("Enter number of processes (1-%d): ", MAX_P);
    if (scanf("%d", &n) != 1 || n < 1 || n > MAX_P) {
        printf("Invalid number of processes.\n");
        return 1;
    }

    printf("Enter number of resource types (1-%d): ", MAX_R);
    if (scanf("%d", &r) != 1 || r < 1 || r > MAX_R) {
        printf("Invalid number of resource types.\n");
        return 1;
    }

    printf("\nEnter Allocation Matrix:\n");
    for (int i = 0; i < n; i++) {
        printf("P%d: ", i);
        for (int j = 0; j < r; j++) {
            if (scanf("%d", &alloc[i][j]) != 1 || alloc[i][j] < 0) {
                printf("Invalid allocation value.\n");
                return 1;
            }
        }
    }

    printf("\nEnter Maximum Matrix:\n");
    for (int i = 0; i < n; i++) {
        printf("P%d: ", i);
        for (int j = 0; j < r; j++) {
            if (scanf("%d", &max[i][j]) != 1 || max[i][j] < alloc[i][j]) {
                printf("Invalid input: Maximum must be >= Allocation.\n");
                return 1;
            }
        }
    }

    printf("\nEnter Total Resources:\n");
    for (int j = 0; j < r; j++) {
        printf("R%d: ", j);
        if (scanf("%d", &total[j]) != 1 || total[j] < 0) {
            printf("Invalid total resource value.\n");
            return 1;
        }
    }

    if (!calculateAvailable(n, r, total, alloc, available)) {
        printf("Error: Allocation exceeds total resources.\n");
        return 1;
    }

    calculateNeed(n, r, alloc, max, need);

    displayMatrix("Allocation", n, r, alloc);
    displayMatrix("Maximum", n, r, max);
    displayMatrix("Need", n, r, need);

    printf("\n========== INITIAL SAFETY CHECK ==========\n");
    if (!isSafe(n, r, available, alloc, need, sequence, 1)) {
        printf("\nSystem is UNSAFE.\n");
        printf("Resource changes will not be tested.\n");
        return 0;
    }

    printf("\nSystem is SAFE.\n");
    displaySequence(n, sequence);

    printf("\nEnter resources to ADD:\n");
    for (int j = 0; j < r; j++) {
        printf("R%d: ", j);
        if (scanf("%d", &add[j]) != 1 || add[j] < 0) {
            printf("Invalid resource quantity.\n");
            return 1;
        }
    }

    printf("\nEnter resources to REMOVE:\n");
    for (int j = 0; j < r; j++) {
        printf("R%d: ", j);
        if (scanf("%d", &remove[j]) != 1 || remove[j] < 0) {
            printf("Invalid resource quantity.\n");
            return 1;
        }
    }

    printf("\n========== CASE (a): INCREASE AVAILABLE ==========\n");
    changeResources(n, r, total, available, add, 1, alloc, need);

    printf("\n========== CASE (b): DECREASE AVAILABLE ==========\n");
    changeResources(n, r, total, available, remove, 0, alloc, need);

    return 0;
}
