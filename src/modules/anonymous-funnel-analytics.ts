export const ANALYTICS_CONSENT_STORAGE_KEY = "rg_analytics_consent_v1";

const SIMPLE_FUNNEL_EVENT_NAMES = [
  "address_search_started",
  "property_check_completed",
  "report_form_viewed",
  "report_request_submitted",
] as const;

const DELIVERY_OUTCOME_CATEGORIES = ["delivered", "partial", "failed"] as const;

type SimpleFunnelEventName = (typeof SIMPLE_FUNNEL_EVENT_NAMES)[number];
type DeliveryOutcomeCategory = (typeof DELIVERY_OUTCOME_CATEGORIES)[number];

type AnonymousFunnelEvent =
  | { name: SimpleFunnelEventName }
  | {
      name: "report_delivery_outcome";
      outcomeCategory: DeliveryOutcomeCategory;
    };

const SIMPLE_FUNNEL_EVENTS = new Set<string>(SIMPLE_FUNNEL_EVENT_NAMES);
const DELIVERY_OUTCOMES = new Set<string>(DELIVERY_OUTCOME_CATEGORIES);

type Gtag = (...arguments_: unknown[]) => void;
type AnalyticsWindow = Window & { gtag?: Gtag };

export function trackAnonymousFunnelEvent(event: unknown): boolean {
  if (!hasAnalyticsConsent() || !isAnonymousFunnelEvent(event)) return false;

  const gtag = (window as AnalyticsWindow).gtag;
  if (!gtag) return false;

  if (event.name === "report_delivery_outcome") {
    gtag("event", event.name, {
      outcome_category: event.outcomeCategory,
    });
  } else {
    gtag("event", event.name);
  }
  return true;
}

function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === "granted";
  } catch {
    return false;
  }
}

function isAnonymousFunnelEvent(value: unknown): value is AnonymousFunnelEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const event = value as Record<string, unknown>;
  const keys = Object.keys(event);
  if (typeof event.name !== "string") return false;

  if (SIMPLE_FUNNEL_EVENTS.has(event.name)) {
    return keys.length === 1 && keys[0] === "name";
  }

  return (
    event.name === "report_delivery_outcome" &&
    keys.length === 2 &&
    keys.includes("name") &&
    keys.includes("outcomeCategory") &&
    typeof event.outcomeCategory === "string" &&
    DELIVERY_OUTCOMES.has(event.outcomeCategory)
  );
}
