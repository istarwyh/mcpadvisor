# Retrieve a repository README

Given a supported repository URL, return the README Markdown through a reusable
utility. Example source: `https://github.com/seansoreilly/abs`.

Investigate the official/raw GitHub and suitable CDN retrieval paths before adding
a custom client. Validate URLs, preserve the original Markdown, bound waits and
handle missing README files, HTTP errors and unexpected responses explicitly.
Test successful retrieval and fallback/error cases without executing README content.

The original Chinese source, including historical code examples and timelines, is
retained in [ feature-fetch-github-readme.zh-CN.md](./%20feature-fetch-github-readme.zh-CN.md).
