---
name: configure-omniroute
description: Configure the environment to use the OmniRoute AI Gateway
---

# OmniRoute Configuration Skill

This skill helps you integrate the OmniRoute AI Gateway into your development workflow to enable multi-provider routing and token compression.

## Workflow

1. **OmniRoute Installation Check**:
   - Guide the user to download and run OmniRoute (typically from [OmniRoute GitHub](https://github.com/diegosouzapw/OmniRoute)).
   - Verify that the gateway is running at `http://localhost:20128/v1`.

2. **Endpoint Redirection**:
   - For tools using OpenAI-compatible APIs, instruct the user to change the `BASE_URL` to `http://localhost:20128/v1`.
   - Help the user configure their `.env` or system environment variables for the gateway.

3. **Provider Optimization**:
   - Assist the user in creating "Combo" chains in the OmniRoute UI to handle auto-fallback across different providers (e.g., Claude -> GPT-4o -> Gemini).

4. **Compression Verification**:
   - Ensure that the "Headroom" compression engine is enabled in the OmniRoute settings to minimize token usage for structured JSON data.

## Success Criteria
- The AI tool is successfully communicating via the OmniRoute proxy.
- Fallback mechanisms are verified by simulating a provider failure.
- Token usage shows reduction through compression.
