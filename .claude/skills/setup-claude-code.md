---
name: setup-claude-code
description: Initialize and verify the project environment for Claude Code
---

# Claude Code Setup Skill

This skill ensures the project is correctly configured for an optimal development experience with Claude Code.

## Workflow

1. **Environment Check**:
   - Verify that `.claude/` directories exist (`skills`, `memory`).
   - Check for a `CLAUDE.md` file. If missing, create one with project-specific guidelines, build commands, and test patterns.

2. **Dependency Audit**:
   - Run `npm install` or the relevant package manager command to ensure all dependencies are current.
   - Check for `.env` files and warn the user if essential keys are missing (without printing the keys).

3. **Build & Test Verification**:
   - Run the project's primary build command (e.g., `npm run build`).
   - Run a basic smoke test (e.g., `npm test`).

4. **Git Health Check**:
   - Ensure the current branch is clean or that the user is aware of uncommitted changes.
   - Check for a valid `.gitignore` to prevent leaking secrets.

## Success Criteria
- The project builds and passes basic tests.
- `CLAUDE.md` is present and updated.
- All environment dependencies are resolved.
