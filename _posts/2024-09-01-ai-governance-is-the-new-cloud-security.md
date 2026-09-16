---
layout: post
title: "AI Governance Is the New Cloud Security"
date: 2024-09-01
categories: [AI, Governance]
tags: [AI Governance, Responsible AI, Cloud Security, Shared Responsibility, Platform Engineering]
description: "Cloud security didn't get safe by asking developers to be careful. It got safe when the rules moved into policy nobody could bypass. AI governance is walking the same road, and the lesson transfers exactly."
author: Vivek Mathew
series: "AI governance in practice"
part: 1
---

# AI Governance Is the New Cloud Security
<figure class="fig">
{% include figures/gov--the-same-arc.svg %}
</figure>

Every few years an enterprise acquires a capability faster than it acquires the controls for it. Cloud was the last one. Generative AI is this one.

The reflex, both times, is a standards document: a page of principles, a training module, a review board, and a sentence that begins "all teams must." That reflex is not wrong, it's just insufficient, and cloud security spent the better part of a decade learning exactly why. The lesson transfers, and it's worth stating plainly before the rest of this series gets into mechanisms: **governance that depends on people remembering is not governance. It's a preference.**

*Opinions here are my own and don't represent my employer. Examples are generic patterns, not any specific organization's environment.*

---

## What cloud security actually learned

It's easy to misremember the cloud security story as being about encryption, or network segmentation, or a particular tool. It wasn't. Those were the *subjects*. The lesson was about *where the rule lived*.

The first phase was always guidance. Please encrypt your buckets. Please don't open security groups to the world. Please keep workloads in approved regions. This worked at five teams and failed at fifty, for reasons that had nothing to do with anyone's competence: a rule that must be remembered will eventually be forgotten, and a control that depends on every team doing the right thing gets *weaker* with every team you add.

The second phase was detection. Scan for public buckets, alert on the ones you find, chase the owner. Better, because at least you knew. Still exhausting, and still after the fact.

The third phase is where it settled: move the rule up to the organization, where the account can't override it. Deny unencrypted `PutObject`. Deny public buckets. Deny the regions you haven't approved. Not a recommendation — a policy that makes the wrong thing impossible rather than discouraged.

That arc, from guidance to detection to enforcement, is the single most useful thing cloud security has to hand to AI governance. And most enterprises adopting AI today are somewhere in phase one, writing the sentence about guardrails.

---

## Why AI isn't just another workload

<figure class="fig">
{% include figures/gov--not-just-a-workload.svg %}
<figcaption>The fourth row is the one that reshapes every control you inherit from cloud.</figcaption>
</figure>

If the answer were only "apply the cloud playbook," this would be a short series. It isn't, because AI systems differ from ordinary workloads in ways that change what the controls have to do.

| | A conventional workload | An AI system |
|---|---|---|
| **Behaviour** | Deterministic. Same input, same output. | Probabilistic. The same prompt can produce different answers. |
| **What it does** | Stores, moves and transforms data | Produces *decisions and content* from data |
| **Failure mode** | It breaks, loudly | It's confidently wrong, quietly |
| **Unit of risk** | The resource | The individual call |
| **What you can inspect** | Configuration | Configuration, and increasingly the *content* |

That fourth row is the one that reshapes everything. A conventional control attaches to a resource that persists: tag the instance, encrypt the bucket, and the control follows it for its whole life. An LLM call is a metered event that lasts a few seconds and leaves nothing behind to attach a control to. Whatever governance you want has to happen *at invocation*, or it doesn't happen at all.

And the third row is the one that worries risk partners. A system that fails loudly gets fixed. A system that is plausibly, fluently wrong gets trusted until the day it matters.

---

## The three questions governance has to answer

<figure class="fig">
{% include figures/gov--three-questions.svg %}
<figcaption>The left column is what gets written down. The right column is what gets evidenced.</figcaption>
</figure>

Strip away the frameworks and enterprise AI governance is three questions. The useful move is to pair each with the *mechanism* that answers it, because a principle without a mechanism is the standards document again.

**What is this allowed to do?** Purpose and policy: which use cases exist, which models they may reach, what data classification each handles, what topics are off limits. This is the part organizations are good at writing and bad at enforcing. The mechanism is an approved catalog plus policy that denies anything outside it.

**What stops it doing the wrong thing?** Technical controls: guardrails on input and output, access control on models, limits on what an agent may act upon. The test is not whether the control exists but whether an application team can skip it. If they can, you have a suggestion.

**Who is accountable, and how would we know?** Ownership and evidence: a named owner per use case, attribution of cost and activity, and traces that survive a regulator's question. "We trained the teams" is not evidence. A query returning zero policy violations over ninety days is.

Notice that all three collapse into the same structural point. Each is answerable either by asking people to comply, or by building the platform so that compliance is the only path that works. Everything in this series is an argument for the second.

---

## Shared responsibility, redrawn

<figure class="fig">
{% include figures/gov--shared-responsibility.svg %}
<figcaption>Every governance gap I've seen lives in the blue row.</figcaption>
</figure>

Cloud gave us the shared responsibility model, and it worked because the line was *legible*: the provider secures the cloud, you secure what you run in it. AI needs the same clarity, and the line sits in a different place.

| Layer | Who owns it | What that means in practice |
|---|---|---|
| **Foundation model** | The provider | Training, model safety, availability, the terms your data is handled under |
| **Platform and configuration** | Your platform team | Which models are reachable, guardrails, identity, attribution, traces |
| **Use case and data** | The business unit | What it's for, what data it may touch, what "good" looks like |
| **The decision** | The human using it | Review, judgement, and accountability for acting on the output |

Most governance gaps I've seen live in the second row, because it's the one nobody owns by default. The provider can't set it for you and the business unit doesn't have the leverage. It belongs to a platform team, and if no platform team claims it, every application team reinvents it differently and the organization ends up unable to answer a simple question about its own behaviour.

---

## What this series is about

The rest of these posts take the phase-three move and apply it, one control at a time:

- **Guardrails** enforced by organization policy rather than asked for in a standards document.
- **Cost attribution** made unforgeable, so spend lands on the team that chose to spend it.
- **Observability** that can't be switched off, so a blocked prompt is a five-minute walk instead of an argument.
- **Tools and agents**, where the model stops producing text and starts taking actions.
- **The risk committee**, because a control nobody can evidence may as well not exist.

Each one is the same shape: identify the thing everyone is asked to remember, and make it structural instead.

---

## The principle underneath

Cloud security didn't get safer because engineers got more careful. It got safer because the careless path stopped working. Encryption became mandatory, public buckets became impossible, and the region list became a policy rather than a wiki page — and then, quietly, the incidents stopped.

AI governance is at the same fork, one layer up the stack. The organizations that treat it as a document to publish will spend the next few years discovering what their models did after the fact. The ones that treat it as a platform to build will be able to answer, on demand, what every model call in the company did, on whose behalf, under which policy, and at what cost.

Both groups will say they take AI governance seriously. Only one of them will be able to prove it.

---

*Next in this series: why guardrail enforcement must live in your SCPs, not as an afterthought in your application code.*
