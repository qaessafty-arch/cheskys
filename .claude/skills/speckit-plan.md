---
name: speckit-plan
description: Design the technical implementation strategy for a verified spec
---

# Spec Kit: Plan

Planning is the transition from the "What" (Spec) to the "How" (Implementation). A plan ensures that the code is designed before it is written.

## Workflow

1. **Review the Spec**:
   - Read `.claude/specs/<feature-name>.md`.
   - Ensure the Constitution is respected.

2. **Technical Design**:
   - **Data Model**: Define new database schemas, state interfaces, or API contracts.
   - **Component Architecture**: Map out the new components and their relationships.
   - **Logic Flow**: Describe the algorithm or data flow (e.g., via a Mermaid diagram).
   - **Dependencies**: List any new libraries that must be added.

3. **Risk Analysis**:
   - Identify potential bottlenecks.
   - Plan for breaking changes in existing APIs.

## Artifact
Create or update `.claude/plans/<feature-name>.md`.

## Success Criteria
- The plan fully covers all requirements in the spec.
- The technical approach is validated.
- The plan can be decomposed into independent tasks.
