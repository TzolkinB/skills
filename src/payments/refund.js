export function refundCharge(gateway, charge, requestedAmount) {
  if (requestedAmount > charge.amount) {
    throw new Error('refund amount exceeds the original charge');
  }
  gateway.refund(charge.id, requestedAmount);
  return { refunded: true };
}
