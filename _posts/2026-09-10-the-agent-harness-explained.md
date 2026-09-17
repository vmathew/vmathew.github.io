---
layout: post
title: "The Agent Harness, Explained: What It Is, and Which Parts Bedrock and AgentCore Give You"
date: 2026-09-10
categories: [AI, Architecture]
tags: [AI Agents, AgenticAI, Amazon Bedrock, AgentCore, Agent Harness, Strands, Platform Engineering, AI Governance]
description: "The model is the engine; the harness is the rest of the car. Most enterprise agent failures are harness failures. A component-by-component map of what a harness does, which parts AWS now runs for you, which parts remain your decision, and how to choose between building one and adopting the managed one."
author: Vivek Mathew
series: "Agents and architecture"
image: /assets/og/the-agent-harness-explained.png
figure: harness--components-map.svg
---

# The Agent Harness, Explained: What It Is, and Which Parts Bedrock and AgentCore Give You

"Harness" has quietly become the most important word in agent engineering, and it now means two things. This post is about both, and about the gap between them, because that gap is where enterprise agent programs succeed or fail.

The general meaning is this: an agent is a model plus everything around it that turns a completion API into something that can do a job. The loop that calls the model, picks a tool, feeds the result back, and decides when to stop. The logic that manages what's in the context window. The tool definitions and the code that dispatches them. Memory across turns and sessions. Permissions: which tools may be called, when, and who approves. Identity: who the agent is and whom it acts for. Evaluation, so you know whether a change made it better or worse. And telemetry, so you can see any of the above. The model is the engine. The harness is the rest of the car, and a very good engine in a bad car still crashes.

The specific meaning is AWS's **AgentCore harness**, which went generally available in June 2026: a managed implementation of all of that, where you configure a model, instructions, tools, and skills, and AWS runs the loop, the sandbox, the memory, the identity, and the tracing.

If you build agents in an enterprise you need a clear picture of the first meaning before you can decide what to do with the second. That's the order this post takes.

*Opinions here are my own and don't represent my employer. AgentCore details are as of September 2026 and move quickly; check the docs before relying on any specific one.*

<figure class="fig">
{% include figures/harness--components-map.svg %}
</figure>

---

## Why "harness failures" is the right frame

<figure class="fig">
{% include figures/harness--failures.svg %}
<figcaption>Every row in the right-hand column is something you can fix. The middle column is not.</figcaption>
</figure>

When an enterprise agent goes wrong, the instinct is to blame the model: it hallucinated, it picked the wrong tool, it didn't stop. Look closer and the cause is almost always in the harness. The context had grown to 80,000 tokens of accumulated tool output and the instruction was buried. The tool description was ambiguous. Nothing capped the number of steps. A tool result contained an instruction and nothing treated it as data. No trace existed to tell you which of these it was.

Models improve on their own schedule. The harness is the part you control, and it's the part that determines whether an agent is safe to run in a regulated environment. So the question for a platform team isn't "which model?"; it's "which harness, and how much of it do we own?"

---

## The harness, component by component

Here is the map. For each responsibility: what it is, why it matters in an enterprise, and where it lives on AWS today.

### 1. The loop

The core cycle: send the conversation to the model, read its response, if it asked for a tool then run it and append the result, repeat until the model says it's done or a limit is hit. Every agent framework is, at heart, this loop with opinions attached.

*Why it matters:* the loop is where step limits, retries, and failure handling live. An unbounded loop is an unbounded bill and an unbounded blast radius. In an enterprise the loop must be able to stop on a policy decision, not only on the model's judgment.

*On AWS:* yours, via a framework (Strands is the AWS-native one; LangGraph and the Claude Agent SDK also run on AgentCore Runtime), or AWS's, via AgentCore harness, which owns the loop and doesn't let you replace it. Its release notes are explicit: "when configuration isn't enough," you export to Strands code and run it on Runtime yourself.

### 2. Context management

Deciding what the model sees on each turn: the system prompt, how much history, which tool results in full and which summarized, when to compact. This is where most cost and most quality problems originate.

*Why it matters:* context is the cost lever. The [routing post]({% post_url 2026-08-20-prompt-routing %}) covered picking the model; this is the other half. A chat agent whose context grows every turn gets slower, more expensive, and worse, all at once. In a regulated setting context is also a data-classification question: what from a sensitive tool result is allowed to persist into later turns?

*On AWS:* mostly yours. Prompt caching (5 minute cache by default, refreshed on every hit, with a 1 hour TTL you can opt into) and the 1M-token context windows change the arithmetic but not the responsibility; a platform still needs a policy for truncation, summarization, and what tool output is retained. AgentCore harness manages context for you inside its loop, which is convenient and also means you should know what its policy is before you trust it with a classified workload.

### 3. Tools

Defining what the agent can call, with a schema and a description the model reads, and dispatching calls to real systems.

*Why it matters:* this was the subject of the [MCP post]({% post_url 2026-08-10-mcp-servers-in-the-enterprise %}). Tools are where an agent stops producing text and starts acting, so they need classification (read, reversible write, consequential, open-world), one governed door, and identity propagation.

*On AWS:* AgentCore Gateway is the door: MCP servers, Lambda, API Gateway, and other runtimes as targets, with rate limits by principal and tool, and cross-account sharing. Tool *classification* remains yours; Gateway will expose `delete_everything` with the same ceremony as `search`.

### 4. Memory

State that outlives a single turn: within a session, and across sessions for the same user or agent.

*Why it matters:* memory is what makes an agent feel competent across interactions, and it's also a retention and classification liability. What is remembered, for how long, and how a user's data is purged are governance questions before they're features.

*On AWS:* AgentCore Memory, with short- and long-term stores, semantic and episodic strategies, namespaces per user or tenant, and direct ingestion. It is not a knowledge base; retrieval over your documents is still Bedrock Knowledge Bases or your own RAG. The harness turns Memory on by default, which is exactly the kind of default to review before production.

### 5. Permissions

Which tools the agent may call, under what conditions, and which actions require a human.

*Why it matters:* this is the difference between an agent that can be trusted with a consequential action and one that can only be trusted to draft. The [MCP post]({% post_url 2026-08-10-mcp-servers-in-the-enterprise %})'s approval gate lives here.

*On AWS:* layered. AgentCore Policy enforces rules on tool calls at the Gateway, outside the agent's code (Cedar or natural language, with session-scoped temporal rules that can require an approval before an action, cap how many times it runs, or hold a running total under a budget). The organization policy (SCPs, egress) is the outer wall that makes the Gateway mandatory. The approval gate for consequential actions, a pending record that a human executes, is still yours to design, though Policy is where it's starting to be expressible.

### 6. Identity

Who the agent is as a principal, and whom it is acting on behalf of when it calls a downstream system.

*Why it matters:* an agent running as one powerful service account is a privilege-escalation path. Every action should be attributable to a user, an agent, and a workload, and the downstream system should see the user's entitlements, not the robot's.

*On AWS:* AgentCore Identity: OAuth client-credentials, user-delegated and on-behalf-of token exchange, a consent portal, private IdPs in a VPC, and a credential vault. It moves identity downstream; it doesn't decide what that identity may do there. Entitlements stay in the target system.

### 7. Evaluation

Knowing whether the agent got better or worse after a prompt change, a tool-description edit, or a model version bump.

*Why it matters:* it's the gap in most enterprise agent programs. Without it, every change is a guess and every model update is a surprise.

*On AWS:* AgentCore Evaluations, with built-in evaluators for task completion, tool use, response quality and safety, custom evaluators, online evaluation against production traffic, and an optimization suite for A/B tests and regression runs. What "good" means for your use case, the test set and the expected tool sequences, is yours.

### 8. Telemetry

Traces of every model call and every tool call, joined by a trace ID, with the guardrail assessment on the model spans.

*Why it matters:* the [observability post]({% post_url 2026-07-16-observability-for-llm-calls %}) made the case. A harness without traces is a black box with a "no" button, and trace capture must be enforced rather than encouraged.

*On AWS:* AgentCore Observability (one-click, per-agent log groups, trajectory views) plus Bedrock model invocation logging at the account level, protected by an SCP so no application team can switch it off.

### And wrapping the model itself

Two things sit on the model call regardless of harness: **Guardrails** (enforced at invocation via SCP, per the [guardrails post]({% post_url 2024-10-01-guardrail-enforcement-must-live-in-your-scps %})) and **cost attribution** (application inference profiles or the Projects API, per the [cost post]({% post_url 2026-07-01-cost-attribution-for-llm-usage %})). They're not harness components, but every harness passes through them, which is why they belong at the organization layer and not inside any one agent.

---

## The managed harness: what it decides for you

<figure class="fig">
{% include figures/harness--managed-split.svg %}
<figcaption>The amber column is the whole decision. The green column is free.</figcaption>
</figure>

AgentCore harness is, by AWS's own description, the orchestration layer as a service: "compute, a sandbox, secure tool connections, filesystem, memory, identity, and observability," with the loop that "calls the model, picks tools, passes results back, manages context, and handles failures." You configure the model (Bedrock, OpenAI, Gemini, or any LiteLLM-compatible provider, switchable mid-session), instructions, tools via Gateway or MCP, and skills from a catalog. It gives you stateful sessions in isolated microVMs, a filesystem and shell, immutable versions with named endpoints and rollback, a Step Functions state, and automatic tracing.

Read that list against the map above and the shape is clear. The managed harness fills every box, and for the green boxes (tools, memory, identity, evaluation, telemetry) it fills them with the same primitives you'd adopt anyway. The difference is the amber boxes. The loop, the context policy, and the parts of permissions that live inside the agent are now AWS's decisions, made by configuration rather than code.

For a lot of use cases that's exactly right. Internal tooling, prototypes, a low-consequence assistant, a first agent for a team that has never built one: the managed harness gets them to production in an afternoon, with observability and identity done properly from day one, which is far better than most hand-built first agents manage.

For consequential workloads in a regulated setting, the question to ask is the one the risk committee will ask: *can you evidence what the harness does?* Specifically: what is its context policy for tool results that contain classified data; what stops the loop, and can a policy stop it; and can you show, per action, that the permission check happened outside the model's reach. If those answers are in the docs and match your controls, adopt it. If any is "we'd have to trust the service," that's a workload for the hand-built harness, where every one of those decisions is code you can review.

The escape hatch AWS built is telling: export to Strands and run on Runtime. That's the vendor saying the same thing.

---

## A decision test

<figure class="fig">
{% include figures/harness--decision-test.svg %}
<figcaption>Whichever side you land on, the bottom band stays the same.</figcaption>
</figure>

Build your own harness on a framework when:

- the agent can take consequential actions and you need the approval gate and step limits in reviewable code;
- the context policy is a data-classification control, not a convenience;
- you need to prove, per action, where the permission decision was made;
- the loop has to integrate with something the managed harness doesn't (a custom evaluator in the loop, a bespoke stop condition).

Adopt the managed harness when:

- the use case is read-mostly or reversible-write, with low blast radius;
- speed to a governed first version matters more than control of the loop;
- the team is new to agents and would otherwise build a worse harness by hand;
- the standard primitives (Gateway, Memory, Identity, Observability) already give you the evidence you need.

And in both cases: the model still goes through the tagged inference profile and the mandatory guardrail, the tools still go through Gateway, and the SCP still makes those the only doors. The harness decision is about the loop and the context, not about the controls. The controls don't move.

---

## Why a platform leader should care about the word

The reason to be precise about "harness" is that it's where the leadership decisions in an agent program actually live. "Which model" is a procurement question. "Which harness, and how much of it do we own" is an architecture and governance question, and it's the one that determines whether the platform can say yes to the next use case with evidence, or only with hope.

Get the map right, decide which boxes must be code and which can be configuration, and make that decision once, at the platform level, rather than letting every team discover it on their own. Then the model can be as capable as it wants to be, inside a harness the organization actually understands.

<!--
LinkedIn blurb (paste above the link card after using the site's Share button):

"Harness" has quietly become the most important word in agent engineering. The model is the engine; the harness is the rest of the car, and most enterprise agent failures are harness failures.

I mapped the eight components, which ones AWS's AgentCore now runs for you, which stay your decision, and a short test for when to build your own versus adopt the managed one.

Opinions my own; AgentCore details as of September 2026.

#AIAgents #AgentCore #AmazonBedrock #AgenticAI #AIGovernance
-->
