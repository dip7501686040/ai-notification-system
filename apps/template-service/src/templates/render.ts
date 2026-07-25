// Straight {{variable}} substitution, no control flow or partials -- the
// full scope FR-6 calls for. Missing keys render as an empty string rather
// than leaving the token or throwing.
export function renderString(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
