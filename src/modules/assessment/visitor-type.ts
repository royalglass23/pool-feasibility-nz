export const visitorTypeOptions = [
  { value: "homeowner", label: "Homeowner" },
  { value: "pool_builder", label: "Pool Builder" },
  { value: "other", label: "Other" },
] as const;

export type VisitorType = (typeof visitorTypeOptions)[number]["value"];

export function getVisitorTypeLabel(visitorType: VisitorType): string {
  return (
    visitorTypeOptions.find((option) => option.value === visitorType)?.label ??
    visitorType
  );
}
