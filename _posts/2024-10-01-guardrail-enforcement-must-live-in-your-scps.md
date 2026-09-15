---
layout: post
title: "Guardrail Enforcement Must Live in Your SCPs, Not as an Afterthought in Your Application Code"
date: 2024-10-01
categories: [AI, Governance]
tags: [AI Governance, Guardrails, Amazon Bedrock, AWS Organizations, SCP, Cloud Security]
description: "A guardrail a developer can forget to call is a control you will eventually lose. In an enterprise, enforcing LLM guardrails at the Service Control Policy level isn't a best practice. It's a must."
author: Vivek Mathew
---

# Guardrail Enforcement Must Live in Your SCPs, Not as an Afterthought in Your Application Code
![The same guardrail requirement enforced in application code versus in a Service Control Policy]({{ '/assets/img/scp-guardrails/where-the-control-lives.svg' | relative_url }})

Every enterprise adopting generative AI eventually writes the same sentence in a standards document: *"All applications must apply guardrails to LLM inputs and outputs."*

It's a reasonable sentence. On its own, it's also unenforceable.

I've spent the last couple of years working on AI governance and cloud controls inside a regulated enterprise, and the design decision that matters most isn't which guardrail product you pick. It's *who owns the enforcement*. My position is not a soft one: in an enterprise running on AWS, guardrail enforcement **must** be a Service Control Policy. Not a library, not a code-review checklist, not a recommendation in a standards document. If a developer can call a model without a guardrail and the call succeeds, you don't have a guardrail control. You have a suggestion.

*Opinions here are my own and don't represent my employer. The examples are generic patterns with placeholder identifiers, not any specific organization's setup.*

---

## The comfortable default: "the developer will add it"

Most rollouts start the same way. The platform team publishes guidance, maybe a helper library, and asks application teams to call the guardrail around each model call.

```python
# What the standards doc asks every team to do
if guardrail.check(prompt).blocked:
    return refusal()
response = llm.invoke(prompt)
if guardrail.check(response).blocked:
    return refusal()
```

This feels fine with three teams and thorough code reviews. It stops being fine at thirty teams, because of four properties that never go away:

**It's optional by construction.** If the guardrail is a function someone must remember to call, it can be skipped. Not maliciously, just by accident: a new endpoint, a retry path, a batch job, a streaming handler that forgot the last chunk. Every new code path is a new place to forget.

**It weakens as adoption grows.** A control that depends on every team doing the right thing gets weaker with every team you add. A governance control needs the opposite property.

**It drifts.** Fifty codebases means fifty guardrail configurations and fifty versions of the denied-topics list. "Are we compliant?" becomes "probably."

**You can't prove a negative.** Risk partners and auditors don't ask "did you tell teams to use guardrails?" They ask "show me that no model call went out without one." With app-level enforcement, the honest answer requires reading every application.

---

## Cloud security already solved this

We've been here before. Years ago, enterprises asked developers to "please encrypt your S3 buckets" and "please don't open security groups to the world." It didn't work at scale, for exactly the reasons above. What worked was moving the control up to the organization: deny unencrypted `PutObject`, deny public buckets, deny leaving the approved regions. Not guidance, but a policy the account can't override, no matter how the code is written.

That mechanism is the Service Control Policy. It sits at the AWS Organizations level, applies to every principal in every account under the OU, and cannot be bypassed by anything inside those accounts, including administrators. It is the one layer where "we require X" and "X is impossible to skip" are the same statement.

Guardrails for LLM invocation are the same story, one layer up the stack.

---

## The SCP that makes guardrails mandatory

Amazon Bedrock exposes a condition key, `bedrock:GuardrailIdentifier`, on its invoke actions. That key is the whole game. A single SCP can deny any model invocation that doesn't carry an approved guardrail:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyBedrockInvokeWithoutApprovedGuardrail",
      "Effect": "Deny",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotLike": {
          "bedrock:GuardrailIdentifier": [
            "arn:aws:bedrock:us-east-1:111122223333:guardrail/EXTERNAL_STRICT*",
            "arn:aws:bedrock:us-east-1:111122223333:guardrail/INTERNAL_STANDARD*",
            "arn:aws:bedrock:us-east-1:111122223333:guardrail/DEVTOOLS_LOGGED*"
          ]
        }
      }
    }
  ]
}
```

Attach that to the OUs that are allowed to use Bedrock, and a call without one of those three guardrails is not "non-compliant." It's an `AccessDeniedException`. There is no code path that forgets, because the enforcement doesn't live in code. The wildcard suffix lets you require a specific guardrail while still permitting version updates.

Notice what this does to the org chart: the *list of approved guardrails* is now owned by whoever owns the SCP (platform and cloud security, with risk owning the guardrail content), and application teams have exactly one job: pick the right one from the catalog. Policy changes are a single SCP edit, not a fifty-repo pull request.

### Pair it with model gating per OU

The same mechanism gates *which* models each part of the organization may use at all. A second statement restricts invocation to an approved model list, and the list can differ by OU: a sandbox OU gets broad access with the logged guardrail; a production OU gets a short list with the strict one.

```json
{
  "Sid": "DenyUnapprovedModels",
  "Effect": "Deny",
  "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream",
             "bedrock:Converse", "bedrock:ConverseStream"],
  "NotResource": [
    "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
    "arn:aws:bedrock:*::foundation-model/amazon.nova-*",
    "arn:aws:bedrock:*:111122223333:inference-profile/*"
  ]
}
```

Together, these two statements say something no standards document can say on its own: *in this organization, the only way to call a model is an approved model, with an approved guardrail, full stop.*

---

## What SCPs deliberately don't do

![What an SCP can and cannot enforce]({{ '/assets/img/scp-guardrails/scp-reach.svg' | relative_url }})

*The policy layer checks the shape of the call, never its contents. Both columns are real.*

It's worth being precise here, because this is where the objections come from and where over-claiming loses credibility.

**An SCP can't choose the right guardrail for a use case.** It requires *an* approved guardrail; it doesn't know that a customer-facing chatbot needs the strict one and a code assistant needs the permissive one. That's a catalog and onboarding problem, not a policy problem.

**An SCP can't inspect content.** It checks the *shape* of the API call, not what's in the prompt. The guardrail does the content work; the SCP only guarantees the guardrail is there.

**An SCP gives you no telemetry.** It produces denies in CloudTrail and nothing else. It won't tell you how many prompts were blocked for which topic, or what it cost.

**An SCP only governs native AWS calls.** A team that hits a third-party model API directly over the internet is outside its reach entirely.

**An SCP doesn't apply to the management account.** Keep workloads out of it (you should anyway) and treat that as a footnote, not a loophole.

None of these are reasons to skip the SCP. They're the reasons the SCP is the *mandatory foundation* and not the whole building. Everything below is optional in the sense that you can phase it in. The SCP is not.

---

## The rest of the building

![Four layers: SCP foundation, gateway or SDK, egress controls, observability]({{ '/assets/img/scp-guardrails/the-layers.svg' | relative_url }})

*Three layers you can phase in, sitting on one you can't.*

### A gateway or SDK, for developer experience and observability

Once the SCP exists, the raw Bedrock endpoint becomes the *hard* path: you need the right guardrail ARN, the right model, the right region, or you get denied. That's precisely when a thin internal gateway or SDK earns its keep, because it becomes the *easy* path: it picks the correct guardrail for the declared use case, routes to the approved model, tags every call with a team and application for cost attribution, and emits a structured trace of prompt, guardrail assessment, model, response and latency.

The important thing is the order of operations. Without the SCP, the gateway is a suggestion that determined teams route around. With the SCP, the gateway is simply the nicest way to comply. Make the compliant route the path of least resistance, and make the non-compliant route impossible.

### Egress controls, for everything that isn't Bedrock

The third-party API gap is real and it's a network problem, not an IAM problem. Outbound access to external model endpoints should be denied by default at the egress layer (proxy, firewall, or VPC endpoint policy) and allowed only through an approved path that applies the same guardrail and logging expectations. If an organization enforces guardrails on Bedrock but lets any Lambda `POST` to a public inference API, it has a policy for the front door and an open window.

### Observability, to prove it

With every call flowing through a guardrailed, gated, logged path, the audit conversation changes character. "How many calls were blocked last month, by which policy, for which application?" is a query. "Show me the trace for this one flagged interaction" is a link. "Which teams keep tripping PII masking?" is a dashboard, and probably a data-handling conversation. This is the difference between *having* guardrails and *demonstrating* governance.

---

## Rolling it out without breaking anyone

If you're starting from app-level guidance today, this sequence has worked in my experience:

![Six-step rollout sequence from guardrail catalog to monthly reporting]({{ '/assets/img/scp-guardrails/rollout.svg' | relative_url }})

*Step 4 is the one everyone wants to do first. It goes fourth for a reason.*

1. **Build the guardrail catalog first.** Two or three named guardrails with clear ownership. Risk and compliance own the content; platform owns the plumbing. Resist the single mega-policy.
2. **Write the SCP, but don't attach it yet.** Instead, query CloudTrail for every `InvokeModel` and `Converse` event over a few weeks and check which ones would have been denied. This is your list of teams to talk to before anyone gets a surprise `403`.
3. **Ship the gateway or SDK with the catalog baked in.** Make it the nicest way to call a model. Adoption follows convenience.
4. **Attach the SCP, dev OUs first.** By now the gateway is the default, so the SCP mostly catches strays. Move to production OUs once the deny count in dev has flattened.
5. **Close the egress gap** in the same window, or the SCP just redirects the strays elsewhere.
6. **Report monthly.** Blocked calls, masked PII, cost per team, and policy coverage. This is the artifact that turns a control into evidence.

---

## The principle underneath

A control that a developer *can* forget is a control you *will* eventually lose. The job of a platform team isn't to remind people to be safe; it's to build the platform so that the safe path is the only path that works.

Cloud security learned this with encryption, egress, and IAM boundaries, and the tool it reached for every time was the organization-level policy. AI governance is walking the same road, and this is the step that isn't negotiable: guardrail enforcement must be an SCP. Put the developer experience in a gateway, put the third-party gap behind egress controls, and treat those as the work that follows. But if you only do one thing, attach the policy, because it's the only layer where "required" actually means required.

---

*Next in this series: cost attribution for LLM usage: what to tag, what to report, and who should be reading it.*
