const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Formats a number as a USD currency string, e.g. `1234.5` -> `"$1,234.50"`. */
export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}
