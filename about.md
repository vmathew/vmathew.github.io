---
layout: default
title: "About"
permalink: /about/
---

<div class="about">

  <section class="about-hero">
    <div class="about-hero-text">
      <p class="about-kicker">About</p>
      <h1 class="about-title">I build AI systems that survive contact with a bank's risk committee.</h1>
      <p class="about-lede">I'm <strong>Vivek Mathew</strong>, an AI and software engineering leader with 19+ years in distributed systems and cloud platforms, currently a Principal Architect at Fifth Third Bank.</p>
    </div>
    <div class="about-hero-mark" aria-hidden="true">
      <span class="about-monogram">VM</span>
      {%- if site.avatar -%}
      <img class="about-photo" src="{{ site.avatar | relative_url }}" alt="" loading="lazy" onerror="this.remove()">
      {%- endif -%}
    </div>
  </section>

  <section class="about-now">
    <p class="about-section-label">What I do now</p>
    <div class="about-now-grid">
      <div class="about-card">
        <p class="about-card-num">01</p>
        <h2 class="about-card-title">A governed AI developer platform</h2>
        <p>Amazon Bedrock with guardrails enforced on every call, model access gated at the organization level, and observability built in from the start, so every invocation is policy-checked, logged, and auditable.</p>
      </div>
      <div class="about-card">
        <p class="about-card-num">02</p>
        <h2 class="about-card-title">FinOps for AI and cloud spend</h2>
        <p>Per-team attribution and reporting, so leadership can see where the money goes and set policy against it rather than discovering it on the invoice.</p>
      </div>
    </div>
  </section>

  <section class="about-path">
    <p class="about-section-label">The path here</p>
    <ol class="about-timeline">
      <li>
        <span class="about-timeline-when">2020 – 2021</span>
        <span class="about-timeline-role">Principal Architect</span>
        <span class="about-timeline-org">Discover Financial Services</span>
        <span class="about-timeline-note">Streaming and MLOps platforms my teams shipped became two US patents: <a href="https://patents.google.com/patent/US11886278B2/en">US11886278B2</a>, <a href="https://patents.google.com/patent/US11868749B2/en">US11868749B2</a>.</span>
      </li>
      <li>
        <span class="about-timeline-when">2021 – 2022</span>
        <span class="about-timeline-role">Senior Architect</span>
        <span class="about-timeline-org">Big Compass</span>
        <span class="about-timeline-note">Consulting on AWS architecture for containerized and streaming applications.</span>
      </li>
      <li>
        <span class="about-timeline-when">2022 – 2024</span>
        <span class="about-timeline-role">Senior Cloud Application Architect</span>
        <span class="about-timeline-org">Amazon Web Services</span>
        <span class="about-timeline-note">Reference architectures and prototypes that put Claude, Llama, Titan and Mistral into enterprise products; GenAI Ambassador in the Technical Field Community.</span>
      </li>
      <li class="is-current">
        <span class="about-timeline-when">2024 – now</span>
        <span class="about-timeline-role">Principal Architect</span>
        <span class="about-timeline-org">Fifth Third Bank</span>
        <span class="about-timeline-note">Cloud engineering and AI governance: the platform, the controls, and the FinOps above.</span>
      </li>
    </ol>
  </section>

  <section class="about-quote">
    <blockquote>
      <p>My leadership has been technical so far: architecture, platforms, and the governance structures that shape what hundreds of engineers can safely build. I'm deliberately growing toward leading engineering organizations, and this blog is partly where I work those ideas out in the open.</p>
    </blockquote>
    <p class="about-quote-more">The full story is on <a href="https://www.linkedin.com/in/{{ site.linkedin_username }}">LinkedIn</a>.</p>
  </section>

  <section class="about-topics">
    <p class="about-section-label">What I write about</p>
    <div class="about-topics-grid">
      <a class="about-topic" href="{{ '/categories/#governance' | relative_url }}">
        <span class="about-topic-name">AI governance</span>
        <span class="about-topic-desc">Guardrails, observability, and making AI adoption auditable.</span>
      </a>
      <a class="about-topic" href="{{ '/categories/#finops' | relative_url }}">
        <span class="about-topic-name">FinOps</span>
        <span class="about-topic-desc">Cost attribution, a proprietary cost control system for leadership, and a VS Code extension for Bedrock with token usage and cost tracked on every call.</span>
      </a>
      <a class="about-topic" href="{{ '/categories/#architecture' | relative_url }}">
        <span class="about-topic-name">Enterprise AI platforms and agents</span>
        <span class="about-topic-desc">Bedrock, AgentCore, MCP, RAG, and what works in production.</span>
      </a>
      <a class="about-topic" href="{{ '/categories/#leadership' | relative_url }}">
        <span class="about-topic-name">Leadership</span>
        <span class="about-topic-desc">Risk committees, operating models, and the decisions behind enterprise AI.</span>
      </a>
    </div>
    <p class="about-disclaimer">Opinions are my own and don't represent my employer. I write about general patterns, never a specific organization's environment.</p>
  </section>

  <section class="about-outside">
    <p class="about-section-label">Outside of work</p>
    <ul class="about-chips">
      <li>Biking</li><li>Running</li><li>Long walks</li><li>Formula 1</li><li>Chicago Bears</li><li>Soccer</li><li>Cricket</li><li>Basketball</li><li>Travel and family</li>
    </ul>
  </section>

  <section class="about-connect">
    {% include connect-card.html %}
    <p class="about-links"><a href="https://github.com/{{ site.github_username }}">GitHub</a> · <a href="https://www.credly.com/users/vivek-j-mathew/badges">Credly</a> · <a href="{{ '/feed.xml' | relative_url }}">RSS</a></p>
  </section>

</div>
