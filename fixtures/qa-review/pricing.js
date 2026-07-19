// KNOWN-BAD INPUT for /qa-review
// A pricing helper that is functionally plausible but riddled with testability
// smells. Run `/qa-review fixtures/qa-review/pricing.js`.

const API_URL = 'https://api.prod.example.com/pricing'; // hard-coded prod URL, no injection

async function quotePrice(userId, basePrice) {
  // Non-deterministic: the "flash sale" window depends on the wall clock.
  const hour = new Date().getHours();
  const flashSale = hour >= 0 && hour < 1;

  // Non-deterministic: random promo eligibility, unseeded.
  const luckyPromo = Math.random() < 0.1;

  // Hard-coded external dependency created inline — nothing to mock/inject.
  const res = await fetch(`${API_URL}?user=${userId}`);
  const body = await res.text();

  // Fragile string matching against an external error message.
  if (body.includes('rate limit exceeded')) {
    console.log('pricing API throttled for ' + userId); // side effect, hard to observe
    setTimeout(() => quotePrice(userId, basePrice), 3000); // uncontrolled timer
    return basePrice;
  }

  // Assumes response shape with no null/parse guard.
  const surcharge = JSON.parse(body).surcharge;

  let price = basePrice + surcharge;
  if (flashSale) price *= 0.5;
  if (luckyPromo) price *= 0.9;
  return price;
}

module.exports = { quotePrice };
