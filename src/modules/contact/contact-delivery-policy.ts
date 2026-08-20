import "server-only";

export type ContactDeliveryEnvironment = {
  mode?: string;
  vercelEnvironment?: string;
  nodeEnvironment?: string;
};

export type ContactDeliveryPolicy =
  { mode: "synthetic_test" } | { mode: "production" };

/**
 * Synthetic delivery is deliberately a local-test-only sink. It never accepts
 * an address or forwards a message, so it cannot redirect contact details away
 * from the approved production recipient.
 */
export function resolveContactDeliveryPolicy(
  environment: ContactDeliveryEnvironment,
): ContactDeliveryPolicy {
  if (environment.mode === "synthetic_test") {
    if (
      !environment.vercelEnvironment &&
      (environment.nodeEnvironment === "development" ||
        environment.nodeEnvironment === "test")
    ) {
      return { mode: "synthetic_test" };
    }

    throw new Error("CONTACT_DELIVERY_MODE_DISABLED");
  }

  return { mode: "production" };
}
