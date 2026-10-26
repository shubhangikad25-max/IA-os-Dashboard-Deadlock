/*
 * ============================================================================
 * PROJECT: DEADLOCK LAB
 * MODULE: Deadlock Recovery via Process Termination
 * ============================================================================
 * Process termination recovery:
 * 1. Takes victim process ID (terminated process).
 * 2. Reclaims all resources allocated to victim: Available[j] += Alloc[victim][j].
 * 3. Sets Alloc[victim][j] = 0 and Request[victim][j] = 0.
 * 4. Re-runs multi-instance deadlock detection on the updated state.
 * 5. Returns new Available, new matrices, step-by-step detection trace,
 *    and whether deadlock is fully resolved or still persists!
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
    int request[MAX_R];
    int canComplete;
    int alloc[MAX_R];
    int workAfter[MAX_R];
    int finishAfter[MAX_P];
    char note[256];
} DetectionStep;

static DetectionStep g_recoverySteps[MAX_STEPS];
static int g_recoveryStepCount = 0;

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
        printf("Deadlock Lab - Recovery Module. Run with --json for API mode.\n");
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

    int n = 0, r = 0, victim = -1;
    int alloc[MAX_P][MAX_R] = {0};
    int request[MAX_P][MAX_R] = {0};
    int available[MAX_R] = {0};

    char *p = findKey(buf, "n");
    if (p) n = parseInteger(&p);
    p = findKey(buf, "r");
    if (p) r = parseInteger(&p);
    p = findKey(buf, "victim");
    if (p) victim = parseInteger(&p);

    if (n < 1 || n > MAX_P || r < 1 || r > MAX_R || victim < 0 || victim >= n) {
        printf("{\"error\":\"Invalid dimensions or victim process ID\"}\n");
        free(buf);
        return 1;
    }

    p = findKey(buf, "alloc");
    if (p) parse2DArray(p, alloc, n, r);
    p = findKey(buf, "request");
    if (p) parse2DArray(p, request, n, r);
    p = findKey(buf, "available");
    if (p) parseIntArray(p, available, r);

    // Initial check: was the victim actually holding or requesting any resources?
    int totalVictimAlloc = 0;
    for (int j = 0; j < r; j++) {
        totalVictimAlloc += alloc[victim][j];
    }

    // Record reclaimed resources
    int reclaimed[MAX_R] = {0};
    for (int j = 0; j < r; j++) {
        reclaimed[j] = alloc[victim][j];
        available[j] += alloc[victim][j];
        alloc[victim][j] = 0;
        request[victim][j] = 0;
    }

    // Run Multi-Instance Detection Algorithm on the updated state
    int work[MAX_R];
    for (int j = 0; j < r; j++) work[j] = available[j];

    int finish[MAX_P] = {0};
    for (int i = 0; i < n; i++) {
        int holds = 0;
        for (int j = 0; j < r; j++) {
            if (alloc[i][j] > 0) { holds = 1; break; }
        }
        // If process holds 0 resources (including victim!), it cannot be in a deadlock
        finish[i] = (holds == 0) ? 1 : 0;
    }

    g_recoveryStepCount = 0;
    int resolvedSequence[MAX_P];
    int resolvedCount = 0;

    while (1) {
        int found = 0;
        for (int i = 0; i < n; i++) {
            if (finish[i] == 0) {
                int canSatisfy = 1;
                for (int j = 0; j < r; j++) {
                    if (request[i][j] > work[j]) {
                        canSatisfy = 0;
                        break;
                    }
                }

                if (g_recoveryStepCount < MAX_STEPS) {
                    DetectionStep *st = &g_recoverySteps[g_recoveryStepCount++];
                    st->stepNumber = g_recoveryStepCount;
                    st->process = i;
                    st->canComplete = canSatisfy;
                    for (int j = 0; j < r; j++) {
                        st->workBefore[j] = work[j];
                        st->request[j] = request[i][j];
                        st->alloc[j] = alloc[i][j];
                        st->workAfter[j] = canSatisfy ? (work[j] + alloc[i][j]) : work[j];
                    }
                    for (int p_idx = 0; p_idx < n; p_idx++) {
                        st->finishBefore[p_idx] = finish[p_idx];
                        st->finishAfter[p_idx] = (canSatisfy && p_idx == i) ? 1 : finish[p_idx];
                    }
                    if (canSatisfy) {
                        snprintf(st->note, sizeof(st->note),
                                 "Request <= Work. P%d can finish and release its resources.", i);
                    } else {
                        snprintf(st->note, sizeof(st->note),
                                 "Request > Work. P%d cannot be satisfied with current available resources.", i);
                    }
                }

                if (canSatisfy) {
                    for (int j = 0; j < r; j++) work[j] += alloc[i][j];
                    finish[i] = 1;
                    resolvedSequence[resolvedCount++] = i;
                    found = 1;
                    break;
                }
            }
        }
        if (!found) break;
    }

    int stillDeadlocked = 0;
    int remainingDeadlocked[MAX_P];
    int remainingCount = 0;

    for (int i = 0; i < n; i++) {
        // Victim was terminated and marked finished, so it is never reported as remaining deadlocked
        if (i != victim && finish[i] == 0) {
            stillDeadlocked = 1;
            remainingDeadlocked[remainingCount++] = i;
        }
    }

    printf("{\n");
    printf("  \"success\": true,\n");
    printf("  \"terminatedPid\": %d,\n", victim);
    printf("  \"totalVictimAlloc\": %d,\n", totalVictimAlloc);
    printf("  \"isDeadlockedAfterRecovery\": %s,\n", stillDeadlocked ? "true" : "false");

    printf("  \"reclaimedResources\": [");
    for (int j = 0; j < r; j++) printf("%d%s", reclaimed[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"updatedAvailable\": [");
    for (int j = 0; j < r; j++) printf("%d%s", available[j], (j < r - 1) ? ", " : "");
    printf("],\n");

    printf("  \"updatedAlloc\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", alloc[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    printf("  \"updatedRequest\": [\n");
    for (int i = 0; i < n; i++) {
        printf("    [");
        for (int j = 0; j < r; j++) printf("%d%s", request[i][j], (j < r - 1) ? ", " : "");
        printf("]%s\n", (i < n - 1) ? "," : "");
    }
    printf("  ],\n");

    printf("  \"remainingDeadlockedProcesses\": [");
    for (int i = 0; i < remainingCount; i++) printf("%d%s", remainingDeadlocked[i], (i < remainingCount - 1) ? ", " : "");
    printf("],\n");

    printf("  \"resolvedSequence\": [");
    for (int i = 0; i < resolvedCount; i++) printf("%d%s", resolvedSequence[i], (i < resolvedCount - 1) ? ", " : "");
    printf("],\n");

    // Trace of post-recovery detection
    printf("  \"detectionTrace\": [\n");
    for (int s = 0; s < g_recoveryStepCount; s++) {
        DetectionStep *st = &g_recoverySteps[s];
        printf("    {\n");
        printf("      \"stepNumber\": %d,\n", st->stepNumber);
        printf("      \"process\": %d,\n", st->process);
        printf("      \"canComplete\": %s,\n", st->canComplete ? "true" : "false");
        printf("      \"workBefore\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workBefore[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"request\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->request[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"alloc\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->alloc[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"workAfter\": [");
        for (int j = 0; j < r; j++) printf("%d%s", st->workAfter[j], (j < r - 1) ? ", " : "");
        printf("],\n");
        printf("      \"finishAfter\": [");
        for (int p_idx = 0; p_idx < n; p_idx++) printf("%s%s", st->finishAfter[p_idx] ? "true" : "false", (p_idx < n - 1) ? ", " : "");
        printf("],\n");
        printf("      \"note\": \"%s\"\n", st->note);
        printf("    }%s\n", (s < g_recoveryStepCount - 1) ? "," : "");
    }
    printf("  ],\n");

    if (!stillDeadlocked) {
        printf("  \"explanation\": \"DEADLOCK RESOLVED: Terminating process P%d released all its held resources back to Available. The circular wait cycle was broken, and all remaining processes can now finish.\"\n", victim);
    } else {
        printf("  \"explanation\": \"DEADLOCK STILL EXISTS: Process P%d was terminated and its resources reclaimed, but a deadlock cycle still persists among remaining processes { ", victim);
        for (int i = 0; i < remainingCount; i++) {
            printf("P%d%s", remainingDeadlocked[i], (i < remainingCount - 1) ? ", " : "");
        }
        printf(" }. Another recovery action may be needed.\"\n");
    }
    printf("}\n");

    free(buf);
    return 0;
}
