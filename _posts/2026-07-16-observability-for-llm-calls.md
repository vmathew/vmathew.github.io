---
layout: post
title: "Observability for LLM Calls: What a Trace Should Contain, and How to Debug a Blocked Prompt"
date: 2026-07-16
categories: [AI, Governance]
tags: [AI Governance, Observability, Amazon Bedrock, OpenTelemetry, Guardrails, Platform Engineering]
description: "A guardrail that blocks a prompt with no trace is a black box with a 'no' button. What an LLM trace needs to contain, how to walk one when a prompt gets blocked, and why trace capture has to be enforced rather than encouraged."
author: Vivek Mathew
series: "AI governance in practice"
part: 4
figure: llm-observability--trace-anatomy.svg
---

# Observability for LLM Calls: What a Trace Should Contain, and How to Debug a Blocked Prompt
<figure class="fig">
{% include figures/llm-observability--generic-vs-llm-span.svg %}
</figure>

This is the fourth post in a series on running generative AI in a regulated enterprise. It started with the argument that [AI governance is the new cloud security]({% post_url 2024-09-01-ai-governance-is-the-new-cloud-security %}): the same discipline that took cloud from "please be careful" to enforced, auditable controls now has to be applied to AI. The [second post]({% post_url 2024-10-01-guardrail-enforcement-must-live-in-your-scps %}) put that into practice for guardrails, arguing enforcement must live in your SCPs. The [third]({% post_url 2026-07-01-cost-attribution-for-llm-usage %}) made the same argument for cost attribution: make the tags unforgeable, don't ask developers to remember.

This one is about the evidence. Once every model call is guardrailed and attributed, the next question a developer asks is "why did my prompt get blocked?", and the next question an auditor asks is "prove it." Both are answered by the same thing: a trace. And, as with the other two, a trace that a team *might* emit is not the same as a trace that *always exists*.

*Opinions here are my own and don't represent my employer. Examples are generic patterns with placeholder identifiers.*

---

## Why LLM calls need their own kind of trace

Distributed tracing is a solved problem for request/response services. Spans, parent IDs, latency, status codes. An LLM call fits inside that model but adds things a normal HTTP span doesn't have and that you'll miss badly if they aren't captured.

A model call has a **guardrail decision** that can short-circuit the whole thing before or after the model runs. It has **token counts** that are the cost, not a proxy for it. It has a **model identity** that changes behaviour when it changes, silently, on a version bump. It often has **tool calls** (in agentic flows) where the interesting failure is three hops deep. And it has **content**, which you may or may not be allowed to store.

A generic trace tells you the call took 1,400 ms and returned 200. That's true and useless. The 200 might be a refusal.

---

## What a trace should contain

<figure class="fig">
{% include figures/llm-observability--trace-anatomy.svg %}
<figcaption>Group 3 is the one teams forget to ask for, and the one every blocked-prompt ticket needs.</figcaption>
</figure>

The OpenTelemetry project has been standardizing this under its GenAI semantic conventions, and it's worth aligning attribute names to them so your traces work in any backend. Whatever the naming, every LLM span needs six groups of information.

**1. Identity and attribution.** The application, use case, environment, and cost center from the cost attribution post, plus the invoking principal (role, not human) and the request ID from the provider. This is what joins the trace to the bill and to the audit log.

**2. Model.** The model requested, the model actually served (these differ when routing or fallback is involved), the inference profile ARN, the region, and the key inference parameters: temperature, max tokens, and whether streaming was used.

**3. Guardrail.** The guardrail ID and version applied, the action taken on input (`NONE` / `GUARDRAIL_INTERVENED`), the action taken on output, and, critically, the **assessment**: which policy fired (content filter, denied topic, PII, word filter, grounding check), which category, and at what confidence. On Amazon Bedrock this is returned in the response when you set `trace: enabled` in the guardrail configuration of a `Converse` call; if you don't ask for it, you don't get it, and you'll be debugging blind.

**4. Usage.** Input tokens, output tokens, cache read and write tokens if applicable, and the number of retries. Not the dollar figure; that's derived downstream and the rate changes.

**5. Timing.** Time to first token, total latency, and guardrail evaluation time as its own span. Guardrail latency is the number people will argue about, so measure it rather than debate it.

**6. Content, carefully.** The prompt and the response, or a hash of each, or a redacted version, depending on the data classification of the use case. The default should be *no content*, with content capture enabled per use case where classification permits and retention is defined. Store a content hash even when you don't store content: it lets you prove two traces refer to the same prompt without keeping the prompt.

Here's what that looks like as attributes on a single span, using the OTel convention names where they exist:

```yaml
span.name:                        chat anthropic.claude-sonnet-4-5
gen_ai.system:                    aws.bedrock
gen_ai.request.model:             anthropic.claude-sonnet-4-5
gen_ai.response.model:            anthropic.claude-sonnet-4-5-20250929
gen_ai.request.temperature:       0.2
gen_ai.request.max_tokens:        1024
gen_ai.usage.input_tokens:        2311
gen_ai.usage.output_tokens:       0
aws.bedrock.inference_profile:    arn:aws:bedrock:us-east-1:111122223333:application-inference-profile/abc123
aws.bedrock.request_id:           7f0c...
app.id:                           APP-1234
app.use_case:                     chat
app.environment:                  prod
app.cost_center:                  CC-4410
guardrail.id:                     EXTERNAL_STRICT
guardrail.version:                4
guardrail.input.action:           GUARDRAIL_INTERVENED
guardrail.input.policy:           topicPolicy
guardrail.input.topic:            investment-advice
guardrail.input.confidence:       HIGH
guardrail.output.action:          NONE
guardrail.latency_ms:             38
prompt.sha256:                    9e1b...
llm.time_to_first_token_ms:       null
llm.total_latency_ms:             52
```

Read that span for a moment. Output tokens are zero, total latency is 52 ms, and the input guardrail intervened on a denied topic. You already know what happened, and nobody had to open a log file.

---

## How to debug a blocked prompt

"My prompt got blocked and I don't know why" is the single most common ticket an AI platform team receives. Without traces it's a guessing game that ends in someone asking to loosen the guardrail. With traces it's a five-minute walk. Here's the walk.

<figure class="fig">
{% include figures/llm-observability--blocked-prompt-walk.svg %}
<figcaption>Note that only one of the four cases ends in changing the guardrail.</figcaption>
</figure>

**Step 1: Find the span by request ID, not by searching content.** The application should surface the provider request ID in its error response or logs. Search on that. Searching by prompt text is slow, fails when content isn't stored, and trains people to paste prompts into tickets.

**Step 2: Read the guardrail action fields first.** Was it the *input* guardrail or the *output* guardrail that intervened? These are different problems. An input block means the user's prompt matched a policy. An output block means the model produced something the policy rejected, which is usually more interesting and often indicates a prompt-injection attempt or a system prompt that isn't constraining the model well.

**Step 3: Read the assessment.** Which policy, which category, what confidence. The four common cases:

- *Denied topic, high confidence.* The guardrail did its job. The answer to the ticket is "this use case isn't allowed to discuss that," and the fix, if any, is in the product, not the policy.
- *Denied topic, low confidence.* A borderline match. Look at a handful of similar spans over the last week. If the false-positive rate is real, this is feedback for whoever owns the guardrail content, with evidence attached.
- *PII filter.* Check whether the action was `BLOCKED` or `ANONYMIZED`. Many "blocked" tickets are actually anonymization the application didn't handle, and the fix is in the app's response handling.
- *Content filter on output.* Look at the input span's parent. In agentic flows the offending content often arrived via a tool result, not the user, and the real fix is validating tool output before it goes back to the model.

**Step 4: Check the version.** If the guardrail version in the span is newer than the one the team tested against, the block is a policy change, not an application bug. This is why `guardrail.version` is in the trace. It turns "it worked yesterday" into a diff.

**Step 5: Look at the neighbours.** Same application, same use case, same policy, last seven days. One block is a ticket. Fifty blocks on the same topic from the same use case is either a product gap or an abuse pattern, and the trace store is the only place you can tell which.

Notice that none of these steps required storing the prompt. They required the *assessment*. Content helps in step 3 for the low-confidence case, which is a good argument for enabling redacted content capture for internal use cases while keeping it off for anything customer-facing.

---

## Trace capture must be enforced, not encouraged

Here's the part that ties this series together.

Everything above assumes the trace *exists*. If trace emission is a library the application team is asked to integrate, it has exactly the same failure mode as an app-level guardrail: it's optional by construction, it drifts, and you can't prove a negative. The one blocked prompt an auditor asks about will be the one from the batch job that never wired up the SDK.

So the same principle applies. Make the trace a property of calling the model, not a property of the application, and make it impossible to turn off from inside the account.

On AWS, three levers do this.

**Model invocation logging is account-level, and platform-owned.** Bedrock's invocation logging configuration is set once per account and region; it captures every invocation with its token counts, model, inference profile, and (optionally) content, to CloudWatch Logs or S3. The platform team enables it during account vending. Application teams never touch it.

**An SCP prevents anyone from turning it off.** Deny the logging-configuration mutations to every principal except the platform's automation role:

```json
{
  "Sid": "ProtectBedrockInvocationLogging",
  "Effect": "Deny",
  "Action": [
    "bedrock:PutModelInvocationLoggingConfiguration",
    "bedrock:DeleteModelInvocationLoggingConfiguration"
  ],
  "Resource": "*",
  "Condition": {
    "ArnNotLike": {
      "aws:PrincipalArn": "arn:aws:iam::*:role/platform-bedrock-admin"
    }
  }
}
```

With that in place, "the trace is missing" cannot be caused by an application team. That's the whole point.

**A detective control confirms it's on.** An AWS Config rule (or an equivalent scheduled check) evaluates every Bedrock-enabled account for logging enabled, and the compliance status feeds the governance report from the cost attribution post. Preventive controls stop the change; detective controls prove the state. Auditors want both.

<figure class="fig">
{% include figures/llm-observability--guarantee-and-detail.svg %}
<figcaption>The log is the guarantee. The span is the detail. Only one of them survives a bypass.</figcaption>
</figure>

The gateway adds the richer, application-aware spans (the guardrail assessment, the use case, the cost center) on top of the invocation log, and the two are joined by the provider request ID. The invocation log is the guarantee; the gateway trace is the detail. If the gateway is bypassed, the guarantee still holds.

### What enforced traces buy you

It's worth being explicit about the return, because "turn on logging" sounds like overhead until you list what it pays for.

*Audit evidence that isn't an argument.* "Show me every invocation from this application in Q3, with the guardrail applied to each" becomes a query with a complete answer, not a best-effort reconstruction.

*Incident forensics.* When a prompt-injection attempt lands, the question is "what else did that principal send, and did anything get through?" You can only answer it if capture was on before the incident.

*Guardrail tuning with data.* False-positive rates per policy per use case, from real traffic, over time. This is what turns guardrail ownership from opinion into engineering.

*Model change detection.* When a provider ships a new model version, `gen_ai.response.model` changes across the fleet at once, and any shift in output length, latency, or block rate is visible the same day. Without traces, this shows up as a vague "the assistant feels different" three weeks later.

*Cost and abuse, together.* The efficiency report from the cost attribution post and the abuse investigation above are the same data. Enforcing one collection point pays for both.

---

## Rolling it out

1. **Enable invocation logging in every Bedrock-enabled account** via the vending pipeline, token counts and metadata only, content off by default.
2. **Attach the protective SCP** so only platform automation can change it.
3. **Add the detective check** and put its compliance status on the governance report.
4. **Emit application-aware spans from the gateway**, aligned to the OTel GenAI conventions, always requesting the guardrail trace so the assessment is captured.
5. **Define a content-capture tier per use case** (none / hashed / redacted / full) tied to data classification, with retention set at the tier level, and let teams opt *up* from none.
6. **Write the "blocked prompt" runbook** as the five steps above and point every ticket at it. The goal is that the first response to "why was I blocked?" is a trace link, not a meeting.

---

## The principle underneath

A guardrail that blocks with no trace is a black box with a "no" button. It will be trusted exactly until the first time it blocks something important, at which point the pressure to loosen it will be enormous and the evidence to resist that pressure will not exist.

The answer, for the third post running, is the same one the series opened with: govern AI the way cloud security learned to govern infrastructure. Don't ask developers to emit the evidence. Make it a property of the platform, protect it with the organization policy, verify it with a detective control, and then debugging a blocked prompt becomes a five-minute walk through a span, and proving governance becomes a query.

Guardrails that must be there. Attribution that can't be forged. Traces that can't be turned off. That's the platform.
