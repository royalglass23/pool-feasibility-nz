import "./pool-feasibility-explainer.css";

const slideDelays = ["0s", "-10s", "-8s", "-6s", "-4s", "-2s"];

type SlideProps = {
  index: number;
  children: React.ReactNode;
  className?: string;
};

function Slide({ index, children, className = "" }: SlideProps) {
  return (
    <div
      aria-hidden="true"
      className={`pool-explainer-slide ${className}`}
      style={
        { "--pool-explainer-delay": slideDelays[index] } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

function StepHeading({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pool-explainer-step-heading">
      <span>{number}</span>
      <h3>{children}</h3>
    </div>
  );
}

function IntroSlide() {
  return (
    <Slide index={0} className="pool-explainer-intro">
      <svg className="pool-explainer-waves" viewBox="0 0 480 445" fill="none">
        <path
          d="M-25 348C67 280 116 396 208 329s139-5 297-70"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M-31 374c87-63 148 52 232-9s143 10 305-55"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M359 27c30 4 49 20 70 51"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <div className="pool-explainer-intro-copy">
        <span className="pool-explainer-kicker">Pool Lab</span>
        <h3>How it works</h3>
        <p>A simple 4-step process for pool feasibility</p>
      </div>
      <span className="pool-explainer-spark pool-explainer-spark-one" />
      <span className="pool-explainer-spark pool-explainer-spark-two" />
      <span className="pool-explainer-orbit" />
    </Slide>
  );
}

function SearchPropertySlide() {
  return (
    <Slide index={1} className="pool-explainer-search">
      <StepHeading number="1">Search your property</StepHeading>
      <div className="pool-explainer-scene pool-explainer-search-scene">
        <svg viewBox="0 0 480 445" fill="none" aria-hidden="true">
          <path d="M57 183 152 130l73 46-93 55-75-48Z" fill="#E0EEE9" />
          <path d="m237 125 87-49 80 47-93 52-74-50Z" fill="#ECF2E9" />
          <path d="m239 240 85-48 86 48-87 50-104-52Z" fill="#E2EEE5" />
          <path d="m78 289 70-41 83 49-75 43-78-51Z" fill="#EEF2E8" />
          <path
            d="M25 252 443 15M23 345 454 99M176 421 469 254"
            stroke="#C6D8D1"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M0 199 267 445M39 91l355 354M222 0l258 253"
            stroke="#DCE7E2"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="m184 173 78-44 84 51-82 47-80-54Z"
            fill="#D8F1E7"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="m184 173 80 54v83l-80-55v-82Z"
            fill="#BFDFD3"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="m264 227 82-47v82l-82 48v-83Z"
            fill="#D0E9DD"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect
            x="218"
            y="197"
            width="56"
            height="31"
            rx="7"
            transform="rotate(-31 218 197)"
            fill="#819C90"
          />
        </svg>
        <div className="pool-explainer-pin">
          <span />
        </div>
        <div className="pool-explainer-lens">
          <i />
        </div>
        <div className="pool-explainer-address">Your property</div>
      </div>
    </Slide>
  );
}

function PositionPoolSlide() {
  return (
    <Slide index={2} className="pool-explainer-position">
      <StepHeading number="2">Position your pool</StepHeading>
      <div className="pool-explainer-scene pool-explainer-position-scene">
        <svg viewBox="0 0 480 445" fill="none" aria-hidden="true">
          <path
            d="M103 108 344 82l56 89-29 177-241 17-42-97 15-160Z"
            fill="#E7F0E8"
            stroke="#0F766E"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="m88 268 154-15 35 112-147 0-42-97Z" fill="#D5E7D3" />
          <path d="m344 82 56 89-29 177-94 17-35-112 102-171Z" fill="#DCEADE" />
          <path d="m168 137 100-11 36 60-101 12-35-61Z" fill="#788D84" />
          <path d="m111 197 48-5 14 28-49 6-13-29Z" fill="#A6B99C" />
          <path
            d="M108 322c51-12 82-4 116 21"
            stroke="#B0C5A9"
            strokeWidth="15"
            strokeLinecap="round"
          />
        </svg>
        <div className="pool-explainer-pool-selection">
          <div className="pool-explainer-pool-water" />
          <span className="pool-explainer-handle pool-explainer-handle-one" />
          <span className="pool-explainer-handle pool-explainer-handle-two" />
          <span className="pool-explainer-rotate">↻</span>
        </div>
        <div className="pool-explainer-cursor" />
        <div className="pool-explainer-position-hint">
          <span>↔</span> Drag to move <span>↻</span> Drag to rotate
        </div>
      </div>
    </Slide>
  );
}

function CheckConstraintsSlide() {
  const layers = [
    ["Water", "#BFE4F0", "#237E9A"],
    ["Wastewater", "#E5D9F3", "#7659A7"],
    ["Environment", "#D3E9D6", "#398552"],
    ["Electricity", "#F6E5B9", "#A66F14"],
  ] as const;

  return (
    <Slide index={3} className="pool-explainer-constraints">
      <StepHeading number="3">See what needs checking</StepHeading>
      <p className="pool-explainer-support">
        Review mapped constraints around your pool.
      </p>
      <div className="pool-explainer-layer-stack">
        {layers.map(([label, fill, stroke], index) => (
          <div
            className={`pool-explainer-layer pool-explainer-layer-${index + 1}`}
            key={label}
            style={
              {
                "--layer-fill": fill,
                "--layer-stroke": stroke,
              } as React.CSSProperties
            }
          >
            <svg viewBox="0 0 270 92" fill="none" aria-hidden="true">
              <path
                d="M14 19 132 7l123 18-23 50-122 11L14 64V19Z"
                fill="var(--layer-fill)"
                stroke="var(--layer-stroke)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M40 42c31-16 52 11 82-3 27-13 50 16 100-9"
                stroke="var(--layer-stroke)"
                strokeWidth="4"
                strokeLinecap="round"
                opacity=".62"
              />
              <path
                d="M66 67c32-15 68 5 108-7"
                stroke="var(--layer-stroke)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".38"
              />
            </svg>
            <span>{label}</span>
            {index === 1 ? (
              <b aria-hidden="true">!</b>
            ) : (
              <i aria-hidden="true">✓</i>
            )}
          </div>
        ))}
      </div>
    </Slide>
  );
}

function ReportSlide() {
  return (
    <Slide index={4} className="pool-explainer-report">
      <StepHeading number="4">Get your preliminary report</StepHeading>
      <div className="pool-explainer-report-card">
        <div className="pool-explainer-report-topline">
          <span>PROPERTY OVERVIEW</span>
          <i>✓</i>
        </div>
        <div className="pool-explainer-report-summary">
          <div className="pool-explainer-report-map">
            <span />
            <b />
          </div>
          <div>
            <strong>Early pool-planning view</strong>
            <p>Clear next checks, in one place.</p>
          </div>
        </div>
        <div className="pool-explainer-report-row">
          <i /> <span>Property context reviewed</span>
          <b>✓</b>
        </div>
        <div className="pool-explainer-report-row">
          <i /> <span>Mapped layers included</span>
          <b>✓</b>
        </div>
        <div className="pool-explainer-report-row">
          <i /> <span>Next steps made clear</span>
          <b>→</b>
        </div>
      </div>
    </Slide>
  );
}

function ClosingSlide() {
  return (
    <Slide index={5} className="pool-explainer-closing">
      <span className="pool-explainer-closing-mark">✓</span>
      <div className="pool-explainer-closing-copy">
        <p>
          <strong>Smart</strong> analysis.
        </p>
        <p>
          <strong>Local</strong> insights.
        </p>
        <p>
          <strong>Confident</strong> decisions.
        </p>
      </div>
    </Slide>
  );
}

export function PoolFeasibilityExplainer() {
  return (
    <section
      className="pool-feasibility-explainer"
      aria-labelledby="pool-explainer-title"
    >
      <div className="sr-only">
        <h2 id="pool-explainer-title">How Pool Lab works</h2>
        <p>
          Search your property, position your pool, review mapped checks, and
          receive a preliminary report. Smart analysis. Local insights.
          Confident decisions.
        </p>
      </div>
      <div className="pool-explainer-stage">
        <IntroSlide />
        <SearchPropertySlide />
        <PositionPoolSlide />
        <CheckConstraintsSlide />
        <ReportSlide />
        <ClosingSlide />
      </div>
    </section>
  );
}
