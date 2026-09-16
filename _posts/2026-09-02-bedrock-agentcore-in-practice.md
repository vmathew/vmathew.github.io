---
layout: post
title: "Bedrock AgentCore in Practice: What the Managed Primitives Buy You, and What They Don't"
date: 2026-09-02
categories: [AI, Architecture]
tags: [Amazon Bedrock, AgentCore, AI Agents, AgenticAI, AWS, Platform Engineering, AI Governance]
description: "AgentCore is a set of managed building blocks for agents, not an agent platform that thinks for you. A primitive-by-primitive look at what each one actually takes off your plate, what it leaves, and how the pieces fit into a governed enterprise platform."
author: Vivek Mathew
series: "Agents and architecture"
figure: agentcore--primitives.svg
---

# Bedrock AgentCore in Practice: What the Managed Primitives Buy You, and What They Don't
<figure class="fig">
{% include figures/agentcore--mechanisms-vs-decisions.svg %}
</figure>

When Amazon Bedrock AgentCore reached general availability in late 2025 it arrived with an unusually large surface: Runtime, Gateway, Memory, Identity, Observability, Code Interpreter, Browser, and soon after Policy, Evaluations, Harness, and an Agent Registry. The pitch was that these are the undifferentiated parts of running an agent in production, so you shouldn't build them yourself.

That pitch is mostly right, and it's also easy to misread. AgentCore is a set of *primitives*. Each one takes a specific, well-defined chore off your plate. None of them decides what your agent should do, whether it's allowed to, or whether it did a good job. Those remain your problems, and the enterprises that get into trouble are the ones that assume the managed service is doing more thinking than it is.

This post goes primitive by primitive: what it buys you, what it leaves you, and where it fits in the governed platform this series has been building. It's written from hands-on use on my own AWS account, not from a slide deck.

*Opinions here are my own and don't represent my employer. Capabilities described are as of autumn 2026 and move quickly; check the release notes before relying on any specific one.*

---

## Runtime: the agent has somewhere to live

<figure class="fig">
{% include figures/agentcore--primitives.svg %}
<figcaption>The right-hand column is what no managed service can hand you.</figcaption>
</figure>

**What it buys you.** A managed place to run agent code, deployed as a container or directly from code (Python or Node), with sessions that persist for up to 14 days, per-session isolation, session storage, VPC support, and IAM or OAuth on the front door. You bring any framework: Strands, LangGraph, the Claude Agent SDK, or none. The recent addition of an Instances compute type, interactive shell sessions, and mounted file systems (S3 Files, EFS) moves it toward "a sandboxed workspace for an agent," not just a request handler.

The real value is the operational surface you stop owning: scaling, session lifecycle, isolation between tenants, and the auth in front of it. For an enterprise, the IAM condition keys matter more than the features: you can require VPC-only invocation and specific authorizer types in policy, which means "agents only run in the governed runtime" is enforceable, not aspirational.

**What it doesn't.** It runs your loop; it doesn't write it. Orchestration logic, retries, error handling, how the agent decides it's done: all yours. It also doesn't make a bad agent cheaper: a 14-day session is a wonderful feature and a superb way to accumulate context you'll pay for on every turn. Quotas are real (new-session creation rates, active-session ceilings per account) and need to be part of capacity planning, not discovered in production.

---

## Gateway: tools become a governed surface

**What it buys you.** This is the primitive that matters most for the [MCP post]({% post_url 2026-08-10-mcp-servers-in-the-enterprise %})'s argument. Gateway fronts your tools (MCP servers, Lambda functions, API Gateway stages, other AgentCore runtimes, plain HTTP targets) and presents them to agents as a single MCP endpoint with a single authentication story. Recent additions make it enterprise-shaped: rate limiting by requests, tokens, and connections, scoped to JWT claims or IAM principals or specific tools; cross-account sharing via RAM; PrivateLink on both planes; and MCP session semantics with elicitation pass-through, so a tool can ask the user a question mid-execution.

In platform terms, Gateway is the "one door" the MCP post argued for: the place where per-tool policy, rate limits, identity propagation, and traces can be enforced regardless of which agent is calling. That's a lot of undifferentiated plumbing you no longer build.

**What it doesn't.** It doesn't classify your tools. Which ones are read-only, which are consequential, which need a human approval: that taxonomy is yours to define and review, and the Gateway will happily expose a `delete_everything` tool with the same ceremony as `search`. It also doesn't make the gateway *mandatory*. That's still an SCP or a network policy that denies agents any other path, and without it the Gateway is a convenience some teams use.

---

## Identity: the credentials problem, mostly solved

**What it buys you.** Agents need to call things as *someone*, and the naïve pattern (one powerful service credential, everything attributed to a robot) is exactly what a risk committee will reject. Identity gives you OAuth flows for machine-to-machine, user-delegated, and on-behalf-of token exchange, a vault for provider credentials backed by Secrets Manager, three-legged OAuth for tools that need user consent, and a consent portal for end users. It integrates with private identity providers inside a VPC, which is the difference between "works in a demo" and "works behind a corporate IdP."

This is the primitive I'd most hate to build myself. Getting token exchange right, with rotation and consent, is months of work and a permanent security liability.

**What it doesn't.** It moves an identity to the downstream system; it doesn't decide what that identity may do there. Entitlements still live in the target system, and if your ticketing platform lets a service principal do anything, so will your agent. It also doesn't solve the *agent's* identity as a registered principal in your organization's terms (which agent, which version, which owner). That's the registry's job, and yours.

---

## Memory: state without a database, with caveats

**What it buys you.** Short-term (session) and long-term memory as a managed store, with strategies for semantic recall, user preferences, summarization, and episodic memory. Direct ingestion lets you seed long-term memory without a conversation; structured metadata filters and namespaces let you scope it per user, per tenant, or per agent. No vector store to run, no summarization pipeline to maintain.

For a chat-style agent that must remember a user across sessions, this is a real saving, and the namespace model is a sensible way to keep tenants apart.

**What it doesn't.** It is not a knowledge base. Retrieval over your documents is still Bedrock Knowledge Bases or your own RAG pipeline; Memory is about the agent's *experience*, not your corpus. It also doesn't answer the governance questions memory raises: what's retained, for how long, under which data classification, and how a user's data is purged. Those need to be designed and, in a regulated setting, reviewed, before you turn long-term memory on for anything touching customer data.

---

## Policy: enforcement the agent can't reason around

<figure class="fig">
{% include figures/agentcore--two-walls.svg %}
<figcaption>Policy is the inner wall. The outer one is still yours to build.</figcaption>
</figure>

**What it buys you.** Policy applies rules to tool calls at the Gateway, outside the agent's code, expressed either as natural-language rules or as policy-as-code (Cedar), with integration to Bedrock Guardrails for content checks on tool traffic. The design point is the important one: the rule is enforced by the platform, so a prompt-injected agent can't talk itself past it.

This is the beginning of a real answer to "what stops the agent doing the wrong thing" at the tool layer, and it's where the human-approval and budget patterns from the MCP post can start to live inside the managed service rather than beside it.

**What it doesn't.** Policy governs what passes through *this* Gateway. It is not a substitute for organization-level policy: if an agent can reach a tool without the Gateway, Policy never sees the call. SCPs and egress controls remain the outer wall; Policy is the inner one. And natural-language rules are convenient but not precise; for anything a risk partner will ask you to evidence, write it as code.

---

## Observability: the traces exist by default

**What it buys you.** One-click tracing across Runtime, Gateway, Memory, and the tools, into CloudWatch and X-Ray, with a unified span destination per agent, trajectory diagrams, cross-account monitoring, and OpenTelemetry-compatible spans that a third-party backend can ingest. End-to-end trace latency is low enough to debug live.

For the [observability post]({% post_url 2026-07-16-observability-for-llm-calls %})'s argument, this is the piece that makes "traces can't be turned off" achievable for agents with very little work: enable it at the platform level and every agent on the runtime emits.

**What it doesn't.** It gives you spans, not judgment. What a good trajectory looks like, which tool-call sequence is wrong, whether a five-step run should have been two: those are evaluation questions. And, as always, the trace is only as governed as its capture: protect the configuration with policy so an application team can't quietly disable it.

---

## Evaluations and the Optimization Suite: measuring the agent, not the model

**What it buys you.** A managed way to score agent runs with built-in evaluators (task completion, tool usage, response quality, safety, skill selection), ground-truth support including expected tool sequences, custom LLM- or Lambda-based evaluators, third-party evaluator integration, and online evaluation against production traffic. The Optimization Suite layers batch regression testing, A/B tests on real traffic, simulated multi-turn users, and trace-driven recommendations on top.

This addresses the biggest gap in most enterprise agent programs, which is that nobody can say whether the agent got better or worse after last week's prompt change.

**What it doesn't.** It doesn't know what "good" means for your use case; you still need a test set, expected behaviors, and an owner who maintains them as the business changes. Managed evaluators are a floor, not a definition of quality, and an agent that scores well on generic task completion can still be wrong in the way that matters to your domain.

---

## The rest, briefly

**Code Interpreter and Browser** are sandboxed execution and browsing with enterprise controls (Chrome policies, custom root CAs, proxies, persistent profiles). They save you from running your own sandboxes, which is real work, but they are *open-world* tools in the MCP post's sense and belong behind the strictest classification you have.

**Harness** is the opinionated layer: no orchestration code, built-in memory, multiple model providers, Step Functions integration, a curated skills catalog. It's the fastest path to a working agent and the least control over how it works. Use it for internal tooling and prototypes; be deliberate before it hosts anything consequential.

**Agent Registry** is a private, governed catalog of agents, tools, skills, and MCP servers, shareable across accounts via RAM, discoverable from IDEs. This is the registry the MCP post said every enterprise needs, now as a managed service, and it's the newest piece of the set, so expect the governance model around it (who may publish, who may consume, how classifications are reviewed) to be yours to design.

---

## The pattern underneath

Read the list again and a shape appears. Every primitive takes one *mechanism* off your plate: running, connecting, authenticating, remembering, enforcing, tracing, scoring. None of them takes a *decision* off your plate: what the agent is for, what it may touch, what good looks like, who owns it, and what happens when it's wrong.

<figure class="fig">
{% include figures/agentcore--ownership.svg %}
<figcaption>The primitives change the cost of the mechanisms, not the accountability.</figcaption>
</figure>

That's the right division, and it maps directly onto the operating model from earlier in this series. The platform team adopts the primitives, wires them into the governed invocation layer, makes the Gateway and the Runtime mandatory with organization policy, and turns on Observability for everyone. Business units own the agents, the tools' classifications, the evaluation sets, and the accountable name.

AgentCore makes the mechanisms cheap. It makes the decisions unavoidable. That's what a good managed service should do, and it's worth being clear-eyed about which half you're buying.
