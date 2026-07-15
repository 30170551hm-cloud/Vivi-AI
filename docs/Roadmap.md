# Vivi AI - Strategic Development Roadmap

This document outlines the planned developmental milestones and architectural enhancements for the **Vivi AI** platform, grouped by structural tracks.

---

## Track 1: Core Intelligence & Multi-Modal Streaming

### 1.1 Real-Time Audio & Video Intake
- **Goal**: Transition from discrete frame-by-frame analysis to continuous, real-time multi-modal streaming.
- **Implementation**: Leverage Gemini's Live API via secure server-side WebSockets, feeding audio levels and video streams directly to the model. This will enable real-time responses with sub-second latency.
- **Prerequisites**: Update `metadata.json` frame permissions to request persistent microphone and camera access.

### 1.2 Multi-Turn Context Summarization
- **Goal**: Optimize prompt token consumption over long, multi-hour conversation sessions.
- **Implementation**: Implement a background summarization loop inside `ViviCore`. This will compress historical message blocks into concise context vectors before they exceed token limits.

---

## Track 2: Advanced Semantic Memory & RAG

### 2.1 Dense Vector Search Integration
- **Goal**: Replace simple keyword token-matching in `ViviMemory` with dense semantic vector searches.
- **Implementation**: Connect to an embeddings API to generate 768-dimensional text embeddings, storing and querying them via Firestore or a lightweight, client-side vector search engine.
- **Outcome**: Retrieve highly relevant memories based on abstract semantic meaning rather than exact word matches.

### 2.2 Hierarchical Memory Pruning
- **Goal**: Prevent memory clutter from accumulating over months of continuous daily use.
- **Implementation**: Introduce an automated "forgetting curve" algorithm. This will reduce the importance score of inactive memories over time while boosting frequently recalled preferences.

---

## Track 3: Security, Auditing & Administrative Guardrails

### 3.1 Privileged Audit Logs
- **Goal**: Maintain tamper-proof compliance logs for administrative actions taken via the Founder Console or Vivi Development Environment (VDE).
- **Implementation**: Write immutable audit logs directly to a secure collection in Firestore whenever sensitive tools (such as code editing or file management tools) are invoked.

### 3.2 Granular User Space Isolation
- **Goal**: Ensure absolute tenant-data isolation in shared cloud environments.
- **Implementation**: Enforce strict Firestore security rules (`firestore.rules`) to guarantee users can only read or write documents where `created_by_id` matches their verified Firebase Auth UID.

---

## Track 4: Performance, Caching & Mobile Web

### 4.1 Chunked TTS Prefetching
- **Goal**: Eliminate delays and pauses when vocalizing long responses on mobile web browsers.
- **Implementation**: Implement predictive TTS prefetching. This will pre-render and queue upcoming text chunks in the browser synthesis buffer while the current sentence is actively playing.

### 4.2 Edge-Cached Server Proxies
- **Goal**: Minimize API round-trip latency for general regional inquiries.
- **Implementation**: Set up Edge Caching on backend Express proxy endpoints to serve cached responses for common system queries (like localization, Venezuelan facts, and static help menus).
