const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => htmlEntities[character]);
}
