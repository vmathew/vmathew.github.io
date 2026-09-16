---
layout: default
title: "Topics"
permalink: /categories/
---

{%- comment -%}
  Two ways in:
    1. Series — the deliberate reading order (from each post's `series` and
       `part` front matter). This is the primary navigation.
    2. Tags — the full index, most-used first, as a compact directory rather
       than one long section per tag.

  Categories are baked into permalinks and shared by every post, so they are
  not used for navigation. The permalink stays /categories/ so the indexed URL
  keeps working.
{%- endcomment -%}

{%- assign ordered = site.posts | reverse -%}
{%- assign series = ordered | where_exp: "p", "p.series" | group_by: "series" -%}
{%- assign topics = site.tags | sort -%}

<div class="topics">

  <header class="topics-head">
    <p class="about-kicker">Topics</p>
    <h1 class="topics-title">Read by series, or find a post by tag.</h1>
    <p class="topics-intro">{{ site.posts.size }} post{% if site.posts.size != 1 %}s{% endif %} · {{ series.size }} series · {{ topics.size }} tags</p>
  </header>

  {%- if series.size > 0 -%}
  <section class="topics-series">
    <p class="about-section-label">Series</p>
    <div class="topics-series-grid">
      {%- for g in series -%}
      {%- assign items = g.items | sort: "part" -%}
      {%- assign numbered = g.items | where_exp: "p", "p.part" -%}
      <section class="topics-series-card" id="series-{{ g.name | slugify }}">
        <h2 class="topics-series-name">{{ g.name }}</h2>
        <p class="topics-series-count">{{ g.size }} post{% if g.size != 1 %}s{% endif %}{% if numbered.size == g.size %} · read in order{% endif %}</p>
        <ol class="topics-series-list">
          {%- for post in items -%}
          <li>
            {%- if post.part -%}<span class="topics-series-num">{{ post.part }}</span>{%- else -%}<span class="topics-series-num topics-series-dot" aria-hidden="true"></span>{%- endif -%}
            <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
          </li>
          {%- endfor -%}
        </ol>
      </section>
      {%- endfor -%}
    </div>
  </section>
  {%- endif -%}

  <section class="topics-tags">
    <p class="about-section-label">By tag</p>
    {%- comment -%} Sort tags by post count, most used first; ties alphabetical. {%- endcomment -%}
    {%- assign sized = "" | split: "" -%}
    {%- for topic in topics -%}
      {%- assign key = topic[1].size | prepend: "000" | slice: -3, 3 -%}
      {%- assign entry = key | append: "|" | append: topic[0] -%}
      {%- assign sized = sized | push: entry -%}
    {%- endfor -%}
    {%- assign sized = sized | sort | reverse -%}

    <ul class="topics-chips">
      {%- for entry in sized -%}
      {%- assign name = entry | split: "|" | last -%}
      <li><a href="#tag-{{ name | slugify }}">{{ name }}<span class="topics-chip-count">{{ site.tags[name].size }}</span></a></li>
      {%- endfor -%}
    </ul>

    <div class="topics-index">
      {%- for entry in sized -%}
      {%- assign name = entry | split: "|" | last -%}
      {%- assign posts = site.tags[name] -%}
      <section class="topics-index-block" id="tag-{{ name | slugify }}">
        <h2 class="topics-index-name">{{ name }} <span class="topics-index-count">{{ posts.size }}</span></h2>
        <ul class="topics-index-list">
          {%- for post in posts -%}
          <li><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>
          {%- endfor -%}
        </ul>
      </section>
      {%- endfor -%}
    </div>
  </section>

</div>
