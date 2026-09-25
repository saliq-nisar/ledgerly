// app/api/checkout/route.ts
// #region route
import { createCheckoutHandler } from "../../src/adapters/web.js";
import { payments } from "./payments.js";

// Browser: POST { productId: "pro", quantity: 1 } → { id, url } → window.location.assign(url)
export const POST = createCheckoutHandler(payments);
// #endregion route
