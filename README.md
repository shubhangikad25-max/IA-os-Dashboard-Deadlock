# DEADLOCK LAB — Interactive Operating Systems Dashboard

**Interactive Deadlock Analysis and Resource Allocation Simulator with Native C Algorithm Engine**

Designed and built for undergraduate Operating Systems laboratory practicals, project demonstrations, and oral viva examinations.

---

## 1. Project Overview & Objective

**DEADLOCK LAB** is a full-stack educational dashboard that visualizes, analyzes, and explains the core concepts of Operating Systems resource allocation, deadlock avoidance, detection, prevention, and recovery.

Instead of running mock simulations or replacing real systems code with JavaScript approximations, the system connects a clean, modern browser interface directly to compiled **native C algorithms** running Dijkstra's Banker's Algorithm and Havender-Coffman deadlock detection models.

### Key Capabilities
1. **Interactive Matrix Configurator**: Configure 1–50 processes ($N$) and 1–20 resource types ($M$) with custom alphanumeric labels ($A, B, C\dots$).
2. **Dual Resource Modes**:
   - **Mode A (Total Resources)**: Enter total system resources; Available is calculated dynamically as $\text{Available}[j] = \text{Total}[j] - \sum_{i}\text{Allocation}[i][j]$.
   - **Mode B (Direct Available)**: Enter Available resources directly, exactly matching standard Operating Systems textbook tables (Silberschatz, Galvin, Gagne).
3. **Step-by-Step Banker's Safety Simulator**: Inspect each evaluation step with individual comparison cards, work vector calculations, finish arrays, row highlights, and safe sequences.
4. **4-Stage Resource Request Simulator**: Complete pipeline validating Need constraints, Availability, hypothetical state mutation, and safety verification with instant rollback.
5. **Physical Resource Change**: Add or remove physical instances ($\text{changeResources}$) safely.
6. **Separate Multi-Instance Deadlock Detection**: Detects existing circular wait blockages in active systems using the Request and Allocation matrices.
7. **Deadlock Recovery via Termination**: Aborts selected victim processes, reclaims held resources, and re-runs detection to verify system progress.
8. **Deadlock Prevention Protocols**: Implements linear resource ordering ($A < B < C$) and Hold-and-Wait elimination with OS trade-off analysis.
9. **Automated Analytical Test Suite (TC1–TC12)**: 12 comprehensive automated test cases verified against native C executables.
10. **C Code Explorer & Viva Guide**: Beginner-friendly function-by-function documentation covering complexity, loops, and interview questions.
11. **Academic AI Usage Record**: Transparent disclosure ledger for university project submissions.

---

## 2. Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Light Theme: White + Blue Palette `#F5F8FF`, `#2563EB`, `#DBEAFE`), Vanilla JavaScript (No React, TypeScript, or heavy frameworks).
- **Core Algorithms**: Native C language (C99 standard, zero external libraries).
- **Compiler**: GCC (MinGW-w64 14.2).
- **Backend / Connector**: Node.js & Express (`child_process.execFile` pipe with structured JSON stdin/stdout).

---

## 3. Project Directory Structure

```
DEADLOCK-LAB/
├── c/
│   ├── banker.c              # Banker's safety algorithm & changeResources()
│   ├── resource_request.c    # 4-stage resource request protocol
│   ├── deadlock_detection.c  # Multi-instance deadlock detection algorithm
│   ├── recovery.c            # Process termination & resource reclamation
│   ├── banker.exe            # Compiled native executable
│   ├── resource_request.exe  # Compiled native executable
│   ├── deadlock_detection.exe# Compiled native executable
│   └── recovery.exe          # Compiled native executable
├── backend/
│   ├── server.js             # Express API server & static file host
│   ├── c_runner.js           # Safe child_process C executor & JSON bridge
│   ├── compile.js            # Automated GCC build & verification script
│   └── test_suite.js         # Automated test runner for TC1-TC12
├── public/
│   ├── index.html            # Main dashboard interface
│   ├── css/
│   │   └── style.css         # Educational light-blue design system
│   └── js/
│       ├── api.js            # Frontend REST API client
│       ├── state.js          # Reactive global application state
│       ├── app.js            # Application coordinator & input table builder
│       ├── simulation.js     # Step-by-step Banker's visualizer
│       ├── request_simulator.js # Resource request & change simulator
│       ├── detection.js      # Multi-instance deadlock detection visualizer
│       ├── prevention.js     # Resource ordering & hold-and-wait UI
│       ├── recovery_ui.js    # Victim termination modal & recovery
│       ├── test_runner.js    # TC1-TC12 automated test suite UI
│       ├── code_explorer.js  # C code viewer & function viva cards
│       └── ai_record.js      # Editable academic AI usage record
├── package.json
└── README.md
```

---

## 4. How the C Algorithms Work

### 1. Banker's Algorithm (`c/banker.c`)
- **Need Calculation**:
  $$\text{Need}[i][j] = \text{Max}[i][j] - \text{Allocation}[i][j]$$
- **Safety Algorithm**:
  1. Let $\text{Work} = \text{Available}$ and $\text{Finish}[i] = \text{false}$ for all $i \in \{0, \dots, n-1\}$.
  2. Find an index $i$ such that $\text{Finish}[i] == \text{false}$ and $\text{Need}[i][j] \le \text{Work}[j]$ for all resource types $j$.
  3. If found:
     $$\text{Work}[j] = \text{Work}[j] + \text{Allocation}[i][j]$$
     $$\text{Finish}[i] = \text{true}$$
     Repeat Step 2.
  4. If all $\text{Finish}[i] == \text{true}$, system is **SAFE**.

### 2. Resource-Request Algorithm (`c/resource_request.c`)
- **Stage 1**: Check if $\text{Request}_i[j] \le \text{Need}_i[j]$. If violated $\rightarrow$ **INVALID CLAIM**.
- **Stage 2**: Check if $\text{Request}_i[j] \le \text{Available}[j]$. If violated $\rightarrow$ **WAIT** (resources currently unavailable).
- **Stage 3**: Temporarily allocate resources:
  $$\text{Available} = \text{Available} - \text{Request}_i$$
  $$\text{Allocation}_i = \text{Allocation}_i + \text{Request}_i$$
  $$\text{Need}_i = \text{Need}_i - \text{Request}_i$$
- **Stage 4**: Execute Safety Algorithm. If safe $\rightarrow$ **GRANT & COMMIT**; if unsafe $\rightarrow$ **DENY & ROLLBACK**.

### 3. Deadlock Detection (`c/deadlock_detection.c`)
- Uses $\text{Allocation}[N][M]$, $\text{Request}[N][M]$, and $\text{Available}[M]$.
- Initializes $\text{Finish}[i] = \text{true}$ if process $i$ holds 0 resources ($\text{Alloc}[i] == 0$); otherwise $\text{false}$.
- Iteratively satisfies processes whose outstanding $\text{Request}[i] \le \text{Work}$.
- Any process with $\text{Finish}[i] == \text{false}$ at the end is **CONFIRMED DEADLOCKED**.

---

## 5. Prerequisites & Installation

### Requirements
- **Node.js** (v18 or higher recommended; v24 installed)
- **GCC Compiler** (MinGW, MinGW-w64, or Code::Blocks MinGW)

### Setup & Compilation

1. Open a terminal in the project directory:
   ```bash
   cd "path/to/IA-OS"
   ```

2. Install backend dependencies:
   ```bash
   npm install
   ```

3. Compile all C source files with GCC:
   ```bash
   npm run compile
   ```
   *(Executables are generated in the `c/` directory: `banker.exe`, `resource_request.exe`, `deadlock_detection.exe`, `recovery.exe`)*

4. Run the automated analytical test suite:
   ```bash
   npm test
   ```
   *(All 12 test cases will run against the compiled C executables, displaying PASS for TC1–TC12)*

5. Start the application server:
   ```bash
   npm start
   ```

6. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 6. Sample Input & Expected Results

### Standard 5-Process, 3-Resource Textbook Scenario ($N=5, M=3$):

#### Allocation Matrix
| Process | A | B | C |
|---|:---:|:---:|:---:|
| **P0** | 0 | 1 | 0 |
| **P1** | 2 | 0 | 0 |
| **P2** | 3 | 0 | 2 |
| **P3** | 2 | 1 | 1 |
| **P4** | 0 | 0 | 2 |

#### Maximum Matrix
| Process | A | B | C |
|---|:---:|:---:|:---:|
| **P0** | 7 | 5 | 3 |
| **P1** | 3 | 2 | 2 |
| **P2** | 9 | 0 | 2 |
| **P3** | 2 | 2 | 2 |
| **P4** | 4 | 3 | 3 |

#### Available Resources Vector
$$\text{Available} = [3, 3, 2]$$

### Computed Need Matrix ($\text{Max} - \text{Alloc}$)
- **P0**: $[7, 4, 3]$
- **P1**: $[1, 2, 2]$
- **P2**: $[6, 0, 0]$
- **P3**: $[0, 1, 1]$
- **P4**: $[4, 3, 1]$

### Expected Safety Result
- **System Safety**: **SAFE**
- **Safe Sequence**: $P_1 \rightarrow P_3 \rightarrow P_4 \rightarrow P_0 \rightarrow P_2$ (or $P_1 \rightarrow P_3 \rightarrow P_4 \rightarrow P_2 \rightarrow P_0$)

---

## 7. Viva & Oral Exam Quick Reference

### Q1: What is the difference between Deadlock Avoidance and Deadlock Detection?
- **Deadlock Avoidance (Banker's)**: Evaluates dynamic requests *before* allocation. If an allocation would transition the system into an *unsafe* state, the request is denied or delayed. Requires prior knowledge of each process's maximum claim.
- **Deadlock Detection**: Allows requests to be granted immediately without safety checks. Periodically runs an algorithm on current allocations and outstanding requests to check if an *actual circular deadlock* has already occurred.

### Q2: Is an unsafe state necessarily a deadlocked state?
- **No.** An unsafe state only means that the operating system cannot *guarantee* that deadlock will not occur if every process demands its maximum claim simultaneously. If processes finish without demanding their maximum claim, execution may complete safely.

### Q3: What are the 4 Coffman conditions for deadlock?
1. **Mutual Exclusion**: Non-shareable resource access.
2. **Hold and Wait**: Process holding resources while requesting new ones.
3. **No Preemption**: Resources cannot be forcibly taken.
4. **Circular Wait**: Closed loop of dependency ($P_0 \rightarrow P_1 \rightarrow \dots \rightarrow P_0$).

### Q4: How does linear resource ordering prevent deadlock?
- Imposes a total global ordering $F: R \rightarrow \mathbb{N}$ (e.g., $A < B < C$). A process can only request a resource $R_j$ if $F(R_j) > F(R_i)$ for all currently held resources $R_i$. Because all resource acquisitions must be strictly increasing, a circular cycle is mathematically impossible.

---

## 8. Known Limitations & Design Boundaries
1. **Dimension Bounds**: Validated for $1 \le N \le 50$ processes and $1 \le M \le 20$ resource types.
2. **Integer Values**: Supports non-negative integer resource counts.
3. **C Binary Architecture**: GCC executables run natively on host platform (Windows 64-bit MinGW).
