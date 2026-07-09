// KNOWN-BAD INPUT for /prune-tests
// A suite carrying test debt: two redundant tests, one over-mock of an internal
// collaborator, one stale test whose name/comment contradict its assertion, and
// one genuine keeper. Run: `/prune-tests sentinel/fixtures/prune-tests/cart.spec.js`

const { CartTotal } = require('./cart');

// --- redundant pair: same behavior contract, near-identical example (expected-use class) ---
test('adds two items', () => {
  const cart = new CartTotal();
  expect(cart.total([{ price: 10 }, { price: 5 }])).toBe(15);
});

test('sums item prices', () => {
  const cart = new CartTotal();
  expect(cart.total([{ price: 10 }, { price: 5 }])).toBe(15);
});

// --- over-mocks an INTERNAL collaborator; verifies the mock, not the tax math ---
test('applies tax', () => {
  const tax = { rate: jest.fn().mockReturnValue(0.2) };
  const cart = new CartTotal(tax);

  cart.withTax(100);

  expect(tax.rate).toHaveBeenCalled(); // asserts the mock was called, not that 120 came out
});

// --- stale: name + Given/When/Then claim a string-cents contract the code no longer produces ---
test('returns cents as a formatted string', () => {
  const cart = new CartTotal();
  // Given a cart, When totalled, Then it returns a "$X.XX" string.
  // (The code returns a plain number; this assertion silently agrees with the code,
  //  so the name and comment are now lies.)
  expect(typeof cart.total([{ price: 1 }])).toBe('number');
});

// --- genuine keeper: real boundary condition ---
test('empty cart totals zero', () => {
  const cart = new CartTotal();
  expect(cart.total([])).toBe(0);
});
