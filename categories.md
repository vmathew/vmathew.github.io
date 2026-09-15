---
layout: default
title: "Topics"
permalink: /categories/
---

{%- comment -%}
  Grouped by tag, not category. Every post shares the same categories
  (tech/AI/Governance), so those can't narrow anything down — and they're baked
  into the permalinks, so they can't be changed without breaking live URLs.
  Tags are the real taxonomy here and are free of URL side effects.

  The permalink stays /categories/ so the already-indexed URL keeps working.
{%- endcomment -%}

{%- assign topics = site.tags | sort -%}

<h1 class="page-heading">Browse by topic</h1>

<p class="topic-intro">{{ site.posts.size }} post{% if site.posts.size != 1 %}s{% endif %} across {{ topics.size }} topics.</p>

<ul class="topic-chips">
  {%- for topic in topics %}
  <li><a href="#topic-{{ topic[0] | slugify }}">{{ topic[0] }}<span class="topic-count">{{ topic[1].size }}</span></a></li>
  {%- endfor %}
</ul>

{%- for topic in topics %}
<section class="topic-section" id="topic-{{ topic[0] | slugify }}">
  <h2 class="topic-title">{{ topic[0] }}</h2>
  <ul class="topic-list">
    {%- for post in topic[1] %}
    <li>
      <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
      <a class="topic-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </li>
    {%- endfor %}
  </ul>
</section>
{%- endfor %}
