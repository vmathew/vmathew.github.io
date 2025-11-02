---
layout: default
title: "Categories"
permalink: /categories/
---

<h1>All Categories</h1>

<ul>
  {% for category in site.categories %}
    <li>
      <a href="{{ '/categories/' | append: category[0] | relative_url }}">{{ category[0] }}</a>
      ({{ category[1].size }} posts)
    </li>
  {% endfor %}
</ul>