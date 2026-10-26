/*
 * ============================================================================
 * PROJECT: DEADLOCK LAB
 * MODULE: Deadlock Detection Algorithm (Multiple-Instance Resources)
 * ============================================================================
 * Theoretical Foundation (Silberschatz / Galvin):
 * 1. Work = Available
 * 2. For i = 0 to n-1:
 *      if Alloc[i] != 0: Finish[i] = false
 *      else:             Finish[i] = true (processes holding 0 resources can't deadlock)
 * 3. Find i such that Finish[i] == false and Request[i] <= Work.
 *    If found:
 *      Work = Work + Alloc[i]
 *      Finish[i] = true
 *      Repeat Step 3.
 * 4. If Finish[i] == false for any i, system is in DEADLOCK, and process i is deadlocked.
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

static DetectionStep g_detectionSteps[MAX_STEPS];
static int g_detectionStepCount = 0;

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
        printf("Deadlock Lab - Deadlock Detection Module. Run with --json for API mode.\n");
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

    int n = 0, r = 0;
    int alloc[MAX_P][MAX_R] = {0};
    int request[MAX_P][MAX_R] = {0};
    int available[MAX_R] = {0};

    char *p = findKey(buf, "n");
    if (p) n = parseInteger(&p);
    p = findKey(buf, "r");
    if (p) r = parseInteger(&p);

    if (n < 1 || n > MAX_P || r < 1 || r > MAX_R) {
        printf("{\"error\":\"Invalid dimensions: N must be 1..%d, R must be 1..%d\"}\n", MAX_P, MAX_R);
        free(buf);
        return 1;
    }

    p = findKey(buf, "alloc");
    if (p) parse2DArray(p, alloc, n, r);
    p = findKey(buf, "request");
    if (p) parse2DArray(p, request, n, r);
    p = findKey(buf, "available");
    if (p) parseIntArray(p, available, r);

    // Initialize Work = Available
    int work[MAX_R];
    for (int j = 0; j < r; j++) work[j] = available[j];

    // Initialize Finish flags
    int finish[MAX_P] = {0};
    for (int i = 0; i < n; i++) {
        int holdsResources = 0;
        for (int j = 0; j < r; j++) {
            if (alloc[i][j] > 0) {
                holdsResources = 1;
                break;
            }
        }
        // If process holds 0 resources, it cannot be in a deadlock
        finish[i] = (holdsResources == 0) ? 1 : 0;
    }

    g_detectionStepCount = 0;
    int resolvedSequence[MAX_P];
    int resolvedCount = 0;

    // Detection Algorithm Loop
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

                if (g_detectionStepCount < MAX_STEPS) {
                    DetectionStep *st = &g_detectionSteps[g_detectionStepCount++];
                    st->stepNumber = g_detectionStepCount;
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
                                 "Request <= Work. P%d can finish and release its allocated resources.", i);
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
                    break; // Restart scan to give earlier processes a chance with newly freed resources
                }
            }
        }

        if (!found) break; // No further process can be satisfied
    }

    // Identify deadlocked processes
    int isDeadlocked = 0;
    int deadlockedProcesses[MAX_P];
    int deadlockedCount = 0;

    for (int i = 0; i < n; i++) {
        if (finish[i] == 0) {
            isDeadlocked = 1;
            deadlockedProcesses[deadlockedCount++] = i;
        }
    }

    // JSON Output
    printf("{\n");
    printf("  \"success\": true,\n");
    printf("  \"isDeadlocked\": %s,\n", isDeadlocked ? "true" : "false");
    printf("  \"deadlockedCount\": %d,\n", deadlockedCount);
    printf("  \"deadlockedProcesses\": [");
    for (int i = 0; i < deadlockedCount; i++) {
        printf("%d%s", deadlockedProcesses[i], (i < deadlockedCount - 1) ? ", " : "");
    }
    printf("],\n");

    printf("  \"resolvedSequence\": [");
    for (int i = 0; i < resolvedCount; i++) {
        printf("%d%s", resolvedSequence[i], (i < resolvedCount - 1) ? ", " : "");
    }
    printf("],\n");

    printf("  \"finalFinish\": [");
    for (int i = 0; i < n; i++) {
        printf("%s%s", finish[i] ? "true" : "false", (i < n - 1) ? ", " : "");
    }
    printf("],\n");

    printf("  \"finalWork\": [");
    for (int j = 0; j < r; j++) {
        printf("%d%s", work[j], (j < r - 1) ? ", " : "");
    }
    printf("],\n");

    // Iterations / Trace steps
    printf("  \"trace\": [\n");
    for (int s = 0; s < g_detectionStepCount; s++) {
        DetectionStep *st = &g_detectionSteps[s];
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
        printf("    }%s\n", (s < g_detectionStepCount - 1) ? "," : "");
    }
    printf("  ],\n");

    if (isDeadlocked) {
        printf("  \"explanation\": \"DEADLOCK CONFIRMED: One or more processes are permanently blocked waiting for resources held by each other. Processes { ");
        for (int i = 0; i < deadlockedCount; i++) {
            printf("P%d%s", deadlockedProcesses[i], (i < deadlockedCount - 1) ? ", " : "");
        }
        printf(" } cannot proceed without external preemption or termination.\"\n");
    } else {
        printf("  \"explanation\": \"NO DEADLOCK: All active processes can eventually obtain their requested resources and complete execution.\"\n");
    }
    printf("}\n");

    free(buf);
    return 0;
}
