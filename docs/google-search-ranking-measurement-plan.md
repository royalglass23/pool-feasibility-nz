# Google Search ranking measurement plan

**Research date:** 23 September 2026

**Decision:** Measure PoolReady's organic-search visibility in Google Search
Console. Treat manual Google searches as qualitative spot checks, not the
ranking score.

## Current PoolReady readiness

The repository already targets `https://www.poolready.co.nz` in its
[sitemap](../src/app/sitemap.ts) and [robots rules](../src/app/robots.ts), and
uses `SITE_INDEXING_ENABLED` to keep non-public deployments out of search.
The existing [analytics and search note](analytics-and-search.md) says Search
Console should be registered only for the confirmed public hostname.

Live checks on 23 September 2026 found:

- the homepage, three public product/partner pages, and privacy page listed in
  `sitemap.xml` all returned HTTP `200`;
- those five pages emitted `robots: index, follow` and no `X-Robots-Tag`
  exclusion;
- `robots.txt` allowed public crawling, excluded `/api/`, `/staff/`, and
  `/prototype/`, and declared the live sitemap; and
- both `robots.txt` and `sitemap.xml` returned HTTP `200`.

This proves the live pages are crawlable and eligible to be considered for
indexing. It does **not** prove that Google has indexed them or that they rank.
Only Search Console's indexed-URL and performance data can answer those
questions reliably.

## Measurement setup

1. Add and DNS-verify the Search Console **Domain property**
   `poolready.co.nz`. A Domain property covers `www`, non-`www`, all protocols,
   and any future subdomains. Google generally recommends it when DNS
   verification is available. [Google: add a Search Console
   property](https://support.google.com/webmasters/answer/34592),
   [Google: top Search Console tasks](https://support.google.com/webmasters/answer/10351509)
2. Submit `https://www.poolready.co.nz/sitemap.xml` in the Sitemaps report.
3. Inspect each sitemap URL with URL Inspection. Record whether it is indexed,
   the Google-selected canonical, last crawl, and any block or rendering issue.
   The live test checks current accessibility but cannot guarantee indexing or
   ranking. [Google: URL Inspection](https://support.google.com/webmasters/answer/9012289)
4. Request indexing only for an important URL that is new or has been fixed.
   Use the sitemap for multiple URLs; repeated requests do not guarantee
   inclusion.

## The scorecard

Create a weekly sheet with one row per **query x landing page x device**. In
Search Console Performance, use these fixed filters:

- Search type: `Web`
- Country: `New Zealand`
- Date: last **28 complete days** compared with the previous 28 complete days
- Devices: record `Mobile` and `Desktop` separately, plus an all-device view
- Pages: report the homepage and each search-focused landing page separately

Start with these query groups, then replace or expand them with the real
queries Search Console reveals:

| Group                | Initial monitored queries                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Brand                | `poolready`, `pool ready nz`, `poolready auckland`                                                 |
| Property suitability | `can i build a pool on my property`, `can my property suit a pool`, `pool feasibility auckland`    |
| Planning             | `pool planning auckland`, `pool site assessment auckland`, `where can i put a pool on my property` |
| Builder              | `pool planning for builders auckland`, `pool site feasibility for builders`                        |

Record these Google metrics for every row:

| Metric           | How to interpret it                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Impressions      | Primary early visibility signal: how often the result was shown.                                                                             |
| Clicks           | Primary traffic outcome from Google Search.                                                                                                  |
| CTR              | `clicks / impressions`; use it to assess whether the result earns clicks when shown.                                                         |
| Average position | Average position of PoolReady's **topmost** result for those impressions, not a fixed universal rank.                                        |
| Position change  | `previous 28-day average position - current 28-day average position`; positive means improvement. Treat `no data` as unknown, not rank zero. |

Report brand and non-brand queries separately. The launch KPI should be growth
in **non-brand NZ impressions and clicks** for the intended landing pages.
Average position is supporting evidence: Google itself recommends focusing
more on impression and click trends than position alone. [Google: Performance
report](https://support.google.com/webmasters/answer/7576553), [Google: common
Performance tasks](https://support.google.com/webmasters/answer/17010961),
[Google: how position is calculated](https://support.google.com/webmasters/answer/7042828)

## Test cadence and decision rule

- **Day 0:** save the indexing baseline and export the first available
  Performance report. Note launches and meaningful page changes on the chart.
- **Weekly:** update the scorecard using complete data, inspect any important
  URL that loses all impressions, and keep the same filters.
- **Every 28 days:** compare equal 28-day windows. Use weekly or monthly chart
  granularity to reduce day-of-week noise. [Google: Performance comparisons](https://support.google.com/webmasters/answer/17011165)
- **After 8-12 weeks with impressions:** call a page/query group improved only
  if non-brand impressions or clicks increased and the intended page retained
  or improved its average position. A position gain without impressions is not
  a useful win; a click gain with stable position can still be a real win.
- Change one meaningful search variable on a page at a time where practical,
  record the date, and compare against the preceding equal period. This is a
  before/after observation, not proof that the edit alone caused the change;
  Google notes that demand, competitors, and other events can also move search
  performance. [Google: evaluating performance changes](https://support.google.com/webmasters/answer/17010961)

Use consented analytics only as a downstream check: compare Google organic
landing visits with PoolReady's anonymous `address_search_started` and
`property_check_completed` events. Because analytics requires visitor consent,
those events are directional rather than a complete conversion count. Search
Console remains the ranking source of truth. Google also distinguishes Search
Console's pre-click Search data from analytics' on-site behavior. [Google:
using Search Console and Analytics together](https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console)

## Important caveats

- Do not use one signed-in or incognito Google search as the KPI. Results vary
  by time, location, language, device, recent activity, and other context; even
  an incognito window is not a neutral New Zealand-wide rank. It is useful only
  for an occasional Auckland/mobile/desktop screenshot alongside the Search
  Console data. [Google: personalized and contextual Search
  results](https://support.google.com/websearch/answer/12412910)
- Search Console's newest data can be preliminary, and complete data commonly
  takes two to three days to appear. Avoid including incomplete days in the
  28-day comparison. [Google: Search Console data discrepancies](https://support.google.com/webmasters/answer/17010575)
- Rare queries can be anonymized and omitted from the query table while still
  contributing to chart totals. Query filters can therefore reduce displayed
  totals. Do not add visible query rows and call that the whole site's total.
  [Google: advanced filters and comparisons](https://support.google.com/webmasters/answer/17011165)
- No current Search Console property or performance data was accessed during
  this research, so this note makes no claim about PoolReady's present Google
  position.
