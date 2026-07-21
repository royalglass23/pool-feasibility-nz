---
name: Pool Feasibility NZ
description: Evidence-led Auckland property screening for Royal Glass staff.
colors:
  evidence-teal: "oklch(51.1% 0.096 186.391)"
  evidence-teal-deep: "oklch(43.7% 0.078 188.216)"
  evidence-teal-soft: "oklch(98.4% 0.014 180.72)"
  survey-ink: "oklch(12.9% 0.042 264.695)"
  survey-text: "oklch(44.6% 0.043 257.281)"
  survey-muted: "oklch(55.4% 0.046 257.417)"
  survey-line: "oklch(92.9% 0.013 255.508)"
  survey-wash: "oklch(98.4% 0.003 247.858)"
  working-surface: "oklch(100% 0 0)"
  caution-amber: "oklch(55.5% 0.163 48.998)"
  caution-soft: "oklch(98.7% 0.022 95.277)"
  blocker-red: "oklch(50.5% 0.213 27.518)"
  blocker-soft: "oklch(97.1% 0.013 17.38)"
typography:
  display:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  compact: "8px"
  control: "14px"
  panel: "18px"
  section: "22px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.survey-ink}"
    textColor: "{colors.working-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.panel}"
    padding: "14px 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.evidence-teal-deep}"
    textColor: "{colors.working-surface}"
  button-secondary:
    backgroundColor: "{colors.working-surface}"
    textColor: "{colors.survey-text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "44px"
  input-property:
    backgroundColor: "{colors.survey-wash}"
    textColor: "{colors.survey-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.panel}"
    padding: "12px 16px"
    height: "52px"
  panel-result:
    backgroundColor: "{colors.working-surface}"
    textColor: "{colors.survey-ink}"
    rounded: "{rounded.section}"
    padding: "24px"
  chip-success:
    backgroundColor: "{colors.evidence-teal-soft}"
    textColor: "{colors.evidence-teal-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-warning:
    backgroundColor: "{colors.caution-soft}"
    textColor: "{colors.caution-amber}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Pool Feasibility NZ

## Overview

**Creative North Star: "The Evidence Desk"**

The interface is a calm working surface for property investigation. It should feel like an organized evidence brief laid out for a trained operator: the preliminary decision is easy to locate, the supporting material remains close at hand, and uncertainty is never disguised as polish.

The system is precise without becoming bureaucratic and responsive without becoming theatrical. Information density is welcome when it supports comparison or provenance, but long results should reveal detail progressively. Motion is reserved for state changes and feedback. The interface explicitly rejects the flashy consumer sales funnel, the generic SaaS dashboard, and any styling that could be mistaken for an official Council approval system.

**Key Characteristics:**

- Restrained slate neutrals with teal reserved for evidence, interaction, and positive state.
- White working surfaces separated by fine borders, tinted sections, and sparing elevation.
- Compact, readable Geist typography with strong labels and tabular data where needed.
- Progressive disclosure for dense evidence, limitations, provenance, and report sections.
- Explicit warning, error, unavailable, loading, and verified states.

## Colors

Survey Slate carries the document-like working surface; Evidence Teal identifies trusted interaction and validated state; Caution Amber and Blocker Red communicate consequential exceptions.

### Primary

- **Evidence Teal:** Use for focus, selected controls, verified checks, links, and positive evidence states. It is functional, not decorative.
- **Evidence Teal Deep:** Use for high-contrast hover states and teal text on light teal surfaces.
- **Evidence Teal Soft:** Use as a quiet background for progress, verified summaries, and explanatory evidence.

### Secondary

- **Caution Amber:** Use for unknowns, limitations, partial evidence, and choices requiring staff attention.
- **Caution Soft:** Use behind caution content so warnings remain readable without dominating the assessment.
- **Blocker Red:** Use only for failed requests, invalid states, and conditions that stop the workflow.
- **Blocker Soft:** Use behind error content; never use it as general emphasis.

### Neutral

- **Survey Ink:** Primary headings, decisive actions, and high-priority facts.
- **Survey Text:** Body copy and secondary controls.
- **Survey Muted:** Metadata and supporting labels that remain readable.
- **Survey Line:** Dividers, table rules, and container borders.
- **Survey Wash:** Field backgrounds and subordinate evidence groups.
- **Working Surface:** Primary panels, controls, and report sections.

### Named Rules

**The Evidence Colour Rule.** Teal means evidence, interaction, selection, or verified state. It must never become ambient decoration across a whole screen.

**The Honest State Rule.** Amber means incomplete, cautionary, or unknown; red means failed or blocked. Never soften a blocker into amber merely to make the page look calmer.

## Typography

**Display Font:** Geist (with Arial and sans-serif fallbacks)  
**Body Font:** Geist (with Arial and sans-serif fallbacks)  
**Label/Mono Font:** Geist Mono for identifiers only

**Character:** One technical humanist family keeps the tool cohesive and legible. Hierarchy comes from weight, size, spacing, and placement—not from mixing decorative fonts into operational UI.

### Hierarchy

- **Display** (600, 3.75rem at desktop / 2.25rem on compact screens, 1.25 line-height): Reserved for the page purpose; use once per view.
- **Headline** (600, 1.875rem, 1.25 line-height): Result identity and major assessment headings.
- **Title** (600, 1.25rem, 1.5 line-height): Section headings and prominent findings.
- **Body** (400, 1rem, 1.75 line-height): Instructions and explanatory prose, normally capped near 70 characters per line.
- **Label** (600, 0.875rem, normal tracking): Fields, buttons, table labels, and compact metadata.
- **Data label** (600–700, 0.75rem, 0.05em–0.18em tracking, uppercase): Use sparingly for evidence categories and status summaries, never as the default heading pattern for every section.

### Named Rules

**The Operational Voice Rule.** Labels and controls use Geist at compact fixed sizes. Display styling never enters buttons, fields, tables, or status chips.

**The One-Eyebrow Rule.** A small uppercase evidence label may orient a complex result, but repeated eyebrow labels must not scaffold every section.

## Elevation

The system is layered but restrained. Fine slate borders and background shifts organize most content. A low shadow may separate a major white working surface from the page or protect map legibility; subordinate cards remain border-led and nearly flat.

### Shadow Vocabulary

- **Working surface** (`0 24px 80px -36px rgb(15 23 42 / 35%)`): Use only for the primary address-and-analysis surface.
- **Panel lift** (`0 1px 2px 0 rgb(0 0 0 / 5%)`): Use for major result panels, map containers, and actions that must remain distinct from surrounding content.

### Named Rules

**The Border-Before-Shadow Rule.** Reach for a one-pixel Survey Line border or tonal background first. Never pair a fine border with a broad decorative shadow on ordinary cards.

**The One-Working-Surface Rule.** Only the main entry surface receives ambient elevation. Evidence within it is grouped by spacing, dividers, and disclosure—not nested floating cards.

## Components

Components are direct, sturdy, and quietly responsive. Every interactive pattern must expose hover, focus, disabled, loading, and error behavior where those states apply.

### Buttons

- **Shape:** Primary workflow buttons use gently rounded corners (18px); compact library and map actions use tighter corners (8–14px).
- **Primary:** Survey Ink background, white text, semibold label, 52px minimum height, and 24px horizontal padding.
- **Hover / Focus:** Hover shifts to Evidence Teal Deep. Keyboard focus uses a clearly separated teal outline or ring; pressed state may move by one pixel. Disabled buttons remain legible and visibly inactive.
- **Secondary:** White working surface, Survey Text, a Survey Line border, 44px minimum height, and no decorative glow.

### Chips

- **Style:** Full-pill status badges pair a soft state background with the darker state colour and a subtle inset ring.
- **State:** Teal communicates success or verified evidence, amber communicates caution or partial evidence, slate communicates unavailable or neutral state, and red communicates failure.

### Cards / Containers

- **Corner Style:** Summary cards use 18px corners; major report sections use 22px corners.
- **Background:** Working Surface for primary content; Survey Wash for subordinate evidence groups; state-soft backgrounds for warnings and errors.
- **Shadow Strategy:** Major surfaces may use Panel Lift. Nested evidence groups remain flat.
- **Border:** One-pixel Survey Line is the default separator.
- **Internal Padding:** 20px on compact cards and 24px on major result panels.

### Inputs / Fields

- **Style:** Survey Wash background, Survey Line border, Survey Ink text, and 14–18px corners. Primary address entry is 52px high; selects are at least 44px high.
- **Focus:** Shift to a white background with an Evidence Teal border and a low-opacity four-pixel teal ring.
- **Error / Disabled:** Errors use Blocker Red with text explanation. Disabled controls retain readable text and make their inactive state explicit.

### Navigation

The current POC is a single-task surface and has no persistent navigation. If navigation is introduced, keep it compact and workflow-led; use Survey Slate for structure and Evidence Teal only for the current location.

### Expandable Evidence Sections

Native disclosure controls are the baseline for dense provenance and future report sections. The summary remains a concise semibold statement; expansion reveals supporting details without changing the meaning or status of the collapsed section. Keyboard and screen-reader behavior must remain native, and the most decision-relevant summary must remain visible while collapsed.

### Property Map

The map is an evidence surface, not a decorative hero. A Survey Ink header and frame preserve legibility around aerial imagery. Layer controls, legend, attribution, parcel identity, and retry state remain visible and keyboard operable; map colours must retain meaning outside colour alone.

## Do's and Don'ts

### Do:

- **Do** lead with the preliminary decision and make its evidence available through progressive disclosure.
- **Do** preserve clear distinctions between verified, unavailable, unknown, warning, and failed states.
- **Do** use Evidence Teal only for interaction, selection, evidence, and positive state.
- **Do** keep controls at least 44px high for primary staff workflows and provide visible keyboard focus.
- **Do** use native disclosure semantics for expandable report sections and keep meaningful summaries visible when collapsed.
- **Do** keep attribution, property identity, uncertainty, and screening limitations visible in downloadable and on-screen reports.

### Don't:

- **Don't** make the interface resemble a flashy consumer sales funnel.
- **Don't** make the interface resemble a generic SaaS dashboard.
- **Don't** make the interface resemble an official Council approval system.
- **Don't** use decorative complexity, sales-led urgency, or visual authority to overstate a preliminary result.
- **Don't** turn every result into an identical card or nest cards inside cards; use spacing, dividers, tables, and disclosure first.
- **Don't** use gradient text, decorative glassmorphism, coloured side-stripe borders, or oversized card radii.
- **Don't** hide uncertainty, attribution, or unavailable evidence in collapsed sections when it materially changes the decision.
- **Don't** use colour as the only carrier of status or animate content without a reduced-motion alternative.
