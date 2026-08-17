"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import "./pool-feasibility-explainer.css";

const slides = [
  {
    number: "01",
    title: "Find the property",
    detail: "Start with the site, its shape, and the space around it.",
    image: "/pool-projects/how-it-works-property-v1.png",
    imageClassName: "pool-explainer-photo-property",
  },
  {
    number: "02",
    title: "Try a pool position",
    detail: "Use the available space to explore an indicative layout.",
    image: "/pool-projects/how-it-works-position-v1.png",
    imageClassName: "pool-explainer-photo-position",
  },
  {
    number: "03",
    title: "See what needs checking",
    detail: "Keep access, fencing, levels, and surrounds in view.",
    image: "/pool-projects/how-it-works-checks-v1.png",
    imageClassName: "pool-explainer-photo-checks",
  },
  {
    number: "04",
    title: "Get your preliminary report",
    detail: "Carry clearer questions into the next conversation.",
    image: "/pool-projects/how-it-works-report-v1.png",
    imageClassName: "pool-explainer-photo-report",
  },
] as const;

export function PoolFeasibilityExplainer() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % slides.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      className="pool-feasibility-explainer"
      aria-labelledby="pool-explainer-title"
    >
      <div className="sr-only">
        <h2 id="pool-explainer-title">How Pool Lab works</h2>
        <p>
          Find your property, try an indicative pool position, see what needs
          checking, and receive a preliminary report.
        </p>
      </div>
      <div className="pool-explainer-stage" aria-hidden="true">
        {slides.map((slide, index) => (
          <article
            className={`pool-explainer-slide ${
              index === activeSlide ? "is-active" : ""
            }`}
            key={slide.number}
          >
            <Image
              alt=""
              className={`pool-explainer-photo ${slide.imageClassName}`}
              fill
              sizes="(max-width: 1023px) 100vw, 480px"
              src={slide.image}
            />
            <div className="pool-explainer-photo-wash" />
            <div className="pool-explainer-step-copy">
              <span>{slide.number}</span>
              <div>
                <h3>{slide.title}</h3>
                <p>{slide.detail}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
