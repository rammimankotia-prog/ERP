/**
 * B2B & Financial Utilities
 */

/**
 * Calculates the B2B price based on the B2C price and the agent's discount percentage.
 * Formula: B2B = B2C - (B2C * (Discount / 100))
 */
export function calculateB2bPrice(b2cPrice: number, discountPercentage: number): number {
  return b2cPrice * (1 - discountPercentage / 100);
}

/**
 * Calculates GST amount and Grand Total.
 * Default GST for hotels in India is often 12% or 18% depending on slab.
 */
export function calculateGst(amount: number, rate: number = 12): { gst: number; total: number } {
  const gst = amount * (rate / 100);
  return {
    gst,
    total: amount + gst
  };
}

/**
 * Formats a number as Indian Rupee (INR).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
