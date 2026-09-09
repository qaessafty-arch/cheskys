---
name: headroom-optimize
description: Optimize token usage using Headroom compression techniques
---

# Headroom Token Optimization Skill

This skill focuses on reducing LLM token costs and increasing context efficiency using the Headroom GCF (Graph Compact Format) and structured data compaction.

## Workflow

1. **Data Audit**:
   - Identify large JSON arrays or repetitive structured data being passed as tool outputs or prompts.

2. **Compaction Strategy**:
   - If using OmniRoute, verify that the Headroom engine is active.
   - For manual optimization, apply "Tabular Compaction": replace repetitive keys in JSON arrays with a header-row format.

3. **Interface Integration**:
   - Guide the user to run the [Headroom UI](https://github.com/chopratejas/headroom) to visualize token usage and compression ratios in real-time.

4. **Validation**:
   - Compare the token count of a raw prompt vs. a Headroom-compressed prompt.
   - Ensure the LLM still correctly parses the compressed data (Lossless verification).

## Success Criteria
- Measurable reduction in tokens per request.
- No loss in accuracy or "hallucinations" caused by compression.
