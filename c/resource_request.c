/*
 * ============================================================================
 * PROJECT: DEADLOCK LAB
 * MODULE: Resource-Request Algorithm
 * ============================================================================
 * Implements the 4-stage Resource-Request Algorithm:
 * Stage 1: Check if Request_i <= Need_i
 * Stage 2: Check if Request_i <= Available
 * Stage 3: Hypothetically allocate resources:
 *          Available = Available - Request
 *          Alloc_i   = Alloc_i + Request
 *          Need_i    = Need_i - Request
 * Stage 4: Run Safety Algorithm on temporary state
 *          If Safe   -> Grant & commit
 *          If Unsafe -> Deny & rollback
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#define MAX_P 50
#define MAX_R 20
#define MAX_STEPS 200

typedef struct {
    int stepNumber;
    int process;
    int workBefore[MAX_R];
    int finishBefore[MAX_P];
    int need[MAX_R];
    int canFinish;
    int failingResource;
    int alloc[MAX_R];
    int workAfter[MAX_R];
    int finishAfter[MAX_P];
    char note[256];
} SafetyStep;

static SafetyStep g_steps[MAX_STEPS];
static int g_stepCount = 0;

int runSafetyCheck(int n, int r, int available[MAX_R],
                   int alloc[MAX_P][MAX_R],
                   int need[MAX_P][MAX_R],
                   int sequence[MAX_P]) {
    int work[MAX_R];
    int finish[MAX_P] = {0};
    int count = 0;
    g_stepCount = 0;

    for (int j = 0; j < r; j++)
        work[j] = available[j];

    while (count < n) {
        int found = 0;
        for (int i = 0; i < n; i++) {
            if (finish[i] == 0) {
                int canFinish = 1;
                int failingRes = -1;
                for (int j = 0; j < r; j++) {
                    if (need[i][j] > work[j]) {
                        canFinish = 0;
                        failingRes = j;
                        break;
                    }
                }

                if (g_stepCount < MAX_STEPS) {
                    SafetyStep *st = &g_steps[g_stepCount++];
                    st->stepNumber = g_stepCount;
                    st->process = i;
                    st->canFinish = canFinish;
                    st->failingResource = failingRes;
                    for (int j = 0; j < r; j++) {
                        st->workBefore[j] = work[j];
                        st->need[j] = need[i][j];
                        st->alloc[j] = alloc[i][j];
                        st->workAfter[j] = canFinish ? (work[j] + alloc[i][j]) : work[j];
                    }
                    for (int p = 0; p < n; p++) {
                        st->finishBefore[p] = finish[p];
                        st->finishAfter[p] = (canFinish && p == i) ? 1 : finish[p];
                    }
                }

                if (canFinish) {
                    for (int j = 0; j < r; j++)
                        work[j] += alloc[i][j];
                    finish[i] = 1;
                    sequence[count++] = i;
                    found = 1;
                }
            }
        }
        if (!found) return 0;
    }
    return 1;
}

/* -------------------------------------------------------------------------
 * JSON PARSING HELPER
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
    if (**p == '-') { sign = -1; (*p)++; }
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
            for (int j = 0; j < cols && j < maxCols; j++) arr[row][j] = subArr[j];
            row++;
            while (*p && *p != ']') p++;
            if (*p == ']') p++;
        } else {
            p++;
        }
    }
    return row;
}

int main(int argc, char *argv[]) {
    if (argc <= 1 || strcmp(argv[1], "--json") != 0) {
        printf("Deadlock Lab - Resource Request Module. Run with --json for API mode.\n");
        return 0;
    }

    size_t cap = 131072;
    char *buf = (char *)malloc(cap);
    if (!buf) {
        printf("{\"error\":\"Memory allocation failed\"}\n");
        return 1;
    }
    size_t len = 0;
    int ch;
    while ((ch = getchar()) != EOF && len < cap - 1) {
        buf[len++] = (char)ch;
    }
    buf[len] = '\0';

    int n = 0, r = 0, pid = -1;
    int alloc[MAX_P][MAX_R] = {0};
    int max[MAX_P][MAX_R] = {0};
    int need[MAX_P][MAX_R] = {0};
    int available[MAX_R] = {0};
    int request[MAX_R] = {0};

    char *p = findKey(buf, "n");
    if (p) n = parseInteger(&p);
    p = findKey(buf, "r");
    if (p) r = parseInteger(&p);
    p = findKey(buf, "pid");
    if (p) pid = parseInteger(&p);

    if (n < 1 || n > MAX_P || r < 1 || r > MAX_R || pid < 0 || pid >= n) {
        printf("{\"error\":\"Invalid dimensions or process ID\"}\n");
        free(buf);
        return 1;
    }

    p = findKey(buf, "alloc");
    if (p) parse2DArray(p, alloc, n, r);
    p = findKey(buf, "max");
    if (p) parse2DArray(p, max, n, r);
    p = findKey(buf, "available");
    if (p) parseIntArray(p, available, r);
    p = findKey(buf, "request");
    if (p) parseIntArray(p, request, r);

    // Calculate Need
    for (int i = 0; i < n; i++)
        for (int j = 0; j < r; j++)
            need[i][j] = max[i][j] - alloc[i][j];

    // Stage 1: Request <= Need[pid]
    int stage1Pass = 1;
    int stage1FailingRes = -1;
    for (int j = 0; j < r; j++) {
        if (request[j] > need[pid][j]) {
            stage1Pass = 0;
            stage1FailingRes = j;
            break;
        }
    }

    // Stage 2: Request <= Available
    int stage2Pass = 1;
    int stage2FailingRes = -1;
    for (int j = 0; j < r; j++) {
        if (request[j] > available[j]) {
            stage2Pass = 0;
            stage2FailingRes = j;
            break;
        }
    }

    // Stage 3 & 4: Hypothetical Allocation & Safety Check
    int stage3Success = 0;
    int isSafeResult = 0;
    int sequence[MAX_P] = {0};

    int tempAlloc[MAX_P][MAX_R];
    int tempNeed[MAX_P][MAX_R];
    int tempAvailable[MAX_R];

    memcpy(tempAlloc, alloc, sizeof(tempAlloc));
    memcpy(tempNeed, need, sizeof(tempNeed));
    memcpy(tempAvailable, available, sizeof(tempAvailable));

    char decision[64] = "";
    char statusType[32] = "";
    char explanation[512] = "";

    if (!stage1Pass) {
        strcpy(statusType, "INVALID_CLAIM");
        strcpy(decision, "DENIED");
        snprintf(explanation, sizeof(explanation),
                 "Request DENIED: Process P%d requested more than its declared maximum claim (Request > Need for resource index %d).",
                 pid, stage1FailingRes);
    } else if (!stage2Pass) {
        strcpy(statusType, "RESOURCES_UNAVAILABLE");
        strcpy(decision, "WAIT");
        snprintf(explanation, sizeof(explanation),
                 "Process P%d MUST WAIT: System does not currently have sufficient available instances (Request > Available for resource index %d). Request is valid, but process must wait.",
                 pid, stage2FailingRes);
    } else {
        // Both Stage 1 and Stage 2 passed -> Execute Stage 3
        stage3Success = 1;
        for (int j = 0; j < r; j++) {
            tempAvailable[j] -= request[j];
            tempAlloc[pid][j] += request[j];
            tempNeed[pid][j] -= request[j];
        }

        // Stage 4: Run Safety Check
        isSafeResult = runSafetyCheck(n, r, tempAvailable, tempAlloc, tempNeed, sequence);

        if (isSafeResult) {
            strcpy(statusType, "GRANTED");
            strcpy(decision, "GRANTED");
            snprintf(explanation, sizeof(explanation),
                     "Request GRANTED: Allocating resources leaves the system in a SAFE state. Safe sequence: ");
        } else {
            strcpy(statusType, "UNSAFE_STATE");
            strcpy(decision, "DENIED");
            snprintf(explanation, sizeof(explanation),
                     "Request DENIED: Allocating resources would lead to an UNSAFE state with no guaranteed completion sequence. Original system state preserved.");
        }
    }

    // Output JSON
    printf("{\n");
    printf("  \"success\": true,\n");
    printf("  \"pid\": %d,\n", pid);
    printf("  \"decision\": \"%s\",\n", decision);
    printf("  \"statusType\": \"%s\",\n", statusType);
    printf("  \"stage1Pass\": %s,\n", stage1Pass ? "true" : "false");
    printf("  \"stage1FailingRes\": %d,\n", stage1FailingRes);
    printf("  \"stage2Pass\": %s,\n", stage2Pass ? "true" : "false");
    printf("  \"stage2FailingRes\": %d,\n", stage2FailingRes);
    printf("  \"stage3Success\": %s,\n", stage3Success ? "true" : "false");
    printf("  \"stage4Safe\": %s,\n", isSafeResult ? "true" : "false");

    // Request vector
    printf("  \"request\": [");
    for (int j = 0; j < r; j++) printf("%d%s", request[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    // Original and Temporary comparison matrices
    printf("  \"originalAvailable\": [");
    for (int j = 0; j < r; j++) printf("%d%s", available[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"originalAllocPid\": [");
    for (int j = 0; j < r; j++) printf("%d%s", alloc[pid][j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"originalNeedPid\": [");
    for (int j = 0; j < r; j++) printf("%d%s", need[pid][j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"tempAvailable\": [");
    for (int j = 0; j < r; j++) printf("%d%s", tempAvailable[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"tempAllocPid\": [");
    for (int j = 0; j < r; j++) printf("%d%s", tempAlloc[pid][j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"tempNeedPid\": [");
    for (int j = 0; j < r; j++) printf("%d%s", tempNeed[pid][j], (j < r - 1) ? ", " : "");
    printf("],\n");

    // Committed matrices (only changed if granted)
    int (*finalAlloc)[MAX_R] = (isSafeResult) ? tempAlloc : alloc;
    int (*finalNeed)[MAX_R] = (isSafeResult) ? tempNeed : need;
    int *finalAvailable = (isSafeResult) ? tempAvailable : available;

    printf("  \"committedAlloc\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", finalAlloc[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    printf("  \"committedNeed\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", finalNeed[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    printf("  \"committedAvailable\": [");
    for (int j = 0; j < r; j++) printf("%d%s", finalAvailable[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    // Safe sequence
    printf("  \"safeSequence\": [");
    if (isSafeResult) {
        for (int i = 0; i < n; i++) printf("%d%s", sequence[i], (i < n - 1) ? ", " : "");
    }
    printf("],\n");

    // Steps trace
    printf("  \"safetySteps\": [\n");
    for (int s = 0; s < g_stepCount; s++) {
        SafetyStep *st = &g_steps[s];
        printf("    {\n");
        printf("      \"stepNumber\": %d,\n", st->stepNumber);
        printf("      \"process\": %d,\n", st->process);
        printf("      \"canFinish\": %s,\n", st->canFinish ? "true" : "false");
        printf("      \"workBefore\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workBefore[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"need\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->need[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"alloc\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->alloc[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"workAfter\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workAfter[j], (j < r - 1) ? ", " : "");
        printf("]\n");
        printf("    }%s\n", (s < g_stepCount - 1) ? "," : "");
    }
    printf("  ],\n");

    printf("  \"explanation\": \"%s\"\n", explanation);
    printf("}\n");

    free(buf);
    return 0;
}
