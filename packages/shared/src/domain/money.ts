/** Money is always an integer number of kopecks (minor units). */

const formatter = new Intl.NumberFormat('ru-BY', { style: 'currency', currency: 'BYN' });

export function formatMoney(minor: number): string {
  return formatter.format(minor / 100);
}

export function bynToMinor(byn: number): number {
  // Rounding protects against float noise like 0.1 + 0.2.
  return Math.round(byn * 100);
}

export function minorToByn(minor: number): number {
  return minor / 100;
}

export function formatOrderNumber(number: number): string {
  return `VH-${number}`;
}
