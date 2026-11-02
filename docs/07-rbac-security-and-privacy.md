# RBAC, security, and privacy

## Authorization
- Merchandiser: manage orders/TNA, assign supervisors, review alerts, approve photos, reports, audit.
- Supervisor: access assigned work and submit production updates only.
- Buyer: read only their own milestones and approved photos.

Enforce authorization on the server for every object. UI hiding is not security.

## Security controls
HTTPS, Helmet, strict CORS, rate limits, request-size limits, Zod validation, safe error handling, parameterized database access, secure password hashing (Argon2id or bcrypt), refresh-token rotation, and protected upload validation.

Prefer HttpOnly, Secure, SameSite cookies for refresh tokens with appropriate CSRF protection. Avoid long-lived tokens in localStorage.

## Photos
Use private object storage. Validate MIME type, file signature, size, and ownership. Serve short-lived signed URLs only after authorization.

## Privacy
Minimize personal data. Use synthetic data for demos. Review AI-provider retention and data-use terms before sending factory notes.
