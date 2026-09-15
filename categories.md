---
layout: default
title: "Categories"
permalink: /categories/
---

{%- assign cats = site.categories | sort -%}

<h1 class="page-heading">Browse by category</h1>

<p class="cat-intro">{{ site.posts.size }} post{% if site.posts.size != 1 %}s{% endif %} across {{ cats.size }} categories.</p>

<ul class="cat-chips">
  {%- for category in cats %}
  <li><a href="#cat-{{ category[0] | slugify }}">{{ category[0] }}<span class="cat-count">{{ category[1].size }}</span></a></li>
  {%- endfor %}
</ul>

{%- for category in cats %}
<section class="cat-section" id="cat-{{ category[0] | slugify }}">
  <h2 class="cat-title">{{ category[0] }}</h2>
  <ul class="cat-list">
    {%- for post in category[1] %}
    <li>
      <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
      <a class="cat-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </li>
    {%- endfor %}
  </ul>
</section>
{%- endfor %}
