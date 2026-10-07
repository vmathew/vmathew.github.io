---
layout: post
title: "Seven Architecture Decisions That Outlive the Model"
date: 2026-10-07
categories: [AI, Architecture]
tags: [AI Agents, Enterprise AI, Platform Engineering, AI Governance, Agent Memory, Knowledge Bases, Guardrails, Evaluation, Observability, AI Gateway, Multi-Agent]
description: "Models change every quarter. These seven decisions don't: who may write to shared agent memory, who owns the knowledge base, how many false positives a guardrail is allowed, how you test something that never gives the same answer twice, how you trace an agent's whole trajectory, whether to build or buy the gateway, and when an agent should call another agent."
author: Vivek Mathew
series: "Agents and architecture"
figure: outlive--model-vs-decisions.svg
---

# Seven Architecture Decisions That Outlive the Model
<figure class="fig">
{% include figures/outlive--model-vs-decisions.svg %}
</figure>

Every few months a new model arrives, the benchmarks move, and every team asks whether to switch. It's the most visible decision in enterprise AI and, over a two-year horizon, one of the least important. Models are, or should be, a line in a config file. What determines whether an AI platform is still standing in two years is a small set of architecture decisions that nobody announces, that don't change when the model does, and that are expensive to get wrong because everything built on top assumes them.

This post is about seven of them. Each has come up in a design review I've sat in. Each is usually decided by default, by whichever team got there first. And each has a right answer that's clearer than it looks once you ask the question out loud.

*Opinions here are my own and don't represent my employer. Examples are generic patterns.*

---

## 1. Who may write to shared agent memory

<figure class="fig">
{% include figures/outlive--memory-write-path.svg %}
<figcaption>Reads are open. The write path is the decision.</figcaption>
</figure>

The [repeated-tokens post]({% post_url 2026-09-12-four-kinds-of-repeated-tokens %}) made the case for a shared memory layer: organizational facts every agent session can read, so agents stop rediscovering which system is authoritative for what. Reading is the easy half. The decision that matters is who may write.

A shared memory that any session can write to is three things at once. It's a channel between users: something one person's session learned, including from their private data, becomes available to the next person's. It's an attack surface: a tool result that contains a planted instruction can become an organizational "fact" that every future session trusts. And it's an unversioned source of truth with no owner, which is the one kind of data store every other part of the enterprise has learned not to build.

The answer is the same one we use for configuration: reads are open, writes go through a reviewed path. Sessions propose facts to a staging area; a curator (a person, or a process with a person at the end) promotes them to the shared namespace; every promoted fact carries who approved it and when, and can be retracted. Private memory per user stays private, and nothing moves from private to shared without crossing that gate. It's slower than letting agents learn freely. It's also the only version a risk partner will accept, and the only one where a poisoned fact can be found and removed.

---

## 2. Who owns the knowledge base

Retrieval-augmented generation has a quiet failure mode: the answer is confident, well-cited, and wrong, because the document it retrieved was superseded eighteen months ago and nobody deleted it. The model did its job. The knowledge base didn't have an owner.

Every other system of record in an enterprise has three things: an owner accountable for its contents, a classification that says who may read it, and some notion of freshness. Knowledge bases get built by the application team that needed them, from whatever documents were handy, and inherit none of the three. Then a second team points its agent at the same index, and now a stale policy document is giving confident answers to two audiences.

The decision is to treat a knowledge base as a system of record from day one. It has a named owner, usually the owner of the source documents rather than the team that indexed them. It has a classification, inherited from the most sensitive document in it, which determines which agents and which users may retrieve from it. It has a freshness rule: documents carry a review date, the index reports what's past due, and expired content is excluded from retrieval rather than left in to be found. And it has a feedback path, so that when an agent gives a wrong answer and someone traces it to a document, the fix goes to the document's owner rather than to the prompt.

---

## 3. Guardrails have a false-positive budget

A guardrail that blocks a harmful prompt is doing its job. A guardrail that blocks a legitimate one is also doing its job, from the guardrail's point of view, and that's the problem. Every false positive is a cost: an engineer's time, a user's trust, and most dangerously, an incentive to route around the guardrail. The team that gets blocked three times on reasonable requests is the team that asks for an exemption, and exemptions are how a mandatory control becomes optional.

The decision is to give the guardrail a false-positive budget the way you give a service an error budget. Measure the block rate per use case, sample blocked prompts (with the right access controls, since they're prompts), and classify them: correctly blocked, incorrectly blocked, ambiguous. Set a tolerance, say two percent incorrect blocks, and when a use case exceeds it, the response is to tune the guardrail for that use case, not to exempt the use case from the guardrail. The [guardrails post]({% post_url 2024-10-01-guardrail-enforcement-must-live-in-your-scps %}) argued enforcement must be mandatory; this is how mandatory stays tolerable. A control nobody measures the cost of is a control somebody will eventually remove.

---

## 4. Testing something that doesn't give the same answer twice

Traditional tests assert that given input X, output is exactly Y. Model-backed systems don't work that way, and teams respond in one of two bad ways: they stop testing, or they test the model's exact words and break the build every time the provider ships an update.

The decision is to test properties, not outputs. For a given input, the test asserts things that must be true of any acceptable answer: it cites a source from the allowed set, it doesn't contain a customer identifier, it calls the expected tool with arguments in the expected range, it finishes in fewer than N steps, it refuses when it should refuse. Where a judgment is needed ("is this summary faithful to the source?"), a second model grades the first against a rubric, and the test asserts the grade clears a threshold across a sample rather than on every single run. Golden sets are built from real traffic, anonymized, and grown every time an incident reveals a case the set didn't cover.

Then treat a model version change like a dependency upgrade: run the full suite against the new version before it reaches production, and record the result. The [harness post]({% post_url 2026-09-10-the-agent-harness-explained %}) called evaluation the gap in most agent programs. This is the shape of the thing that fills it, and it's the artifact a risk partner means when they ask how you know the change was safe.

---

## 5. Trace the trajectory, not the call

<figure class="fig">
{% include figures/outlive--trajectory.svg %}
<figcaption>One trace ID for the whole task. The other decisions show up as spans.</figcaption>
</figure>

The [observability post]({% post_url 2026-07-16-observability-for-llm-calls %}) described what a trace of one model call should contain. An agent is not one call. It's a tree: a model call that chose a tool, the tool's result, another model call that reasoned about that result, a second tool, a retry, a final answer, perhaps twenty spans deep. When something goes wrong, "which call failed" is rarely the question. The question is "why did it decide to do that," and the answer lives in the relationship between spans, not in any one of them.

The decision is to make the trajectory the unit of observability. One trace ID spans the whole task from the user's request to the final action. Every model span records what context it was given (or a hash and a pointer to it, for sensitive data), what it decided, and why in the model's own words if the harness captures reasoning. Every tool span records the arguments, the result size, the identity it ran under, and whether a policy check happened. Step count, token count, and spend accumulate on the root span so the trajectory has a cost. And the whole thing is viewable as a tree, in order, by someone who wasn't there, because the person investigating an incident six weeks later wasn't.

This is also where the earlier decisions become visible. A write to shared memory shows up as a span. A retrieval from a stale document shows up with the document's review date. A guardrail block shows up with its classification. The trajectory is the place the other six get audited.

---

## 6. Build, buy, or Bedrock: the gateway

Everything in this series routes through one idea: a single invocation layer every model call passes through, where guardrails, cost attribution, caching, and tracing are applied once. The question every platform team eventually faces is what that layer is made of.

Three options. Build it: a service your team owns, which fits your controls exactly and costs you a team's attention forever. Buy it: an AI gateway product (LiteLLM, Portkey, Kong's AI gateway, and others), which gives you routing, caching, and dashboards on day one and a vendor dependency on day two. Or use the cloud provider's native primitives: on AWS that means application inference profiles for attribution, Guardrails enforced via SCP, invocation logging, and AgentCore Gateway for tools, stitched together by a thin layer of your own.

The decision is less about features than about where you want the control boundary to live. If your organization already enforces policy at the AWS account layer (SCPs, Organizations, IAM), the native path keeps the control boundary where your security team already audits it, and the thin layer you build is small. If you're multi-cloud or multi-vendor in earnest, with meaningful traffic to models outside one provider, a bought gateway gives you one place to enforce across all of them, and the question becomes whether the vendor's control model is one you can evidence. Building from scratch is right only when neither fits and you have a team that will still be there in three years. Most regulated enterprises on AWS should start native and add a bought gateway only when a second vendor's traffic makes the single control point worth paying for.

---

## 7. When an agent should call another agent

<figure class="fig">
{% include figures/outlive--second-agent-test.svg %}
<figcaption>If the answer is nothing, merge them.</figcaption>
</figure>

Multi-agent architectures are having a moment, and most of the diagrams I review would be better as one agent with better tools. An agent calling another agent adds a trust boundary, a second identity, a second context window to manage, and a second place for an instruction to be smuggled in. Those costs are worth paying in exactly two cases.

The first is a real boundary of ownership or permission. If the thing on the other side is owned by a different team, runs under different credentials, or has access the calling agent must not have, then it should be a separate agent with its own identity, and the call between them should go through the same door (Gateway, with the [identity and permission model]({% post_url 2026-09-14-agent-identity-and-least-privilege %}) applied) as a call to any other tool. The second is a real difference in specialization that justifies a different model, prompt, or tool set, large enough that one agent's context would be worse for carrying both.

Everything else is decomposition for its own sake. If two agents share an owner, share permissions, and could share a context window, they're one agent, and splitting them has made the system harder to trace, harder to test, and no safer. The test to apply in review: what does the second agent know, or may it do, that the first must not? If the answer is nothing, merge them.

---

## The thread through all seven

Each of these is a decision about where control lives: in a reviewed write path, in a document owner, in a tolerance that's measured, in a test suite that runs before a model changes, in a trace that spans the whole task, in a gateway whose boundary your auditors already understand, and in an identity boundary that justifies a second agent. None of them depends on which model you're using this quarter. All of them are still there when the model changes.

That's the useful definition of architecture in this field: the decisions that outlive the model. Make these seven on purpose, write them down, and the next model upgrade becomes what it should be, a line in a config file.

<!--
LinkedIn blurb (paste above the link card after using the site's Share button):

Every quarter a new model arrives and every team asks whether to switch. It's the most visible decision in enterprise AI and one of the least important over two years.

What decides whether your AI platform is still standing in 2028 is a handful of decisions nobody announces: who may write to shared agent memory, who owns the knowledge base, how many false positives a guardrail is allowed, how you test something that never gives the same answer twice, how you trace an agent's whole trajectory, whether to build or buy the gateway, and when an agent should call another agent.

Seven decisions, each with a clearer right answer than it looks once you ask the question out loud.

Opinions here are my own and don't represent my employer.

#EnterpriseAI #AIAgents #PlatformEngineering #AIGovernance #Architecture
-->
