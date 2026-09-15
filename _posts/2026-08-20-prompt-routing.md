---
layout: post
title: "Prompt Routing: Why Every Request Shouldn't Go to Your Most Expensive Model"
date: 2026-08-20
categories: [AI, Architecture]
tags: [Prompt Routing, Model Routing, Amazon Bedrock, FinOps, LLM Architecture, Platform Engineering]
description: "Most enterprise AI traffic is simple, and most of it is sent to a frontier model anyway. What prompt routing is, the three ways to do it, what it saves, and where it goes wrong."
author: Vivek Mathew
---

# Prompt Routing: Why Every Request Shouldn't Go to Your Most Expensive Model
<figure class="fig">
{% include figures/routing--traffic-vs-spend.svg %}
</figure>

Look at a week of LLM traffic from any enterprise assistant and a pattern jumps out. A large share of requests are simple: reformat this, summarize that, what does this error mean, write a commit message. A smaller share are hard: reason across three documents, refactor this module, plan a multi-step task. And nearly all of it, in most deployments I've seen described, goes to the same model: the most capable one available, because that's the one that was configured on day one.

That's like sending every package by overnight courier. It works. It's also the single largest avoidable cost in most AI platforms, and it's fixable with a pattern that sits naturally in the governed invocation layer this series has been building: **prompt routing**.

*Opinions here are my own and don't represent my employer. Examples are generic patterns with placeholder identifiers.*

---

## What prompt routing is

Prompt routing is choosing the model *per request* rather than *per application*. A router sits in front of the models, looks at each incoming prompt (and sometimes the conversation context), and sends it to the cheapest model expected to handle it well. Simple requests go to a small, fast model. Hard requests go to a frontier model. Everything in between goes to a mid-tier.

The key word is *expected*. Routing is a prediction about which model is good enough, made before you've seen any answer. Get it right and you cut cost and latency with no visible quality change. Get it wrong in one direction and you've paid for capability you didn't need; wrong in the other and a user gets a worse answer than they'd have had. The design problem is making that prediction reliably and cheaply.

---

## Why it matters more in an enterprise

In a consumer product, routing is a margin optimization. In an enterprise platform it touches three things leadership already cares about.

**Cost.** The price gap between model tiers is not 20%. Between a small model and a frontier model on the same provider it's commonly an order of magnitude per token. If half your traffic can move down a tier without quality loss, the platform's bill changes shape, and the [cost-attribution]({% post_url 2026-07-01-cost-attribution-for-llm-usage %}) reports show exactly which use cases benefited.

**Latency.** Smaller models respond faster, often several times faster to first token. For inline code assist or chat, that's the difference between a tool people use and a tool people wait on.

**Governance.** This is the part that's easy to miss. If routing lives in the platform's invocation layer (the same place guardrails, inference profiles, and traces live), then *which model handled a request* becomes a platform decision, logged and attributable, rather than a per-application configuration nobody reviews. Model choice becomes something the platform can set policy on: this use case may route to any approved tier; that one, handling sensitive data, is pinned to a specific model with a specific guardrail. Routing done in the platform is a control. Routing done in each app is another thing to audit.

---

## The three ways to route

<figure class="fig">
{% include figures/routing--three-ways.svg %}
<figcaption>Start at the left. Earn your way rightward with data.</figcaption>
</figure>

Roughly in order of sophistication, and each has its place.

### 1. Rules

Route on things you already know without reading the prompt: the declared use case, the request type, the input length, whether tools are involved. A commit-message generator never needs a frontier model. A prompt with 40,000 tokens of context and a request to "find inconsistencies" probably does. Agentic requests that will make tool calls usually need the stronger model, because tool-use reliability degrades faster than chat quality as models get smaller.

Rules are cheap, deterministic, explainable, and cover a surprising share of traffic. They're the right place to start, and in a regulated setting "explainable" is not a small virtue: when a risk partner asks why a request went to a particular model, "the use case is classified as tier 2" is an answer.

### 2. A classifier

Use a small model (or a tiny fine-tuned one) to score each prompt for complexity before routing. The classifier reads the prompt and returns a tier: `simple`, `moderate`, `complex`. It adds a few hundred milliseconds and a fraction of a cent per request, and it catches what rules can't: the short prompt that's actually hard, the long one that's actually trivial.

The design choices that matter: keep the classifier's output to a small fixed set of labels, so routing stays deterministic downstream; give it the use case as context, because "complex" means something different in code assist than in customer support; and log its label on the trace so you can measure it.

### 3. Cascading

<figure class="fig">
{% include figures/routing--cascading.svg %}
<figcaption>The check is the whole design problem. Everything else is plumbing.</figcaption>
</figure>

Send the request to the cheap model first, check the answer, and escalate to the stronger model only if the check fails. The check can be a confidence signal from the model, a validator (does the JSON parse, does the code compile, did it cite a source), or a second small model acting as a judge.

Cascading gets the best cost profile on traffic that's mostly easy, because you only pay for the expensive model on the requests that actually needed it. The costs are latency on escalated requests (the user waits for two calls) and complexity: you now need a reliable "was this good enough" signal, which is the hard part of the whole field. It works best where the check is objective: structured output, code, retrieval with verifiable citations. It works worst on open-ended prose, where "good enough" is a judgment call.

Most mature platforms end up with a blend: rules first, a classifier for what rules don't settle, and cascading only for use cases with an objective check.

---

## Where it goes wrong

A few failure modes worth designing against from the start.

**Silent quality regression.** The dangerous case isn't a routing mistake you notice; it's the one you don't. If a tier-1 model starts handling requests it's slightly too weak for, nothing breaks. Answers just get a bit worse, and users quietly stop trusting the tool. The defence is measurement: sample routed requests, run them through the frontier model too, and compare. Watch thumbs-down rate and retry rate per tier. Treat a rising retry rate on the cheap tier as a routing bug.

**Routing sensitive traffic to the wrong place.** Different models can have different data-handling terms, different regions, different guardrail configurations. Routing must respect the use case's classification: a request tagged as handling regulated data goes only to the models approved for it, whatever the complexity score says. This is why routing belongs in the governed invocation layer, where it can read the inference profile's tags, and not in a library that doesn't know what it's routing.

**Routing on the first turn only.** Conversations change. A chat that starts with "hi" and becomes a multi-file refactor by turn six needs re-routing. Route per turn, with conversation context as an input, or you'll pin hard requests to whatever tier the greeting landed on.

**Breaking the audit trail.** Every routed request must record the model *requested*, the model *served*, and *why* (rule name, classifier label, cascade escalation). Without that, "which model answered this" becomes unanswerable, and the [observability]({% post_url 2026-07-16-observability-for-llm-calls %}) post explained why that's a problem.

**Over-engineering on day one.** A classifier plus cascade plus judge on a platform with three use cases is a science project. Start with rules by use case. Add a classifier when you can show, with data, that rules are leaving money on the table.

---

## What it looks like in the platform

<figure class="fig">
{% include figures/routing--in-platform.svg %}
<figcaption>Policy sets the boundary; routing optimises inside it.</figcaption>
</figure>

Routing slots into the invocation layer this series has been describing, between the gateway's policy checks and the model call:

1. The request arrives with its inference profile (use case, environment, cost center, data classification).
2. Policy determines the *allowed* set of models for that classification. Routing can only choose within it.
3. Rules assign a tier where they can; the classifier scores the rest.
4. The chosen model is called with the guardrail the use case requires.
5. The trace records requested model, served model, tier, and reason.
6. The attribution and governance reports gain a new dimension: spend and quality by tier, per use case.

That last line is what makes routing a leadership topic rather than an engineering trick. Once the report shows "use case X moved 60% of traffic to tier 1 with no change in satisfaction," every other use case owner asks how to get the same, and the platform team has a lever it can pull across the organization rather than one app at a time.

---

## The principle underneath

The most capable model is the right default for exactly one thing: not knowing what you need yet. Once you know, and traffic will tell you within weeks, sending every request to it is a decision to pay for capability you aren't using, and to run slower than you have to.

Route in the platform, within policy, with the reason on the trace. Then model choice stops being something each team configures once and forgets, and becomes something the organization can measure, govern, and improve.
