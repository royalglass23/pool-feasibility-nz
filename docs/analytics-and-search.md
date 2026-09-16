# Analytics consent and search indexing

## Analytics

PostHog uses the PoolReady EU project key in the public Property Check. GA4 and
Hotjar are optional. Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` to a valid
`G-...` measurement ID and/or `NEXT_PUBLIC_HOTJAR_SITE_ID` to the numeric Site
ID from Hotjar. With neither configured, PostHog is still available after consent.

The visitor must select **Allow analytics** before any analytics script is loaded.
**Reject analytics** and **Not now** leave them unloaded. The persistent
**Analytics settings** control lets the visitor change the choice later;
turning analytics off disables collection and removes first-party `_ga` and
`_hj` cookies that are accessible to the site. PostHog uses no persistent
browser storage here and is opted out again when consent is withdrawn.

Hotjar runs only on the public Property Check, never on `/staff` routes. The
Property Check component is marked `data-hj-suppress`, so Hotjar does not
receive addresses, maps, report content, contact details, coordinates, or free
text. Do not use the Hotjar Identify API or add `data-hj-allow` to any field.
In Hotjar Site Settings, keep input suppression on and configure data
suppression before enabling recordings.

PostHog runs only on the public Property Check. Automatic click, pageview,
pageleave, heatmap, error, and session recording capture is disabled. It sends
only the anonymous funnel events listed below; the outgoing event filter drops
all other event names and removes automatic event properties. Do not call
`identify` or enable automatic capture without revisiting the privacy boundary.

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
