---
layout: post
title: "Design Reviews Are the Best Teaching Tool You Have"
date: 2026-08-25
categories: [AI, Leadership]
tags: [Tech Leadership, Mentoring, Architecture, Design Review, Platform Engineering]
description: "Most engineers learn architecture not from courses but from having their designs reviewed. A review can be a gate, or it can be the most efficient teaching an organization does. Here is how to run the second kind."
author: Vivek Mathew
series: "Leadership"
figure: review--two-reviews.svg
---

# Design Reviews Are the Best Teaching Tool You Have
<figure class="fig">
{% include figures/review--two-reviews.svg %}
</figure>

Ask senior engineers how they learned to design systems and almost none of them will say a course. They'll name a person who reviewed their work, early, and asked a question they couldn't answer. That question, and the week they spent finding the answer, taught them more than any book.

That's the thing about design reviews that gets lost when they become a checkbox in a delivery process. A review is the one moment in an engineering organization where an experienced person's judgment is applied, in detail, to a specific problem a less experienced person cares about. Nothing else scales teaching like that. Yet most organizations run reviews as gates: a design goes in, a verdict comes out, and the engineer learns mostly that the reviewer has power.

I've spent years on both sides of the table, and more recently as the person who reviews most of what gets built on a platform. This is what I've learned about making the review the teaching tool it could be, without making it any less rigorous as a control.

*Opinions here are my own and don't represent my employer. The examples are generalized.*

---

## The two reviews

Every design review is actually two reviews happening at once, and the mistake is thinking they conflict.

The **control review** asks: is this safe to build? Does it meet the standards, does it fit the platform, does it create risk the organization hasn't agreed to? This review has to be rigorous, and a platform team that softens it to be nice is failing at its job.

The **teaching review** asks: what will this engineer be able to do next time that they can't do now? This review is about the engineer, not the design.

The insight is that the second review makes the first one *cheaper over time*. An engineer who understands *why* the standard exists will meet it unprompted next time, and the time after. An engineer who was told "no, use the paved road" and nothing else will bring the same design back with the names changed. Teaching is how a reviewer stops being a bottleneck.

---

## Ask the question, don't give the answer

<figure class="fig">
{% include figures/review--ask-dont-tell.svg %}
<figcaption>The right-hand column is the actual skill being transferred.</figcaption>
</figure>

The single most useful habit is also the hardest for an experienced reviewer: when you see the problem, ask about it rather than naming it.

Not "this won't scale past one region." Instead: "What happens to this when the second region comes online?" Not "you need an approval step before that tool can write." Instead: "Walk me through what happens if the model calls this tool with the wrong arguments."

This is slower in the meeting and faster everywhere else. The engineer who works out the answer owns it. They also learn the *shape* of the question, which is the actual skill: senior engineers are people who have internalized a set of questions and ask them of their own designs before anyone else does. A review that models those questions, out loud, repeatedly, transfers them.

There's a limit. When the engineer is stuck or the clock is real, give the answer, but give it with the reasoning attached, so the next design doesn't need you.

<!-- ============================================================================
     ILLUSTRATIVE DRAFT — NOT A REAL EVENT. Do not publish as written.
     Use it for shape and length (~5 sentences), then rewrite from something
     that actually happened. What makes this shape work: a concrete design, the
     instruction you nearly gave, the question you asked instead, what they
     found that you hadn't, and the unprompted change on a later design.
     ============================================================================

> An engineer brought me a design for a document-processing service that fanned work
> out to a queue. It would have worked, and it was pinned to a single region in three
> places. The instruction was right there — *this won't survive the DR requirement* —
> and I asked instead: "What happens to this the week we turn on the second region?"
> She came back two days later not with a fix but with a list: three assumptions, one
> of them inside a library another team owned, which I hadn't spotted. The part that
> mattered came a quarter later, on an unrelated design, where her second slide was
> already titled "what breaks in region two." Nobody had asked her for it.

     ---------------------------------------------------------------------------- -->

---

## Review the reasoning, not the diagram

Diagrams are where review meetings go to die. Twenty minutes on box placement, and nobody has asked why the boxes exist.

The teaching review starts from the decisions. What was the hardest choice in this design, and what did you consider instead? What constraint drove the shape? What would have to be true for this to be the wrong approach? Those questions surface reasoning, and reasoning is what can be corrected and what can be learned from.

They also catch the failures a diagram hides. A design that looks fine and was arrived at by copying the last one is a design with no reasoning behind it, and it will fail the first time the context differs. A design that looks odd but was chosen for a specific, articulated reason is usually right, or at least fixable in one conversation.

A practical version: before the review, ask the author for three sentences on the alternative they rejected and why. It changes the meeting.

---

## Make the feedback reusable

<figure class="fig">
{% include figures/review--say-it-thrice.svg %}
<figcaption>Three destinations, decided by what kind of comment it is.</figcaption>
</figure>

Feedback given verbally in a meeting reaches one engineer and evaporates. Feedback written down, with its reasoning, reaches the next ten.

Every recurring review comment is a candidate for one of three things: a line in the standards document (if it's a rule), a worked example on the platform (if it's a pattern), or a question added to the pre-review template (if it's a way of thinking). A reviewer who keeps a list of "things I've said three times" and converts them into artifacts is doing the highest-leverage teaching there is, because the artifact reviews designs while the reviewer sleeps.

This is also how a review board stops being a person. When the questions are written down, any senior engineer can ask them, and the organization's design quality stops depending on one individual's calendar.

---

## Separate the verdict from the lesson

<figure class="fig">
{% include figures/review--verdict-and-lesson.svg %}
<figcaption>Decision first and alone; lessons after, framed as growth.</figcaption>
</figure>

A review that ends "approved with comments" teaches nothing, because the engineer reads the verdict and skips the comments. A review that ends "not approved" without explanation teaches only resentment.

The format that works: state the decision clearly and first (approved, approved once X is addressed, not yet), then, separately, the two or three things that would make the *next* design better, framed as growth rather than as conditions. The decision is the control review. The lessons are the teaching review. Engineers can hear both when they're not tangled together.

And when a design is good, say what specifically made it good. "Approved" tells an engineer they passed. "Approved, and the way you sized the blast radius of that tool is exactly the reasoning we want everywhere" tells them what to repeat.

---

## The uncomfortable review

Sometimes the design is wrong in a way that reflects on the engineer's judgment, not their knowledge: they skipped the platform because it was inconvenient, or presented someone else's work as their own reasoning, or ignored feedback from the previous round.

This is where the teaching review matters most and where reviewers most often flinch. The kind version is not the soft version. The kind version is direct, private, specific about the behavior and not the person, and clear about what changes. An engineer who gets that conversation once usually doesn't need it twice. An engineer who never gets it, because every reviewer softened it, ends up being surprised in a performance conversation years later by feedback they should have had at a design review.

An architect without direct reports can and should have this conversation. It's one of the few genuinely leadership acts available from that seat, and it's the one that people remember.

<!-- ============================================================================
     ILLUSTRATIVE DRAFT — NOT A REAL EVENT. Do not publish as written.
     Shape, borrowed from draft 1: short blunt line rather than a speech; the
     other person pushes back and is partly right; you change something too;
     no tidy bow at the end. Avoid making yourself the hero of your own
     anecdote — that is what made the first version of this one worse.
     ============================================================================

> A design came back a third time with the same unhandled failure mode, after two rounds
> of comments that had named it. The design was fixable in an hour. What wasn't was that
> he had stopped reading past the first line. I asked for ten minutes after the call,
> with nobody else on it: "Third version, same gap. Are these comments useful to you?"
> He said they were. I said I needed them acted on the first time. Then he pushed back —
> the comments arrived as a wall of text two days before his deadline, and the verdict
> was the only part he could act on in the time he had. He wasn't wrong about that. I
> started writing them shorter and earlier; he started replying line by line. Neither of
> us needed the conversation again.

     ---------------------------------------------------------------------------- -->

---

## What this looks like as a practice

For a reviewer, the habits are simple to state and take years to make automatic. Read the design before the meeting, and read for the decisions. Ask before telling. Write down anything you say twice. Separate the verdict from the lesson. Praise specifically. Have the hard conversation once, early, and kindly.

For a platform or architecture team, it's a small set of structures: a pre-review template that asks for the rejected alternative and the hardest decision; a written question list that any senior engineer can run a review from; a habit of turning recurring comments into standards and examples; and a rule that every review produces one written lesson, not just a verdict.

None of it costs money. All of it compounds. Over a couple of years the reviews get shorter, the designs arrive closer to right, and the engineers who were reviewed start reviewing. That last part is the actual goal, and it's the one that makes a platform team's influence outlast the people on it.

---

## The principle underneath

A design review is a control, and it should stay one. But the control is a side effect of what a review really is: the moment an organization's judgment is transferred to the people who'll need it next. Run it as a gate, and you get compliance from people who resent it. Run it as teaching, and you get engineers who no longer need the gate.

That's the most efficient talent development an engineering organization does. It's also, for the person doing the reviewing, the most direct evidence there is of what they'd be like leading a team.
