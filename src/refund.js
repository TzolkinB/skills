export function refundCharge(gateway, charge, amount) {
  if (amount <= 0) throw new Error('amount must be positive');
  if (amount > charge.amount) throw new Error('amount exceeds charge');
  return gateway.refund(charge.id, amount);
}
