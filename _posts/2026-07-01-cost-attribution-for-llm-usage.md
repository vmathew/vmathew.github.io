---
layout: post
title: "Cost Attribution for LLM Usage: What to Tag, What to Report, Who Reads It"
date: 2026-07-01
categories: [AI, Governance]
tags: [AI Governance, FinOps, Amazon Bedrock, Cost Attribution, Platform Engineering]
description: "LLM spend is invisible until you make it visible, and 'we spent $X on AI' is not attribution. A practical tagging model, the three reports worth building, and who should be reading each one."
author: Vivek Mathew
series: "AI governance in practice"
part: 3
figure: llm-cost--three-reports.svg
---

# Cost Attribution for LLM Usage: What to Tag, What to Report, Who Reads It
<figure class="fig">
{% include figures/llm-cost--why-llm-cost-is-different.svg %}
</figure>

I've argued before that [guardrail enforcement belongs in your SCPs]({% post_url 2024-10-01-guardrail-enforcement-must-live-in-your-scps %}), because a control a developer can forget is a control you'll lose. Cost attribution has the same shape. If attribution depends on every team remembering to tag every call, you'll end up with a bill that says "Bedrock: $X" and a room full of people insisting it wasn't them.

This post is about making LLM spend attributable by construction: the tags that matter, the three reports that are actually worth building, and who should be reading each one.

*Opinions here are my own and don't represent my employer. Examples are generic patterns with placeholder identifiers.*

---

## Why LLM cost is different from the rest of your cloud bill

Most cloud cost is attached to a *resource* that lives for a while: an EC2 instance, an RDS cluster, an S3 bucket. You tag the resource once and the bill follows it.

An LLM call isn't a resource. It's a metered event, priced per token, that lasts a few seconds and leaves nothing behind. Two teams calling the same foundation model through the same account are indistinguishable on the invoice unless *you* made them distinguishable at call time. There's no instance to tag after the fact.

That changes the problem in three ways. Attribution has to happen *at invocation*, not at provisioning. The unit of cost is the *use case*, not the account (one account often hosts several). And the cost driver is *behaviour* (prompt length, context size, retries, model choice), which means the people who can change it are developers, not infrastructure teams.

---

## What to tag

Resist the urge to build a taxonomy. Five dimensions cover nearly every question anyone will ask, and every one of them should be *derived from something the platform already knows*, not typed by a developer.

| Tag | Answers | Where it comes from |
|---|---|---|
| `cost-center` | Who pays? | The account or OU's registered owner |
| `application` | What product is this? | The application's registry ID, set at onboarding |
| `use-case` | What is it doing? (`chat`, `rag`, `code-assist`, `agent`, `batch`) | Declared when the app is onboarded to the AI platform |
| `environment` | `dev` / `test` / `prod` | The account |
| `model-tier` | Which model class? (`frontier`, `standard`, `small`) | The model actually invoked |

Notice what's *not* on the list. Not the user's identity, which is a privacy question and a different report. Not the team name, which changes every reorg; cost centers survive reorgs. Not the model ID itself, which is already in the usage data; tier is what leadership can compare across.

### Make the tags unforgeable

<figure class="fig">
{% include figures/llm-cost--the-only-door.svg %}
<figcaption>Same shape as the guardrail policy: the attributable path is the only path that works.</figcaption>
</figure>

On Amazon Bedrock, the mechanism that makes this work is the **application inference profile**. You can't tag a foundation model directly, but you can create an inference profile that wraps one, tag the profile with cost allocation tags, and require that invocations go through it. Costs incurred through a tagged profile then show up in Cost Explorer and the Cost and Usage Report under those tags.

```bash
aws bedrock create-inference-profile \
  --inference-profile-name "app-1234-chat-prod" \
  --model-source copyFrom="arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5" \
  --tags key=cost-center,value=CC-4410 \
         key=application,value=APP-1234 \
         key=use-case,value=chat \
         key=environment,value=prod \
         key=model-tier,value=frontier
```

Now pair that with the same idea from the guardrails post. An SCP can deny invocations that target a raw foundation-model ARN instead of an inference profile in the account, so "untagged call" becomes "denied call":

```json
{
  "Sid": "DenyDirectFoundationModelInvoke",
  "Effect": "Deny",
  "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream",
             "bedrock:Converse", "bedrock:ConverseStream"],
  "Resource": "arn:aws:bedrock:*::foundation-model/*"
}
```

With that in place, the inference profile is the only door, every profile is tagged at creation by the platform, and attribution is a property of the platform rather than a habit of the developer. The platform team creates profiles as part of application onboarding; developers just receive an ARN.

### Capture the usage, not just the dollars

Cost allocation tags get you dollars per tag. They don't get you *why*. For that, turn on **model invocation logging** to CloudWatch Logs or S3. Every record carries the model, input and output token counts, the inference profile used, and (optionally) the prompt and response. Join that with the tags and you can answer the question that actually reduces spend: "which use case has the highest tokens per request, and is that context they need?"

Two cautions. Log prompts and responses only if your data classification allows it, and even then, redact before storing; the token counts are the valuable part for cost work. And treat this as a platform-owned log with restricted access, not something every team can browse.

---

## What to report

<figure class="fig">
{% include figures/llm-cost--three-reports.svg %}
<figcaption>The audience column is the one people skip, and the reason their dashboards go unread.</figcaption>
</figure>

Most organizations build a single "AI spend" dashboard, put everything on it, and watch nobody use it. Three narrow reports, each with a named audience, do far better.

### Report 1: The chargeback (monthly, per cost center)

The boring one, and the most important. One row per cost center, spend this month, spend last month, and the applications that make it up. It exists so that AI cost lands on the P&L of the people who chose to use it, which is the only thing that has ever made a cloud bill go down.

| Cost center | Application | Use case | Spend (MTD) | Δ vs last month |
|---|---|---|---|---|
| CC-4410 | APP-1234 | chat | $ | +12% |
| CC-4410 | APP-1234 | rag | $ | −4% |
| CC-2207 | APP-0981 | code-assist | $ | +41% |

Keep it flat, keep it exportable, and send it *to* people rather than expecting them to visit it.

### Report 2: The efficiency view (weekly, per application)

This is the one for engineers, and it's about tokens rather than dollars, because tokens are what they control.

Per application and use case: requests, average input tokens, average output tokens, cost per request, and the p95 of input tokens. Two derived numbers earn their place. **Tokens per request trend**: a chat app whose average input grows every week is almost always accumulating conversation history it doesn't need. **Frontier-tier share**: the percentage of requests going to the most expensive model class. If a summarization job is running on the frontier tier, that's a five-minute fix worth real money.

### Report 3: The governance view (monthly, for leadership and risk)

Leadership doesn't need cost per request. They need to know that AI adoption is *governed*. This report puts spend next to control coverage:

- Total spend, by tier and by environment, and the trend.
- Share of spend with full attribution (the number that should be 100%, and the reason to show it is so that it stays there).
- Share of invocations through approved guardrails (also 100%, and worth showing for the same reason).
- Top five applications by spend, and their month-over-month change.
- Number of new applications onboarded and their declared use cases.

That last line matters more than it looks. It turns the report from "here's what AI costs" into "here's how AI is being adopted, and here's the evidence it's under control."

---

## Who reads it

The reason to name the audience for each report is that the same number means different things to different people, and a report nobody owns is a report nobody reads.

**Cost center owners** get the chargeback, and the ask is simple: this is your bill, and these are the applications driving it. They don't need to understand tokens. They need to know which product manager to call.

**Application teams** get the efficiency view, and the ask is concrete: your tokens per request went up 30% this month; here's the use case; is that intentional? This is the only report that changes engineering behaviour, so it's the one worth automating into wherever the team already looks (a weekly message, a ticket, a dashboard link in the repo).

**The platform team** reads all three, but owns one number above all others: **attribution coverage**. If 8% of Bedrock spend is unattributed, that's a control gap, not a rounding error, and the fix is on the platform side (an account without an inference profile, a workload that predates the SCP), not on the application side.

**Leadership and risk partners** get the governance view. The framing that works is not "AI is expensive" but "AI spend is growing at X%, it's 100% attributed, 100% guardrailed, and here are the five things driving it." Cost is much easier to defend when it comes with evidence of control.

**FinOps** gets the raw tagged CUR data and the invocation logs, because they'll want to build unit economics (cost per conversation, cost per document processed) that only make sense once they know the product. Give them the tags and get out of the way.

---

## Rolling it out

1. **Define the five tags and their sources.** Every tag must be derivable by the platform from onboarding data. If a tag needs a human to type it per call, drop it.
2. **Make inference profiles the only door.** Create them at onboarding, tagged. Attach the SCP that denies direct foundation-model invocations, dev first, exactly as with guardrails.
3. **Activate the cost allocation tags** in the billing console; they don't appear in Cost Explorer until you do, and they're not retroactive, so do this before you need the history.
4. **Turn on invocation logging** with token counts and no content by default. Add content only for use cases whose classification permits it.
5. **Ship the chargeback first.** It's the simplest report and it's the one that creates demand for the other two, because the moment a cost center owner sees their bill, they'll ask what's driving it.
6. **Publish attribution coverage** as a platform KPI and drive it to 100% before building anything fancier.

---

## The principle underneath

"We spent $X on AI" is a number. "Application 1234's chat use case spent $Y, up 12%, because its average context grew, and here's the team that owns it" is attribution. The gap between the two is not a better dashboard. It's a platform that makes the tags unforgeable, captures usage at the call, and puts each report in front of the one audience that can act on it.

Same lesson as the guardrails post: don't ask developers to remember. Build the platform so that attribution is the only way a call can happen, and then reporting becomes a query instead of an investigation.

---

*Next in this series: observability for LLM calls: what a trace should contain, and how to debug a blocked prompt.*
