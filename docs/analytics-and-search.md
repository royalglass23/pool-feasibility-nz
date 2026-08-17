# Analytics consent and search indexing

## Analytics

GA4 and Hotjar are optional. Set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` to a valid
`G-...` measurement ID and/or `NEXT_PUBLIC_HOTJAR_SITE_ID` to the numeric Site
ID from Hotjar. With neither configured, the site remains fully usable and no
analytics script is rendered.

The visitor must select **Allow analytics** before either script is loaded.
**Reject analytics** and **Not now** leave them unloaded. The persistent
**Analytics settings** control lets the visitor change the choice later;
turning analytics off disables collection and removes first-party `_ga` and
`_hj` cookies that are accessible to the site.

Hotjar runs only on the public Property Check, never on `/staff` routes. The
Property Check component is marked `data-hj-suppress`, so Hotjar does not
receive addresses, maps, report content, contact details, coordinates, or free
text. Do not use the Hotjar Identify API or add `data-hj-allow` to any field.
In Hotjar Site Settings, keep input suppression on and configure data
suppression before enabling recordings.

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
