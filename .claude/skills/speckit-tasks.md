---
name: speckit-tasks
description: Decompose a technical plan into ordered, actionable work items
---

# Spec Kit: Tasks

Tasking is the final step before implementation. It breaks a complex plan into a sequence of small, verifiable commits.

## Workflow

1. **Plan Decomposition**:
   - Read `.claude/plans/<feature-name>.md`.
   - Break the implementation into logical phases (e.g., Setup -> Core Logic -> UI -> Testing).

2. **Task Definition**:
   - Each task must be **Atomic**: It does one thing.
   - Each task must be **Verifiable**: It has a clear "How to test" step.
   - Order tasks by dependency (Task A must finish before Task B).

3. **Estimation**:
   - Mark tasks as "Simple", "Medium", or "Complex".

## Artifact
Create or update `.claude/tasks/<feature-name>.md`. 

## Success Criteria
- The task list is exhaustive.
- No "giant" tasks remain; all are decomposed into small steps.
- The sequence allows for iterative testing and deployment.
