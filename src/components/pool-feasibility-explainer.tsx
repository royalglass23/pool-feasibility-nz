import Image from "next/image";
import aerialDemonstration from "../../assets/plates/aerial-demonstration.png";
import "./pool-feasibility-explainer.css";

const steps = [
  {
    number: "01",
    title: "Find your property",
  },
  {
    number: "02",
    title: "Select a pool size",
  },
  {
    number: "03",
    title: "Position your pool",
  },
  {
    number: "04",
    title: "Check mapped information",
  },
  {
    number: "05",
    title: "Understand your next steps",
  },
] as const;

export function PoolFeasibilityExplainer() {
  return (
    <div className="pool-feasibility-explainer">
      <ol className="pool-process-rail" aria-label="Property check steps">
        {steps.map((step, index) => (
          <li
            className={index === 2 ? "is-current" : undefined}
            aria-current={index === 2 ? "step" : undefined}
            key={step.number}
          >
            <span className="pool-process-number" aria-hidden="true">
              {step.number}
            </span>
            <span className="pool-process-title">{step.title}</span>
          </li>
        ))}
      </ol>

      <figure className="pool-demo-figure">
        <Image
          alt="Illustrative aerial property view showing an indicative pool position and investigation buffer."
          className="pool-demo-image"
          fill
          sizes="(max-width: 767px) 100vw, 1216px"
          src={aerialDemonstration}
        />
        <figcaption className="sr-only">
          The property boundary, pool position, and construction allowance are
          indicative only.
        </figcaption>
        <span className="pool-demo-label pool-demo-label-property">
          Illustrative property
        </span>
        <span className="pool-demo-label pool-demo-label-buffer">
          1 m indicative investigation buffer
        </span>
        <span className="pool-demo-label pool-demo-label-pool">
          Indicative pool
        </span>
      </figure>
    </div>
  );
}
