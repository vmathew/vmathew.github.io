---
layout: post
title: "Four Kinds of Repeated Tokens, and Four Ways to Stop Paying for Them"
date: 2026-09-12
categories: [AI, Architecture]
tags: [FinOps, Cost Attribution, Prompt Caching, AI Agents, Enterprise AI, Platform Engineering, Amazon Bedrock, LLM Architecture]
description: "Most of the tokens on most enterprise model calls have been sent before, by someone else. Sharing that context across users is four different problems with four different fixes, and a gateway is where they belong."
author: Vivek Mathew
series: "Agents and architecture"
image: /assets/og/four-kinds-of-repeated-tokens.png
figure: tokens--four-kinds.svg
---

# Four Kinds of Repeated Tokens, and Four Ways to Stop Paying for Them
<figure class="fig">
{% include figures/tokens--four-kinds.svg %}
</figure>

Pick any enterprise AI application and look at one model call. The user's actual question is a few dozen tokens. Around it sits everything else: a system prompt that hasn't changed in a month, tool schemas that are identical for every user, a policy document someone pasted in because the assistant needed it, the same conversation history that grows every turn. On most calls, most of the tokens have been sent before, often by a different user a few minutes ago.

The question I get asked, in one form or another, is whether there's a tool that shares context across users so the organization stops paying for the same tokens over and over. The honest answer is that "sharing context" is four different problems, they have four different fixes, and the mistake most teams make is reaching for one of them (usually a response cache) to solve all four.

This post separates them, says which mechanism fits which, and argues that the right place for all four is the invocation layer this series has been building, rather than inside any one application.

*Opinions here are my own and don't represent my employer. Examples are generic patterns. Provider caching limits are as of September 2026 and move quickly; check the docs before relying on a specific number.*

---

## First: what is actually being repeated?

Before choosing a mechanism, name the repetition. On a typical call there are four kinds.

**The repeated prefix.** System prompt, tool definitions, few-shot examples, any long reference document that every call carries. This is identical across users by construction and it is usually the largest band: with a real tool set and a reference document it can be 70 to 90 percent of the input tokens.

**The repeated question.** Many users asking the same thing. "What's the travel expense limit," "how do I request access to X." The FAQ-shaped slice of traffic, which in an internal assistant can be a surprisingly large share.

**The repeated retrieval.** Users pasting, or an agent fetching, the same document into context on every call, because the application has no better way to give the model that knowledge.

**The repeated learning.** An agent that rediscovers the same organizational facts for every user: which system is authoritative for what, who owns which service, what the naming conventions are. Facts that are true for everyone, relearned one session at a time.

Each of these has a different fix, and only one of them is a cache in the sense most people mean.

---

## 1. The repeated prefix: prompt caching

Provider-side prompt caching is the single biggest lever for most applications, and it needs no framework at all.

The mechanism: you mark a point in the prompt, the provider caches everything before it, and every later call that begins with the identical prefix reads that stretch at a steep discount. The first call pays a premium to write the cache — on the order of 1.25× the normal input rate — which reuse repays quickly and which is worth knowing before you read the first day's bill. Amazon Bedrock, Anthropic, and OpenAI all offer it, and Bedrock will also attempt the same thing implicitly, with no breakpoints at all, on a best-effort basis; marking the boundary yourself is what makes it predictable.

The default lifetime is 5 minutes, which sounds far too short until you notice that it resets on every hit. A prefix in steady use across an organization keeps refreshing itself and stays warm all day, at no extra cost — the busier the shared prefix, the less the number matters. A 1 hour TTL is available as an opt-in on the newer Claude models, and it is for the opposite case: a prefix used often enough to be worth caching, but not often enough to keep itself alive.

It is shared across users automatically. Nobody has to build a shared store: if two users' calls begin with the same bytes, the second one hits the cache the first one wrote. The catch is the word *identical*. The cache matches from the first byte and stops at the first difference, so where the first per-user byte appears decides how much of the prompt is cacheable.

<figure class="fig">
{% include figures/tokens--prefix-order.svg %}
<figcaption>Nothing about the model changed. Only the position of the first per-user byte.</figcaption>
</figure>

That makes prompt caching mostly a matter of prompt discipline: static content first (system prompt, tools, examples, the reference document), per-user content last (history, the question, anything with a name or an account in it), and a cache breakpoint between them. Applications that greet the user by name in the first line of the system prompt are throwing the whole discount away.

One threshold to know before you measure: a breakpoint only caches if the prefix in front of it clears a model-specific minimum — 512 tokens on Opus 5, 1,024 on Sonnet 5, 4,096 on Haiku 4.5. Under it the call still succeeds and simply caches nothing, which is a confusing way to learn that a short system prompt was never worth a breakpoint in the first place.

For agents this matters even more than for chat. Every iteration of the agent loop re-sends the full context, and the tool schemas and system prompt are the same on every iteration, so an agent that isn't caching its prefix pays for it five, ten, twenty times per task. A well-structured prefix and a stable tool set turn that into one write and many cheap reads.

*Where it lives:* in the gateway's prompt assembly, so that every application gets the ordering right by construction rather than by remembering.

---

## 2. The repeated question: semantic response caching

When many users ask the same thing, the answer can be served from a cache rather than generated again. The lookup is by meaning, not exact text: the incoming question is embedded, compared against stored questions, and if one is close enough, its stored answer is returned without a model call.

The tooling is mature. GPTCache was the original open-source implementation. LiteLLM's proxy has exact and semantic caching built in, backed by Redis. The commercial AI gateways (Portkey, Helicone, and others) offer the same with dashboards and per-route rules. If you already run a gateway, you probably already have this capability switched off.

It's off by default for a reason. Three things go wrong.

A similarity threshold that's too loose serves the wrong answer to a question that only looked similar. "Can I expense a hotel" and "can I expense a hotel for my spouse" are close in embedding space and different in policy.

Cached answers go stale. The expense limit changes; the cache doesn't know. Every cached answer needs a lifetime, and ideally an invalidation hook from the source document.

And the one that turns a cost optimization into an incident: anything personal or permission-dependent must never be cached across users. If the answer depended on who asked, it cannot be served to someone else.

<figure class="fig">
{% include figures/tokens--what-may-be-shared.svg %}
<figcaption>The bottom-right cell is where a cost project becomes a data-leak incident.</figcaption>
</figure>

So the semantic cache is a per-use-case decision, not a global switch. A public-FAQ assistant: yes, tight threshold, short lifetime. Anything that reads a user's own records or sits behind an entitlement check: no, ever. The platform's job is to make that decision explicit at onboarding, in the same place the use case declares its data classification, so no application team can turn it on by accident.

*Where it lives:* in the gateway, gated by the use case's classification, with hit rate and staleness reported.

---

## 3. The repeated retrieval: don't put it in context at all

If users are pasting the same document into their chats, or an agent is fetching the same reference on every call, the fix isn't a cache. It's to stop shipping the document.

Index it once in a knowledge base and retrieve the few hundred tokens relevant to each question: retrieval-augmented generation, or RAG, applied as a cost control rather than only as a quality technique. The model never sees the whole document again, the tokens per call drop by an order of magnitude, and the answers usually get better, because a focused excerpt beats a 40-page manual buried in context. On AWS this is Bedrock Knowledge Bases (including the managed connectors that went GA this year) or your own retrieval pipeline; the mechanism matters less than the decision to retrieve rather than paste.

This is often the largest saving of the four for document-heavy use cases, and it's the one teams most often skip, because pasting the document "worked" in the prototype.

There's a governance benefit too. A knowledge base is a single place where the source document's classification, access control, and freshness are managed. A document pasted into a thousand prompts is a thousand copies nobody is managing.

*Where it lives:* as a platform capability the gateway can call, so that "give the model this document" becomes "index it here" for every team.

---

## 4. The repeated learning: shared memory with a governed write path

Agents accumulate facts as they work: which API is the source of truth for customer status, that the deployment tool needs a specific tag, that a certain team owns a certain queue. When each user's session starts from nothing, the agent relearns those facts, spending tokens (and often tool calls) to rediscover what the last session already knew.

The fix is a shared memory layer: a store of organizational facts that every session can read, separate from each user's private memory. AgentCore Memory supports this directly through namespaces, so a team or tenant namespace holds shared facts while each user keeps their own. mem0 and Zep are the open-source and independent equivalents.

The governance question is the write path. Anyone can read shared memory; who may write to it, and how a private fact is prevented from being promoted into the shared layer, is the same permission problem as tools in the [MCP post]({% post_url 2026-08-10-mcp-servers-in-the-enterprise %}). A shared memory that any session can write to is a channel for one user's context to reach another, and for a poisoned tool result to become organizational "fact." Writes should go through a reviewed path, or be limited to facts the platform itself curates.

*Where it lives:* AgentCore Memory (or equivalent) with a shared namespace read by the gateway, and a write path that is not the agent's to use freely.

---

## Why the gateway, and not each team

Every one of these can be done inside a single application. None of them should be, for the same reason the [guardrails]({% post_url 2024-10-01-guardrail-enforcement-must-live-in-your-scps %}) and [attribution]({% post_url 2026-07-01-cost-attribution-for-llm-usage %}) posts gave: a control that depends on every team remembering it is a control the organization will lose.

<figure class="fig">
{% include figures/tokens--gateway.svg %}
<figcaption>Applied once, in order, inside the governed path. Not bolted on by fifty teams.</figcaption>
</figure>

In the invocation layer, the four mechanisms sit in a natural order. The semantic cache is checked first, only for use cases flagged shareable, because a hit means no model call at all. Retrieval runs next, replacing pasted documents with excerpts. Shared memory is read into the prompt. Then the prompt is assembled static-first with a cache breakpoint, so the provider's prefix cache hits. Guardrails, the inference profile, and the trace still wrap the final call; caching sits inside the governed path, not around it.

Two things fall out of doing it there. Every application gets the savings without doing anything, which is the only way prompt ordering and cache rules will actually be followed at scale. And the gateway can *report* it: hit rate per mechanism, tokens avoided, and saving per team, on the same page as the spend numbers from the [cost-attribution post]({% post_url 2026-07-01-cost-attribution-for-llm-usage %}). A caching layer nobody can measure is a caching layer nobody will fund.

---

## What to do first

If you're starting from nothing, the order is by return on effort.

Fix prompt ordering and turn on prefix caching. It's a day of work per application, or an afternoon at the gateway, and for tool-heavy agents it's the largest single saving available.

Move pasted documents into a knowledge base. Bigger lift, bigger saving, and it comes with governance you should want anyway.

Add a shared memory namespace for agents, with a curated write path, once you can see agents relearning the same facts in traces.

Add semantic response caching last, and only for the use cases that are public by nature. It has the most spectacular hit rate on the FAQ slice and the most spectacular failure mode everywhere else.

And measure all four from the gateway, because the [routing post]({% post_url 2026-08-20-prompt-routing %}) and this one are the same argument from two directions: the model tier decides what a token costs, and these four mechanisms decide how many tokens you send. Both are platform levers, and both belong on the same monthly page.

---

## The principle underneath

The tokens you're paying for twice are almost never the user's question. They're the scaffolding around it, and the scaffolding is the same for everyone. Sharing it is not one clever cache; it's four distinct mechanisms, each with a line it must not cross, applied once in the layer every application already passes through.

Get the four straight, put them where they can't be skipped, and report what they save. Then the only tokens you pay full price for are the ones that were actually new.

<!--
LinkedIn blurb (paste above the link card after using the site's Share button):

Pick any enterprise AI application and look at one model call. The user's question is a few dozen tokens. Everything around it (system prompt, tool schemas, the pasted policy doc, the growing history) was sent before, usually by someone else.

"Can we share context across users?" is really four different problems with four different fixes, and most teams reach for a response cache to solve all of them. I split them apart and argue the right place for all four is the gateway, not each app.

Opinions my own.

#EnterpriseAI #FinOps #PromptCaching #AIAgents #AmazonBedrock
-->
