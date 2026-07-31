// Code under test for the prune-tests --audit-evidence fixture (#192).
// `gateway` is an EXTERNAL collaborator (a third-party payment API) — mocking it is
// correct per Step 6, so neither test below is an over-mocking finding. The debt is
// in what each test actually asserts once the mock is set up.

function processPayment(gateway, { amount }) {
  return gateway.charge(amount);
}

function applyDiscount(total, code) {
  return code === 'SAVE10' ? total * 0.9 : total;
}

module.exports = { processPayment, applyDiscount };
