# Analytics consent and search indexing

## GA4

GA4 is optional. Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` to a valid `G-...`
measurement ID to make analytics available. With no ID, the site remains fully
usable and no analytics script is rendered.

The visitor must select **Allow analytics** before the Google script is loaded.
**Reject analytics** and **Not now** leave it unloaded. The persistent
**Analytics settings** control lets the visitor change the choice later;
turning analytics off disables collection and removes first-party `_ga`
cookies that are accessible to the site.

The choice is stored in the browser under `rg_analytics_consent_v1`. Analytics
accepts only these anonymous funnel events:

- `address_search_started`
- `property_check_completed`
- `report_form_viewed`
- `report_request_submitted`
- `report_delivery_outcome`, with only `delivered`, `partial`, or `failed`

The analytics boundary rejects extra fields. Do not add names, phone numbers,
email addresses, exact addresses, property identifiers, coordinates, map data,
free text, report content, or advertising-profile data.

## Search indexing

The Vercel test deployment defaults to noindex through page metadata,
`robots.txt`, and an `X-Robots-Tag` response header. Keep
`SITE_INDEXING_ENABLED=false` for the temporary Vercel hostname.

Google Search Console is deliberately waiting for the confirmed final public
hostname. Only after that hostname and its ownership are confirmed should the
deployment set `SITE_INDEXING_ENABLED=true` and register the matching Search
Console property.
