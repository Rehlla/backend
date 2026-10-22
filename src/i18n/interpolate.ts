export type TVars = Record<string, string | number>;

export function interpolate(template: string, vars: TVars): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template
  );
}