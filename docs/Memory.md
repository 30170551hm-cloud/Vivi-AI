# Vivi AI - Memory & Continuity

This document describes the cognitive memory architecture (`src/vivi/modules/ViviMemory.js`), which decouples memory storage, categorization, auto-extraction, and recall from the language model itself.

---

## 1. Memory Categories & Structure

The memory module classifies user statements into structured, searchable records. Every memory entry in Firestore maps to one of the following category identifiers:

- **Identity & Preferences**: `name` (Names/Nicknames), `preference` (Likes, dislikes, aesthetic choices)
- **Work & Projects**: `work` (Employment), `company` (Employer profiles), `project` (Active pipelines), `task` (To-do lists), `milestone` (Significant accomplishments)
- **Routines & Chronology**: `routine` (Daily habits), `calendar` (Schedules/bookings), `reminder` (Time-locked notices), `fact` (General persistent truths)
- **Personal Content**: `relationship` (Connections/families), `story` (Anecdotes, trivia, long-form gossip), `decision` (Chosen options), `document` (Associated links or summaries)

### Memory Record Schema:
```typescript
interface Memory {
  id?: string;
  category: string;       // e.g. 'preference'
  key: string;            // Short keyword hook
  value: string;          // Rich text detail
  importance: number;     // Scale of 1 to 10 (boosts recall)
  tags: string[];         // Token indices for search matching
  is_milestone: boolean;  // Renders on administrative timelines
  timeline_date?: string; // ISO Date YYYY-MM-DD
}
```

---

## 2. Bootstrapping and Hydration Flow

1. **System Initialization**: During engine bootstrap, `ViviMemory` automatically calls `loadPermanentContext()`.
2. **Database Retrieval**: Retrieves up to **200 memories** sorted by importance (`backend.entities.Memory.list('-importance', 200)`).
3. **History Hydration**: Pulls the last **20 turns** of conversation history (`backend.entities.ChatMessage.list('-created_date', 20)`) to maintain conversational context.
4. **Active Cache**: Sinks these lists to an in-memory session cache (`this._cache`) so subsequent steps can read context instantly with no database roundtrip latency.

---

## 3. High-Performance Retrieval Algorithm

To match relevant context when constructing prompts, the memory engine runs a localized token-matching algorithm:

- **Tokenization**: Splitting the active user message by whitespace, filtering out short stop-words, and stripping out non-alphanumeric characters.
- **Relevance Scoring**: Iterating over all cached memories, incrementing the relevance score whenever a memory's key, value, or tags overlap with active tokens.
- **Importance Weighting**: Multiplying or adding importance weights:
  $$\text{Score} = \text{Match Count} + (\text{importance} \times 0.1)$$
- **Sorting & Slicing**: Retaining entries scoring above $0.1$, sorting descending by score, and returning the top **15 matches** to the prompt builder.

---

## 4. Autonomous Memory Extraction

At the end of every user-assistant interaction, the system runs an asynchronous **Memory Extraction Loop**:
- If a conversation turn contains a clear statement of fact or preference, a background call evaluates whether to generate a new memory.
- If verified, the system generates a structured Memory record, assigns a category and importance level, and updates both the active memory cache and the remote Firestore collections without blocking the primary user conversation thread.
- Standard import and export methods allow exporting the entire memory store as a portable JSON file or restoring from a backup file.
