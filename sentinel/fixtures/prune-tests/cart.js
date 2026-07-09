// Code under test for the prune-tests fixture.
// `tax` is an INTERNAL collaborator (an in-repo module), cheap to use for real.

class CartTotal {
  constructor(tax) {
    this.tax = tax;
  }

  total(items) {
    return items.reduce((sum, item) => sum + item.price, 0); // returns a number
  }

  withTax(amount) {
    return amount * (1 + this.tax.rate());
  }
}

module.exports = { CartTotal };
