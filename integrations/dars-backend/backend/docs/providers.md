# Integration contracts

The default backend needs only PostgreSQL. Payments and private videos are disabled; avatar storage uses PostgreSQL. The interfaces below are trusted, operator-supplied server modules. They are never loaded from request input. Do not enable an adapter merely by naming a provider; startup requires the configured module and applicable credentials.

## Payments: future Click and Payme

Set `PAYMENT_PROVIDER=click`, `payme`, or `custom`, `PAYMENT_ADAPTER_MODULE`, and `PAYMENT_WEBHOOK_SECRET` only after implementing the chosen provider's current, official sandbox protocol. Both Click and Payme require provider-specific request authentication and lifecycle handling. This repository does not invent their protocol, credentials, request signatures, or settlement behavior. No adapter for either service is represented as complete.

Export `async function createPaymentAdapter({ config })` returning:

```js
{
  async createCheckout({ order, idempotencyKey }) {
    // order = { id, total: '80000.05', currency: 'UZS' }
    // Create/retrieve a checkout in the provider sandbox using order.id for correlation.
    // Return safe client fields, e.g. { checkoutUrl, expiresAt }; never credentials.
  },
  async verifyWebhook({ rawBody, headers }) {
    // rawBody is a Buffer containing the exact HTTP body.
    // Verify the provider's documented signature/authentication, merchant identity,
    // event status, timestamp/replay policy, and provider transaction correlation.
    // Only a confirmed successful transaction may produce the following:
    return {
      verified: true,
      event: {
        provider: config.PAYMENT_PROVIDER,
        providerPaymentId: 'unique-provider-transaction-id',
        orderId: 'UUID',
        amount: '80000.05',
        currency: 'UZS',
        status: 'SUCCEEDED',
      },
    };
  },
}
```

This is an interface description, not executable verification code. Convert provider minor-unit amounts using exact decimal/integer arithmetic. Never infer success from a browser redirect or client body. Adapter verification failure must reject the request or return verified=false. The domain service independently validates the normalized event, provider, exact amount/currency, pending state, and duplicate transaction ID before an atomic transaction creates enrollments. It acknowledges repeated matching events without duplicate effects.

The generic route is `POST /api/v1/payments/webhook/:provider` and currently returns the standard JSON success/error contract. A real Click/Payme implementation may require provider-specific acknowledgement bodies, authentication challenges, RPC methods, preliminary transaction state, cancellation, status checks, refunds, or signature fields. Add those routes/state mappings alongside this verified-fulfillment boundary before going live; this generic success-event interface alone is not a complete implementation of either provider. Test documented sandbox requests, duplicate delivery, conflicting IDs, amount mismatch, and late callbacks before enabling production checkout. Late success after cancellation returns a conflict for operator reconciliation, never silent enrollment.

## Persistent avatar storage

Default `STORAGE_PROVIDER=database` stores small, processed avatars in PostgreSQL. There is no local-filesystem production storage dependency. For an external object store export `async function createStorageAdapter({ config })` with:

```js
{
  async putAvatar({ userId, bytes, contentType }) {
    // bytes have already been decoded, bounded, metadata-stripped, and re-encoded.
    // Generate an unguessable object key; do not use uploaded filenames.
    return { id: 'object-id', url: 'https://your-avatar-cdn.example/object-id.webp' };
  },
  async deleteAvatar({ id, url }) {
    // Idempotently delete a failed upload by the adapter-owned identifier.
  },
}
```

Use provider-managed credentials and persistent storage. Restrict returned URLs to your own avatar host within the adapter. The backend cleans up a new object if the profile transaction fails. For custom storage, configure lifecycle cleanup of superseded avatars; the generic backend does not delete arbitrary previous URLs. The database adapter removes superseded rows transactionally.

## Private video

Export `async function createVideoAdapter({ config })` returning:

```js
{
  async createPlayback({ assetId, lessonId, userId, sessionId }) {
    // Authorization and course/lesson membership are checked before this call.
    // Return a short-lived signed private URL or provider-controlled playback token.
    return { url: 'https://private-playback.example/signed-resource',
      expiresAt: new Date(Date.now() + 120000).toISOString(), type: 'application/x-mpegURL' };
  },
}
```

Asset IDs are private opaque identifiers. The adapter must enforce short expiry and private access at the storage/player provider; never return an unsigned permanent storage URL. Provider-controlled playback may add its own token fields if the React player needs them. The core API strips asset identifiers from all public and student metadata responses. Production rejects the signed-local development adapter. Implement CORS, segment authorization, and seek/range behavior according to the chosen streaming provider's documentation.

The injected test adapter exists only inside `tests/integration.test.js`. It proves that successful normalized events trigger transactional fulfillment; it does not verify any real provider protocol and cannot be selected by environment configuration.
