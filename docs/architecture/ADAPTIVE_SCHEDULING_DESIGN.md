# Adaptive Scheduling Design Specification

**Project:** Intelligent P2P Edge File Distribution System with Adaptive Network  
**Document Version:** 1.0.0  
**Phase:** Phase 2 — Requirements & System Design  
**Implementation Target:** Phase 6  
**Status:** Approved for Architecture Baseline  

---

## 1. Objectives & Algorithmic Rationale

In a decentralized edge swarm, participant nodes exhibit severe heterogeneity: varying upstream capacities, physical distances, Wi-Fi jitter, and fluctuating CPU loads. A naive scheduling algorithm (such as simple Round-Robin or Random Chunk Requesting) suffers from the **convoy effect**: slow or stalled peers bottleneck overall download completion, leading to sub-optimal throughput and prolonged download times.

The **Adaptive Network Scheduling Engine** addresses this by:
1. Dynamically profiling each peer's real-time network capability.
2. Formulating a normalized, multi-factor utility score.
3. Allocating chunk requests proportionally to high-performing peers.
4. Balancing **Exploitation** (streaming from proven fast peers) with **Exploration** (probing newly connected or untested peers to discover superior routes).
5. Preventing duplicate work and resolving stalled transfers rapidly.

---

## 2. Telemetry Metrics Collection

For every active peer connection $p_i$ in the client's swarm, the client maintains a dynamic metrics tuple:
$$M_i = \langle T_i, L_i, S_i, F_i, A_{i,k} \rangle$$

| Metric Symbol | Metric Name | Measurement Mechanism | Unit |
| :--- | :--- | :--- | :--- |
| $T_i$ | **Throughput** | Calculated upon receipt of verified chunk: $T_i = \frac{\text{Chunk Bytes}}{\text{Elapsed Transfer Seconds}}$. | Bytes/sec |
| $L_i$ | **Round-Trip Latency** | Measured via periodic lightweight WebRTC DataChannel ping/pong frames: $L_i = t_{\text{pong}} - t_{\text{ping}}$. | Milliseconds (ms) |
| $S_i$ | **Success Delivery Ratio** | Ratio of successfully verified chunks to total completed requests: $S_i = \frac{C_{\text{verified}, i}}{C_{\text{attempted}, i}}$. | Range $[0.0, 1.0]$ |
| $F_i$ | **Recent Failure Penalty** | Count of timeouts or corrupted chunk deliveries observed within the trailing 60 seconds. | Integer $\ge 0$ |
| $A_{i,k}$ | **Chunk Possession** | Boolean flag indicating whether peer $p_i$ holds chunk $c_k$ according to its advertised bitfield: $A_{i,k} \in \{0, 1\}$. | Binary $\{0, 1\}$ |

---

## 3. Metric Normalization & Exponential Decay

Raw metrics span wildly different physical dimensions (milliseconds vs. megabytes/sec). To prevent any single dimension from dominating, all metrics are normalized to the closed interval $[0.0, 1.0]$.

### 3.1 Throughput Normalization ($\hat{T}_i$)
Throughput is normalized against the maximum throughput observed among all currently connected peers in the swarm:
$$\hat{T}_i = \frac{T_i}{\max(T_{\text{swarm}}, 1024)}$$
If peer $p_i$ has not yet delivered a chunk, it is initialized with an optimistic median default $\hat{T}_{\text{init}} = 0.5$.

### 3.2 Latency Normalization ($\hat{L}_i$)
Because lower latency represents superior performance, latency is inverted and scaled using a non-linear decay function bounded between 0 and 1:
$$\hat{L}_i = \exp\left(-\frac{L_i}{L_{\text{ref}}}\right)$$
where $L_{\text{ref}} = 250\text{ ms}$ (the reference latency scaling factor). A latency of 0 ms yields 1.0; a latency of 250 ms yields 0.368; 1000 ms yields 0.018.

### 3.3 Failure Penalty Normalization ($\hat{F}_i$)
$$\hat{F}_i = \min\left(1.0, \frac{F_i}{3}\right)$$
Three recent failures scale the penalty to maximum (1.0).

### 3.4 Exponential Moving Average (EMA) for Metric Freshness
To discard stale historical metrics and respond rapidly to edge network fluctuations (e.g., someone starting a video stream on the peer's local Wi-Fi), metrics are updated using an Exponential Moving Average:
$$T_i^{(t)} = \alpha \cdot T_i^{\text{sample}} + (1 - \alpha) \cdot T_i^{(t-1)}$$
where $\alpha = 0.3$ (smoothing factor giving 70% weight to recent history and 30% to the latest observation).

---

## 4. Composite Scoring Formula

The composite score $\text{Score}(p_i, c_k)$ evaluates the suitability of peer $p_i$ to deliver chunk $c_k$:

$$\text{Score}(p_i, c_k) = A_{i,k} \cdot \left[ w_T \cdot \hat{T}_i + w_L \cdot \hat{L}_i + w_S \cdot S_i - w_F \cdot \hat{F}_i \right]$$

### Configurable Weight Vector:
| Term | Weight Symbol | Default Value | Mathematical Role | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| Normalized Throughput | $w_T$ | **0.45** | Additive Reward | Throughput is the dominant factor determining raw download duration. |
| Normalized Latency | $w_L$ | **0.25** | Additive Reward | Low latency ensures rapid round-trip request pipelining and reduced wait states. |
| Success Delivery Ratio | $w_S$ | **0.20** | Additive Reward | Prioritizes reliable peers who consistently deliver valid cryptographic chunks. |
| Failure Penalty | $w_F$ | **0.30** | Subtractive Deduction | Aggressively suppresses peers experiencing packet loss or network degradation. |

### 4.1 Weight Vector Architecture & Normalization Analysis

An inspection of the absolute weight magnitudes reveals:
$$\sum |w| = 0.45 + 0.25 + 0.20 + 0.30 = 1.20$$

**Mathematical Rationale:**
1. **Separation of Positive Utility and Risk Deduction:**
   The scoring formulation is a *utility-risk penalty model*, not a single probability simplex or convex combination:
   $$\text{Score}(p_i, c_k) = A_{i,k} \cdot \left[ \underbrace{w_T \cdot \hat{T}_i + w_L \cdot \hat{L}_i + w_S \cdot S_i}_{\text{Positive Utility } U(p_i) \in [0.0, 0.90]} - \underbrace{w_F \cdot \hat{F}_i}_{\text{Risk Penalty } P(p_i) \in [0.0, 0.30]} \right]$$
   - The **Positive Reward Weights** sum to:
     $$\sum w_{\text{positive}} = w_T + w_L + w_S = 0.45 + 0.25 + 0.20 = 0.90$$
   - The **Failure Penalty** $w_F = 0.30$ is **subtracted**, deducting up to $0.30$ for $F_i \ge 3$ consecutive timeouts.
   - The value $1.20$ is an arithmetic sum of positive rewards and subtractive penalties; it does not indicate unnormalized probability weights.

2. **Rank Invariance under Relative Weighting:**
   Because peer selection operates via the argmax operator $\arg\max_i \text{Score}(p_i, c_k)$, relative candidate rankings depend strictly on the relative weight ratios ($w_T : w_L : w_S = 45 : 25 : 20$).

3. **Normalized Convex Model Equivalent:**
   If positive weights are normalized to sum to exactly $1.00$ while preserving relative ratios:
   - $\tilde{w}_T = \frac{0.45}{0.90} = 0.500$ (50.0% Throughput)
   - $\tilde{w}_L = \frac{0.25}{0.90} \approx 0.278$ (27.8% Latency)
   - $\tilde{w}_S = \frac{0.20}{0.90} \approx 0.222$ (22.2% Success Ratio)
   - Penalty: $\tilde{w}_F = \frac{0.30}{0.90} \approx 0.333$ (or retained at $0.30$ for direct unit penalty).
   
   Both the Phase 2 baseline ($0.45, 0.25, 0.20$) and the normalized convex formulation ($0.50, 0.28, 0.22$) produce identical candidate peer ranking orders across all swarm permutations. The baseline weights are retained as the research standard, with the UI workbench offering both baseline and normalized presets for sensitivity analysis.

*Note on Invariants:*
- If peer $p_i$ does not possess chunk $c_k$, $A_{i,k} = 0$, forcing $\text{Score}(p_i, c_k) = 0$.
- If a peer's computed score falls below a minimum threshold ($\text{Score} \le 0.10$), the peer is demoted from active selection until re-evaluated during an exploration cycle.

---

## 5. Chunk Assignment & Exploration Strategy

### 5.1 Concurrency Limits & Pipeline Windows
Each peer $p_i$ has a maximum concurrent in-flight request window $W_i$:
$$W_i = \max\left(1, \min\left(4, \left\lfloor \frac{T_i}{256\text{ KB/s}} \right\rfloor\right)\right)$$
- High-bandwidth peers can service up to 4 parallel chunk requests.
- Slower or newly joined peers are restricted to 1 chunk at a time to prevent pipeline saturation.

### 5.2 Exploration vs. Exploitation ($\epsilon$-Greedy Scheduling)
To prevent the system from getting trapped in a local optimum (continuously utilizing only the first peer that responded while ignoring potentially faster newly joined peers), the scheduler adopts an $\epsilon$-greedy policy:
- **Exploitation ($1 - \epsilon = 0.85$):** 85% of chunk requests are assigned strictly to the highest-scoring candidate peer.
- **Exploration ($\epsilon = 0.15$):** 15% of chunk requests are allocated to an untested or newly connected peer to measure its throughput and latency.

### 5.3 Duplicate Work Prevention
1. **Global In-Flight Registry:**
   The scheduler maintains an in-memory `Set<chunk_index>` of chunks currently being transferred. No chunk in the in-flight registry may be requested from a second peer unless its deadline timer expires.
2. **End-Game Mode (Rarest-First Completion):**
   When remaining unverified chunks $\le 3$ and progress exceeds 95%, the scheduler enters **End-Game Mode**. In this phase, the remaining chunks are requested redundantly across the top-2 ranked peers and the origin storage simultaneously. The first valid SHA-256 arrival wins; duplicate late arrivals are discarded, preventing the entire download from stalling on a final slow peer.

---

## 6. Benchmarking & Baseline Comparison Protocol

To validate the adaptive algorithm empirically in Phase 6, the test harness will benchmark downloads against standard baselines under identical simulated network conditions:

| Strategy | Description | Expected Characteristics |
| :--- | :--- | :--- |
| **Origin Only (Baseline 0)** | 100% of chunks downloaded directly from Supabase Object Storage via HTTP. | Stable speed, maximum origin egress bandwidth cost, zero peer collaboration. |
| **Random P2P (Baseline 1)** | Available chunks requested from randomly chosen peers possessing the chunk without metrics. | Severe convoy effect; volatile completion times; vulnerability to slow peers. |
| **Round-Robin P2P (Baseline 2)** | Chunks assigned sequentially across connected peers in fixed cyclical order. | Moderate performance; blocked pipelines when one peer experiences packet loss. |
| **Adaptive Scheduling (Proposed)**| Dynamic scoring, latency/throughput weighting, $\epsilon$-greedy exploration, and origin fallback. | Expected minimal completion time, resilient handling of peer churn, maximized P2P offload. |

*Acceptance Gate for Phase 6:* The adaptive algorithm must demonstrate a statistically significant reduction in mean completion time compared to Random P2P across a 5-node heterogeneous testbed.
