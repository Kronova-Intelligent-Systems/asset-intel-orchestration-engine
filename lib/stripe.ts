import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables.")
}

// Validate that we're using a secret key, not a publishable key
if (process.env.STRIPE_SECRET_KEY.startsWith("pk_")) {
  throw new Error(
    "STRIPE_SECRET_KEY contains a publishable key (pk_...). " +
      "Please use a secret key (sk_...) instead. " +
      "You can find your secret key at https://dashboard.stripe.com/apikeys",
  )
}

// No explicit apiVersion: the SDK pins every request to the API version its types were generated for
// (see node_modules/stripe/VERSION), so runtime responses always match the TypeScript types.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
  appInfo: { name: "kronova-asset-intel-orchestration-engine" },
})
