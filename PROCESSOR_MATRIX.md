# Processor applicability

This matrix is the source of truth for future agents.

| Processor | Base | Conversation | Research | Reason |
| --- | --- | --- | --- | --- |
| Unicode normalization, current context, objective continuity, verbosity, narration gate, quality gate, token/step budgets, prefill recovery | Yes | Yes | Yes | Safe shared reliability behavior. |
| Failure recovery | Yes | Yes | Yes | Applies only after a multi-step/tool failure. |
| Negative-claim verification | No | No | Yes | Its mandatory source-search procedure is appropriate only for researched factual claims. |
| Prompt enhancer | No | No | Yes | Makes an extra model call with eight retries and emits a research execution brief. |
| Research policy and budget | No | No | Yes | Classify research depth, sources, delegation, and verification work. |
| Task dependency and memory hygiene | No | No | Yes | Depend on Research working-memory/task conventions. |
| Recency, source confidence/diversity, contradiction, claim challenge, entity resolution | No | No | Yes | Evidence-quality controls, triggered during a research loop. |
| Research policy, budget, recency, source confidence/diversity, contradiction, claim challenge, entity resolution, task dependency, memory hygiene | No | No | Yes | Require evidence-gathering or research task state. |
| Runtime skill resolver | No | Capability-gated | Capability-gated | Can load external procedural guidance; Pilot must authorize the capability. |
| Tool search | No | Capability-gated | Yes | Conversation needs Pilot's server-verified tool set and filter first. Research uses restart-safe context storage. |
| Browser, integration, write tools, delegation | No | Capability-gated | Capability-gated | Require Pilot permissions, approval, and durable execution. |

No processor is promoted to BaseAgent solely because it exists in Pilot Research.
