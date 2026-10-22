# Search and AI-discovery implementation

## Positioning and titles

Chinese primary title: **免费 PDF 编辑器｜逆向研究 WPS PDF 的开源实践 - OpenPDF Studio**.

Repository introduction: **从逆向研究 WPS PDF，到独立开源的本地 PDF 工具**.

English title: **Free PDF Editor for Mac | WPS PDF Research - OpenPDF Studio**.

|Page|Search intent|Direct answer|
|---|---|---|
|Chinese home|免费 PDF 编辑器、Mac PDF 编辑、WPS PDF 免费替代|What the project is, implemented features, platform, source-preview status|
|English home|free PDF editor, local PDF editor, WPS PDF alternative|Equivalent English introduction with limits|
|FAQ|免费修改 PDF 文字、PDF 转 Word、OCR、是否上传|Visible concise questions/answers with concrete boundaries|
|Research article|逆向 WPS PDF、REA 逆向、开源 PDF 编辑器|Observed interactions, evidence grades, unknowns and independent implementation|

## Technical implementation

Four static HTML pages work without client-side JavaScript. Each has a unique title, description, canonical URL, one H1, semantic headings and descriptive image alt text. Chinese/English home pages have reciprocal hreflang links. Open Graph/Twitter image metadata supports shared links. `sitemap.xml` lists canonical pages. Source links connect claims to feature documentation, code and tests.

The home page uses SoftwareSourceCode JSON-LD; FAQPage data exactly matches visible questions and answers. There are no invented ratings, downloads, endorsements or promises of rich-result eligibility. `llms.txt` is an optional text summary for tools, not an indexing requirement or magic GEO signal.

GitHub Pages hosts this project under `/openpdf-studio/`. We do not claim that a `robots.txt` inside that subdirectory controls the domain-root crawler policy. There is no hidden keyword text, crawler-specific alternate content, paid-link campaign or fabricated user testimony.

## Evidence and maintenance

The primary facts are platform, feature boundaries, license, source status and last reviewed date. Update the English page, Chinese page, FAQ and project-facts file together whenever those facts change. Run `python3 scripts/build-site.py` then `python3 scripts/check-site.py`; manually inspect mobile and desktop previews when layouts change.

After publication, Search Console / Bing Webmaster ownership and sitemap submission can support monitoring. They require the user's verified accounts and have not been represented as completed. Publication is not evidence of indexing, ranking or inclusion in an AI answer.

Official references: [Google AI features and websites](https://developers.google.com/search/docs/appearance/ai-features), [Google generative AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). These describe ordinary helpful-content and technical-search fundamentals; no special guaranteed GEO schema is claimed.
