import type {
  StaffConstructabilityEvidence as StaffConstructabilityEvidenceModel,
  StaffEvidenceSourceRow,
} from "@/modules/staff/staff-assessment-read-model";

export function StaffConstructabilityEvidence({
  evidence,
}: {
  evidence: StaffConstructabilityEvidenceModel;
}) {
  return (
    <section
      aria-labelledby="staff-constructability-heading"
      className="border-pool-200 rounded-3xl border bg-white p-5 shadow-sm sm:p-8"
    >
      <div className="border-pool-200 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-pool-blue-700 text-xs font-bold tracking-wide uppercase">
            Staff evidence view
          </p>
          <h2
            id="staff-constructability-heading"
            className="text-pool-950 mt-2 text-2xl font-semibold tracking-tight"
          >
            Saved constructability evidence
          </h2>
          <p className="text-pool-600 mt-2 max-w-3xl text-sm leading-6">
            Submission-time facts and provenance. This view does not rerun
            providers or verify the site.
          </p>
        </div>
        <p className="border-pool-200 bg-pool-50 text-pool-700 rounded-sm border px-3 py-1.5 text-xs font-bold tracking-wide uppercase">
          Read-only saved snapshot
        </p>
      </div>

      {evidence.status === "not_assessed" ? (
        <div className="border-pool-200 bg-pool-50 mt-5 rounded-2xl border p-5">
          <p className="text-pool-900 font-semibold">Not assessed</p>
          <p className="text-pool-600 mt-2 text-sm leading-6">
            {evidence.reason}
          </p>
        </div>
      ) : (
        <CapturedEvidence evidence={evidence} />
      )}
    </section>
  );
}

function CapturedEvidence({
  evidence,
}: {
  evidence: Extract<StaffConstructabilityEvidenceModel, { status: "captured" }>;
}) {
  return (
    <div className="mt-6 space-y-7">
      <dl className="grid gap-3 sm:grid-cols-3">
        <StatusFact
          label="Overall status"
          value={evidence.overallStatus.label}
        />
        <StatusFact
          label="Saved constructability result"
          value={evidence.sectionStatus.label}
        />
        <StatusFact
          label="Estimated pool depth"
          value={evidence.estimatedDepth}
        />
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <EvidenceCard title="Site answers">
          <AnswerList
            label="Visible access or excavation conditions"
            values={evidence.siteAnswers.accessConditions}
          />
          <AnswerList
            label="Features close to the proposed pool area"
            values={evidence.siteAnswers.nearbyFeatures}
          />
        </EvidenceCard>

        <EvidenceCard title="Saved access route">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <SmallFact label="Response" value={evidence.route.response} />
            <SmallFact label="Provenance" value={evidence.route.provenance} />
            {evidence.routeFacts.map((fact) => (
              <SmallFact
                key={fact.label}
                label={fact.label}
                value={fact.value}
              />
            ))}
          </dl>
          <div>
            <p className="text-pool-600 text-xs font-bold tracking-wide uppercase">
              Saved route geometry
            </p>
            <ItemList
              empty="No confirmed route geometry was saved."
              items={evidence.route.points.map(
                (point) => `${point.label}: ${point.coordinate}`,
              )}
            />
          </div>
        </EvidenceCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EvidenceCard title="Excavation assumptions and scenarios">
          {evidence.excavation.status === "not_assessed" ? (
            <NeutralMessage>{evidence.excavation.reason}</NeutralMessage>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {evidence.excavation.scenarios.map((scenario) => (
                  <SmallFact
                    key={scenario.label}
                    label={scenario.label}
                    value={scenario.value}
                  />
                ))}
                <SmallFact
                  label="Side allowance"
                  value={evidence.excavation.sideAllowance}
                />
                <SmallFact
                  label="Assumption ID"
                  value={evidence.excavation.assumption}
                />
              </dl>
              <p className="bg-pool-50 text-pool-700 mt-4 rounded-xl p-3 text-sm leading-6">
                {evidence.excavation.terrain}
              </p>
            </>
          )}
          <ItemList
            empty="No additional saved assumptions."
            items={evidence.assumptions}
          />
        </EvidenceCard>

        <EvidenceCard title="Resulting statuses">
          <ItemList
            empty="No saved constructability findings."
            items={evidence.findings.map(
              (finding) =>
                `${finding.category} · ${finding.source} · ${finding.status}: ${finding.evidence}`,
            )}
          />
        </EvidenceCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SourceEvidenceCard
          title="Mapped evidence"
          empty="No saved mapped evidence."
          rows={evidence.mappedEvidence}
        />
        <EvidenceCard title="User-supplied evidence">
          <ItemList
            empty="No saved user-supplied evidence."
            items={evidence.userEvidence.map(
              (item) => `${item.category} · ${item.evidence}`,
            )}
          />
        </EvidenceCard>
        <SourceEvidenceCard
          title="Provider availability"
          empty="No saved provider availability evidence."
          rows={evidence.providerAvailability}
        />
      </div>
    </div>
  );
}

function SourceEvidenceCard({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: StaffEvidenceSourceRow[];
}) {
  return (
    <EvidenceCard title={title}>
      <ItemList
        empty={empty}
        items={rows.map(
          (item) =>
            `${item.category} · ${item.provider} — ${item.dataset} · ${item.status}`,
        )}
      />
    </EvidenceCard>
  );
}

function EvidenceCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-pool-200 rounded-2xl border p-4 sm:p-5">
      <h3 className="text-pool-950 font-semibold">{title}</h3>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function StatusFact({ label, value }: { label: string; value: string }) {
  const uncertain = /Not fully assessed/i.test(value);
  const consideration = /Needs checking/i.test(value);
  return (
    <div
      className={`rounded-2xl border p-4 ${
        consideration
          ? "border-amber-200 bg-amber-50"
          : uncertain
            ? "border-pool-200 bg-pool-50"
            : "border-pool-blue-200 bg-pool-blue-50"
      }`}
    >
      <dt className="text-pool-600 text-xs font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-pool-950 mt-2 font-semibold">{value}</dd>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-pool-500 text-xs font-bold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-pool-900 mt-1 font-medium break-words">{value}</dd>
    </div>
  );
}

function AnswerList({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <p className="text-pool-600 text-xs font-bold tracking-wide uppercase">
        {label}
      </p>
      <ItemList empty="No saved answer." items={values} />
    </div>
  );
}

function ItemList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <NeutralMessage>{empty}</NeutralMessage>;
  return (
    <ul className="text-pool-800 space-y-2 text-sm leading-6">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span aria-hidden="true" className="text-pool-blue-700">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NeutralMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-pool-600 text-sm leading-6">{children}</p>;
}
