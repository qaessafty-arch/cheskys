---
name: speckit-specify
description: Capture detailed requirements and the "Why" behind a new feature
---

# Spec Kit: Specify

Specification is the act of defining exactly what needs to be built and why it is being built, without deciding *how* it will be implemented.

## Workflow

1. **Context Gathering**:
   - Review the `.claude/constitution.md`.
   - Identify the problem being solved.

2. **Define the Specification**:
   - **User Story**: "As a [role], I want to [action] so that [value]."
   - **Functional Requirements**: A numbered list of mandatory behaviors.
   - **Non-Functional Requirements**: Performance, accessibility, or security constraints.
   - **Out of Scope**: Explicitly list what this feature will NOT do.

3. **Clarification Phase**:
   - Review the spec with the user.
   - Ask "Edge Case" questions: "What happens if the network fails here?" or "What if the user is not logged in?"

## Artifact
Create or update `.claude/specs/<feature-name>.md`. 

## Success Criteria
- The spec is unambiguous.
- The user has signed off on the requirements.
- There is a clear "Definition of Done".
