---
name: claudemem
description: Implement persistent long-term memory for the project context
---

# ClaudeMem Memory Management Skill

This skill manages a persistent "Project Brain" that allows the AI to remember architectural decisions, complex bugs, and user preferences across sessions.

## Workflow

1. **Memory Initialization**:
   - Create a dedicated memory directory: `.claude/memory/`.
   - Establish a `MEMORY.md` index file to track all memory fragments.

2. **Memory Capture (Write)**:
   - When a critical decision is made (e.g., "We chose Redux over Context for X reason"), create a new file in `.claude/memory/<slug>.md`.
   - Use a structured format:
     - `name`: unique-slug
     - `description`: short summary
     - `tags`: [architecture, bug, preference]
     - `content`: the detailed fact.
   - Update `MEMORY.md` with a link to the new fragment.

3. **Context Recall (Read)**:
   - Before starting a new feature, scan `MEMORY.md` for relevant tags.
   - Load the corresponding memory files into the current conversation context.

4. **Pruning & Refinement**:
   - Periodically review the memory directory to delete outdated facts or merge redundant entries.

## Success Criteria
- The AI can recall a specific decision from a previous session without being reminded.
- Memory files are logically organized and indexed.
