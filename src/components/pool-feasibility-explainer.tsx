"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import "./pool-feasibility-explainer.css";

const steps = [
  {
    number: "01",
    title: "Find your property",
    image: "/pool-projects/how-it-works-find-property-v2.png",
    imageAlt: "PoolReady example: find your property",
  },
  {
    number: "02",
    title: "Select a pool size",
    image: "/pool-projects/how-it-works-select-pool-v2.png",
    imageAlt: "PoolReady example: select a pool size",
  },
  {
    number: "03",
    title: "Position your pool",
    image: "/pool-projects/how-it-works-position-pool-v2.png",
    imageAlt: "PoolReady example: position your pool",
  },
  {
    number: "04",
    title: "Check mapped information",
    image: "/pool-projects/how-it-works-check-mapped-v2.png",
    imageAlt: "PoolReady example: check mapped information",
  },
  {
    number: "05",
    title: "Understand your next steps",
    image: "/pool-projects/how-it-works-next-steps-v3.png",
    imageAlt: "PoolReady example: understand your next steps",
  },
] as const;

export function PoolFeasibilityExplainer() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = steps[activeStepIndex];

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveStepIndex((currentStep) => (currentStep + 1) % steps.length);
    }, 3_600);

    return () => window.clearInterval(timer);
  }, [activeStepIndex]);

  return (
    <div className="pool-feasibility-explainer">
      <ol className="pool-process-rail" aria-label="Property check steps">
        {steps.map((step, index) => (
          <li
            className={index === activeStepIndex ? "is-current" : undefined}
            aria-current={index === activeStepIndex ? "step" : undefined}
            key={step.number}
          >
            <button
              className="pool-process-button"
              onClick={() => setActiveStepIndex(index)}
              type="button"
            >
              <span className="pool-process-number" aria-hidden="true">
                {step.number}
              </span>
              <span className="pool-process-title">{step.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <figure className="pool-demo-figure">
        <Image
          alt={activeStep.imageAlt}
          className="pool-demo-image"
          fill
          sizes="(max-width: 767px) 100vw, 1216px"
          src={activeStep.image}
        />
        <figcaption className="sr-only">
          Illustrative example for {activeStep.title.toLowerCase()}.
        </figcaption>
      </figure>
    </div>
  );
}
