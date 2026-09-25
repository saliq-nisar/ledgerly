// Resolved via the "browser" export condition. Importing the payment library
// from client-side code is always a mistake: it would ship Stripe secret-key
// handling to the browser. Fail loudly instead.
throw new Error(
  "@ledgerly/payments is server-only and cannot be imported in browser code. " +
    "Call your own API route from the client instead.",
);
