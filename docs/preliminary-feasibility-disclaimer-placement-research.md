# Preliminary-feasibility disclaimer placement research

**Date:** 17 August 2026
**Scope:** wording and placement for the interactive Property Check map and its
downloaded Preliminary Feasibility Report. This is product-design research, not
legal advice or an approval determination.

## Decision

Use a **single, prominent preliminary-feasibility scope statement** at the
beginning of each result surface, then attach only **material, factual evidence
limits** to the result or map feature they qualify. Do not use repeated generic
`Needs checking` labels.

That hierarchy makes the preliminary nature of the whole result hard to miss,
without implying that every mapped item is an individual negative finding. It
also keeps a limit close to the claim it actually qualifies.

## Recommended hierarchy and placement

| Surface | Placement | Content | Purpose |
| --- | --- | --- | --- |
| Interactive result | Immediately below the result heading and **above the interactive map, score, or recommendation**. It remains visible at normal desktop/mobile use without opening a tooltip or accordion. | One compact scope statement, with a link/button to `How this feasibility check works`. | The visitor sees the qualification before interpreting a favourable layout or clearance. |
| Interactive map | A neutral, visible map caption/legend beside the clearance controls; not a warning badge on every line. | `Indicative mapped pool-shell clearances — not a survey or setback assessment.` | Says exactly what a dimension represents and excludes. |
| Specific evidence | Adjacent to the affected feature, result row, or data-source detail only when it could change interpretation. | Plain fact + consequence/action, for example `Boundary source: provisional. Confirm boundary/title before design.` | Preserves material uncertainty without turning ordinary preliminary status into repeated alarm. |
| PDF page 1 | Directly beneath the executive recommendation/summary, before the main map. | A slightly fuller version of the scope statement. | The qualification travels with the headline conclusion instead of being buried on the final page. |
| PDF map page and every page footer | Map caption on the map page; short `Preliminary Feasibility Report — indicative desktop screening` footer on every page. | Caption describes measurements; footer identifies document status. | A printed/extracted page keeps its context without duplicating a long disclaimer. |
| PDF detail page | `Evidence, assumptions and actions` section, after the risks/actions and sources. | Full list of evidence limits, dates, assumptions and required verification. | Provides auditability and the actionable detail without asking a short warning to carry all of it. |

### Copy

**Interactive result (primary statement)**

> Preliminary feasibility only. This indicative pool layout and mapped
> clearances are an early desktop screen based on available information; they
> are not an approved pool position, survey, title check, design, or consent
> decision. Confirm the boundary and complete normal site, service, design and
> approval checks before relying on it.

**Map caption**

> Indicative mapped pool-shell clearances — not a survey or setback assessment.

**PDF executive-summary statement**

> This preliminary feasibility report is an indicative desktop screen based on
> available mapped information. The proposed pool position and clearances are
> not a survey, title confirmation, detailed design, or approval. Confirm the
> boundary and complete normal site, service, design and approval checks before
> relying on this report.

Use the product term **Preliminary Feasibility Report** consistently. Avoid
`clear`, `approved`, `compliant`, `setback`, or a green/tick treatment for a
clearance value unless a distinct verified rule actually supports that claim.

## Specific limitations: when and how to show them

Show a local limitation only when it is material to the particular conclusion.
State the observed fact, then the effect or next check; do not label the item
generically as `Needs checking`.

| Evidence condition | Good local wording | Do not say |
| --- | --- | --- |
| Parcel/boundary is provisional or ambiguous | `Boundary source: provisional. Confirm boundary/title before design.` | `Needs checking` |
| Parcel geometry is mapped but a survey is still needed | `Mapped boundary used for this screen; it is not a site survey.` | `Boundary confirmed` |
| Aerial capture is dated or unclear | `Aerial imagery capture: 2024 (where available); imagery is not a survey.` | `Site condition verified` |
| No mapped service returned | `No service was returned by this mapped-data query; this does not confirm that services are absent.` | `No services` |
| Required source unavailable | `Stormwater layer unavailable for this check; it was not assessed.` | `No stormwater constraint found` |

The universal statement does **not** replace a local, material limitation. For
example, a provisional boundary can change the meaning of every displayed
clearance, so that fact belongs next to the map/result as well as in the detail
section.

## Why this is the appropriate pattern

1. New Zealand's Commerce Commission says qualifications, limitations and other
   important online terms must be clear rather than buried in fine print or a
   link-through page; a material term needs prominence in the offer. This
   directly supports the Page 1/above-map scope statement—not a disclaimer only
   at the end of a PDF. [Commerce Commission: Selling
   online](https://www.comcom.govt.nz/business/dealing-with-typical-situations/selling-goods-and-services/selling-online/).
2. Auckland Council says its GIS information is illustrative and indicative,
   does not warrant accuracy or completeness, and should be independently
   verified before action. The product should therefore qualify a mapped result
   at the point a visitor first sees it, while retaining the specific source
   condition where relevant. [Auckland Council geospatial terms and
   conditions](https://new.aucklandcouncil.govt.nz/en/geospatial/geospatial-terms-conditions.html)
   (disclaimer clauses 3–6).
3. LINZ cautions that the digital cadastre's accuracy varies and can affect
   precise boundary visualisation. It supports treating a measurement to a
   mapped parcel as indicative, rather than presenting it as a survey result.
   [LINZ: Accuracy of the digital
   cadastre](https://www.linz.govt.nz/products-services/data/types-linz-data/property-ownership-and-boundary-data/accuracy-digital-cadastre).
4. Auckland Council's residential-pool consent checklist requires site-plan
   dimensions, drainage information, fencing/barrier details, and—in relevant
   cases—engineering evidence. The feasibility map must therefore not look like
   a consent-ready plan simply because it displays shell-to-boundary dimensions.
   [Auckland Council: AC1032 Lodgement checklist—swimming or spa
   pool](https://www.aucklandcouncil.govt.nz/building-and-consents/Documents/ac1032-lodgement-checklist-swimming-spa-pool.pdf).
5. The United States FTC's official online-disclosure guidance is not New
   Zealand law, but reinforces the same claim-adjacent principle: qualifying
   information should be clear and unambiguous, close to the claim, prominent,
   and not hidden in fine print or distracting content. [FTC Advertising FAQs:
   A Guide for Small Business](https://www.ftc.gov/business-guidance/resources/advertising-faqs-guide-small-business).
6. W3C's WCAG 2.2 guidance requires labels/instructions where input is needed,
   and its explanatory guidance warns that too much instruction can be as
   harmful as too little. The map interaction should therefore have one visible,
   concise explanation plus accessible details, rather than a repeated warning
   on every measurement or control. [W3C, Understanding Success Criterion
   3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html).

## Fit with existing GeoMap documentation

This recommendation retains the existing `docs/limitations.md` baseline that
the report is preliminary and does not provide approval, survey, title, design,
or consent advice. It refines the existing `docs/report-format.md` layout: its
Page 3 limitations/disclaimer remain the detailed record, but the scope must
also appear beside the executive conclusion on Page 1. It also honours the
registered LINZ limitation that cadastral geometry is not a site survey and
imagery is not a survey (`docs/data-sources.md`).

## Acceptance criteria for later implementation

- A user sees the primary scope statement before or at the same time as the
  first clearance/recommendation; it is not tooltip-only.
- Every clearance has the neutral map caption and an accessible text equivalent.
- A PDF page 1 screenshot and a detached PDF page show the document's
  preliminary status.
- A material missing/provisional source is shown as a specific fact and action;
  no generic `Needs checking` badge is used for it.
- Favourable clearance values never imply surveyed boundary accuracy, statutory
  compliance, or approval.
