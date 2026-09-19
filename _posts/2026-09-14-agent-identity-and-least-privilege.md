---
layout: post
title: "Who Is the Agent, Really? Identity and Least Privilege for AI Agents"
date: 2026-09-14
categories: [AI, Architecture]
tags: [AI Agents, Identity, Least Privilege, Security, AI Governance, Bedrock AgentCore, Enterprise AI, Platform Engineering]
description: "When an AI agent reads a record, sends an email, or moves money, whose permissions was it using? Most enterprise agents can't answer that, and the answer decides whether the agent is safe. A plain-language guide to agent identity, on-behalf-of access, and least privilege."
author: Vivek Mathew
series: "Agents and architecture"
figure: identity--two-bad-answers.svg
image: /assets/og/agent-identity-and-least-privilege.png
---

# Who Is the Agent, Really? Identity and Least Privilege for AI Agents
<figure class="fig">
{% include figures/identity--two-bad-answers.svg %}
</figure>

Ask a simple question about any AI agent running in your company: when it just did something, who did it?

Not "which model." Not "which team built it." Who, in the sense your security team means it: which identity was on the request when the agent read that customer record, sent that email, or changed that setting. If the answer is "the agent's service account," you have a problem that gets bigger with every tool you connect. If the answer is "the user who asked, acting through a specific agent, with only the permissions that user already had," you have something a risk partner can sign off on.

This post explains the difference in plain terms, why it matters more for agents than for ordinary software, and how to build the second answer on AWS.

*Opinions here are my own and don't represent my employer. Examples are generic patterns.*

---

## An agent is a new kind of employee

Here's the way to think about it. When a company hires someone, three things happen before they touch anything important. They get an identity (a badge, an account). That identity is given specific access (this building, these systems, this data). And when they act, the action is recorded against their name.

We've done this for people for decades. We've done it for software too: a payments service has its own identity and its own permissions. What's new with agents is that they sit between the two. An agent is software, but it acts on a person's request, in a person's context, and it decides for itself which systems to touch along the way.

That last part is the whole issue. A traditional application calls the systems its developers wrote it to call, in the order they wrote. An agent picks tools at runtime based on what the model decides. So the question "what can this thing do?" doesn't have a fixed answer from reading the code. It has to be answered by the identity the agent is holding when it acts.

---

## The two bad answers

Most early enterprise agents land on one of two identity designs, and both are wrong in ways that don't show up until something goes wrong.

**The super account.** The agent runs as one powerful service identity with access to every system it might need. Every user's request runs under it. This is the easiest thing to build and the one most demos use. The problems: every user effectively inherits the agent's permissions, so a junior analyst asking a question gets the same reach as the agent's broadest access; the audit log shows the agent did everything, and nothing about who asked; and a single prompt injection (a malicious instruction hidden in a document or a tool result) turns the agent's full access into the attacker's full access. The blast radius is the whole account.

**The borrowed user.** The other shortcut is to have the agent literally use the user's credentials: their session, their token, their password stored somewhere. Now the agent can only do what the user can do, which sounds right. But the audit log can't tell the agent's actions from the user's own, so you can't investigate or revoke the agent separately. The user's credentials are now stored and passed around by a system that reads untrusted text all day. And the user has no way to limit what the agent does with their access: it's all or nothing.

Both designs fail the same test. Neither can answer "who did this, through what, with which permissions" with three separate answers.

---

## The right answer has three parts

<figure class="fig">
{% include figures/identity--delegation.svg %}
<figcaption>The delegation is the part the two bad answers both skip.</figcaption>
</figure>

The design that works treats every agent action as having three identities attached, and keeps them distinct.

**The user** is the person who asked. Their permissions are the ceiling: the agent should never be able to do anything the user couldn't do themselves. This is the principle of least privilege applied to agents, and it's the same principle your security team already enforces for people.

**The agent** is a registered principal in its own right, with its own identity, its own credentials, and a defined set of tools it is allowed to use. Two users asking the same agent get the same agent identity but different user ceilings. Two different agents asked by the same user have different tool allowlists. The agent's identity is what lets you revoke one agent without touching the user, and what lets you see in a log that this particular agent, not another, took the action.

**The delegation** is the link between the two: a short-lived, scoped grant that says "user X allows agent Y to act for them, for this purpose, for this long." In identity terms this is "on-behalf-of" access. It's the same idea as a valet key that starts the car but doesn't open the trunk, or a power of attorney that covers one transaction. The delegation is what makes the agent's action attributable to the user without handing the agent the user's whole keyring.

When those three are in place, the downstream system, the one that actually holds the customer data or sends the email, sees all three. It enforces the user's entitlements, it can apply agent-specific rules, and it writes an audit record that a human can read months later: "Agent Y, on behalf of user X, read record Z at 2:14 pm."

---

## What "least privilege" means for an agent in practice

<figure class="fig">
{% include figures/identity--four-limits.svg %}
<figcaption>Four limits, four enforcement points, none of them the prompt.</figcaption>
</figure>

Least privilege for people is mostly about roles. For agents it's about four separate limits, and a good platform enforces all four outside the agent's code.

*Which tools the agent may call at all.* This is the allowlist attached to the agent's identity. A reporting agent gets read tools. A ticketing agent gets read plus create-ticket. Nothing gets delete-everything by default.

*What each tool may do for this user.* The user's own entitlements, enforced by the downstream system when it sees the delegated identity. The agent doesn't get to bypass them because it's an agent.

*How much the agent may do in one task.* Step limits, spend limits, rate limits. An agent that can call a tool once should not be able to call it ten thousand times because the model got confused.

*Which actions need a human.* Consequential actions (money moves, external messages, deletions) go into a pending state and a person approves them. The agent proposes; a human disposes. This is the approval gate the [MCP post]({% post_url 2026-08-10-mcp-servers-in-the-enterprise %}) argued for, and identity is what makes it work: the approval is recorded against a real person, not against the agent.

The key phrase is *outside the agent's code*. If the permission check lives in the prompt ("you may only read, never write"), it lives in the one place a malicious document can rewrite. Permission has to be enforced by something the model can't talk to: the gateway that dispatches the tool, the identity service that mints the delegation, the downstream system that checks entitlements.

---

## How it fits together on AWS

The pieces exist now, and the naming has settled enough to describe.

Bedrock AgentCore Identity handles the agent's own credentials and the delegation. An agent registers as a workload identity. When a user starts a session, the platform exchanges the user's login (from your corporate identity provider) for a scoped token that represents "this user, through this agent." Downstream systems that speak OAuth receive that token and see both parties. For systems that don't (older APIs with static keys), Identity's credential vault holds the secret and hands it to the agent per call, so the key never sits in the agent's code or its memory.

AgentCore Gateway is the single door through which tools are called, and it's where the tool allowlist per agent and the rate limits per principal are enforced. The agent can't reach a tool the gateway doesn't expose to it, no matter what the model decides.

AgentCore Policy sits on the gateway and expresses the rules: which agent may call which tool, under which conditions, at what rate, with which actions requiring approval. The point of putting it there is that it's evaluated by the gateway on every call, not by the agent.

The organization layer, SCPs and network egress, is the outer wall. It's what makes the gateway mandatory rather than recommended: an agent that tries to call a system directly, bypassing the gateway and its identity checks, is blocked at the account level.

And every one of those checks emits into the same trace the [observability post]({% post_url 2026-07-16-observability-for-llm-calls %}) described, so the "who did this" question is answered by a record, not by a reconstruction.

None of this requires the managed harness. It works whether you build your loop on Strands or adopt AgentCore's. That's deliberate: identity is a control, and controls don't move when the harness decision changes.

---

## The questions to ask about any agent

<figure class="fig">
{% include figures/identity--five-questions.svg %}
<figcaption>The right-hand column is the answer that ends the review.</figcaption>
</figure>

If you're reviewing an agent before it goes to production, whether you're an architect, a security partner, or an executive who has to sign the risk acceptance, five questions cover it.

When this agent acts, which identity is on the request? If the answer is a single service account, stop there.

Can the agent do anything the requesting user couldn't do themselves? If yes, why, and who approved that?

Can I revoke this agent's access without touching any user's access, and vice versa?

Where is the permission check enforced, and can the model influence it? If the check lives in the prompt, it isn't a check.

If this agent takes a wrong action, what does the audit log say happened, and would I be able to tell it apart from the user doing it on purpose?

An agent that passes all five is one you can defend in front of a regulator. An agent that fails any of them is a demo, however good it looks.

---

## The principle underneath

We spent twenty years learning that "the application has access" is not a security model, and building identity systems so that every action traces back to a person with the right permissions. Agents don't change that principle. They stress it, because an agent decides at runtime what to touch, and because it reads text that might be trying to trick it.

So the standard for an agent is the standard for a new employee with a badge: its own identity, acting on behalf of a named person, with no more access than that person has, through a door that checks both, leaving a record either of them could be asked about later. Build that once at the platform level, and every agent your organization builds inherits it. Skip it, and every agent is a super account waiting for its first bad document.

<!--
LinkedIn blurb (paste above the link card after using the site's Share button):

When an AI agent in your company reads a record or sends an email, whose permissions was it using?

Most enterprise agents can't answer that. They run as one powerful service account, so every user inherits the agent's full reach, the audit log says "the agent did it," and one hidden instruction in a document turns the agent's access into an attacker's.

The fix is the standard we already apply to new employees: an identity of its own, acting on behalf of a named person, with no more access than that person has, through a door that checks both. This post explains agent identity, on-behalf-of access, and least privilege in plain language, and how the pieces fit on AWS.

Opinions here are my own and don't represent my employer.

#AIAgents #AIGovernance #Identity #LeastPrivilege #AgentCore #EnterpriseAI
-->
