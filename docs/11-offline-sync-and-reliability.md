# Offline sync and reliability

## Client
Use a PWA with IndexedDB for queued updates and photos. Use Background Sync where supported, plus foreground retry when the app is reopened or connectivity returns.

## Queue states
DRAFT, QUEUED, SYNCING, SYNCED, RETRY_WAIT, NEEDS_USER_ACTION.

## Idempotency
Generate a unique idempotency key per logical submission. The server stores the key with the accepted update. Repeated retries return the original result rather than creating duplicates.

## Important rules
- Never show an update as synced until the server confirms acceptance.
- Keep client event time and server receipt time.
- Make retry safe and bounded with backoff.
- Surface validation conflicts for user action.
- Protect locally queued data on shared devices and clear it on logout according to the security policy.
