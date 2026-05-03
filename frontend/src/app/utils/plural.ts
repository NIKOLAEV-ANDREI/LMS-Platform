export function getRuNounForm(count: number, one: string, few: string, many: string): string {
  const absCount = Math.abs(count);
  const lastTwo = absCount % 100;
  const lastOne = absCount % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (lastOne === 1) return one;
  if (lastOne >= 2 && lastOne <= 4) return few;
  return many;
}

export function formatRuCount(count: number, one: string, few: string, many: string): string {
  return `${count} ${getRuNounForm(count, one, few, many)}`;
}
