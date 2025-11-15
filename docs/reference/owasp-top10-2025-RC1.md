# OWASP Top 10:2025 — Developer Cheat Sheet

A practical reference for engineers implementing secure software based on the
OWASP Top 10:2025 list.

---

## A01 — Broken Access Control

**What it is:** Users can act outside their privileges.

**Common failures**

- Missing “deny by default”
- URL/parameter tampering
- Insecure Direct Object References (IDORs)
- Missing authz on API actions (POST/PUT/DELETE)
- Privilege escalation
- JWT/cookie manipulation
- CORS misconfiguration
- Forced browsing of privileged URLs

**What to do**

- Enforce authorization _server-side only_
- Default-deny everything except public assets
- Reuse centralized authz middleware/policies
- Enforce record ownership (`owner_id == session.user_id`)
- Disable directory listing; remove `.git` & backups
- Log and rate-limit auth failures
- Invalidate sessions on logout; keep JWTs short-lived
- Add automated authz tests (unit + integration)

---

## A02 — Security Misconfiguration

**What it is:** Insecure defaults, debug settings, unnecessary services.

**What to do**

- Disable debug in production
- Remove unused services/endpoints
- Restrict admin interfaces
- Enforce secure headers (CSP, HSTS, COEP, CORP)
- Use least-privilege IAM roles
- Harden container/k8s configs
- Automate IaC security scans

---

## A03 — Software Supply Chain Failures

**What it is:** Compromised dependencies, pipelines, or build artifacts.

**What to do**

- Pin dependency versions
- Use trusted registries + signature verification (Sigstore/Cosign)
- Continuously run SCA (Software Composition Analysis)
- Protect CI/CD secrets and runners
- Require code signing for releases
- Avoid untrusted plugins/templates

---

## A04 — Cryptographic Failures

**What it is:** Incorrect or missing encryption.

**What to do**

- Enforce HTTPS/TLS everywhere
- Use vetted crypto libraries (no custom crypto)
- Encrypt sensitive data at rest (AES-256)
- Don’t use outdated hashing/ciphers
- Rotate keys regularly; use KMS/HSM
- Hash passwords with bcrypt/scrypt/Argon2

---

## A05 — Injection

**What it is:** Untrusted input reaches interpreters.

**What to do**

- Always use parameterized queries
- Avoid string-building for queries
- Validate and sanitize input
- Escape output based on context
- Prefer ORM query builders
- Disable eval-like functions

---

## A06 — Insecure Design

**What it is:** Architectural flaws and missing controls.

**What to do**

- Do threat modeling early
- Define + enforce business rules at the domain layer
- Enforce approval flows for risky actions
- Include rate limits and auditability in design
- Avoid client-side enforcement of business logic
- Document abuse cases and test them

---

## A07 — Authentication Failures

**What it is:** Weak or flawed authentication systems.

**What to do**

- Use secure frameworks (OAuth2/OIDC)
- Enforce MFA for sensitive operations
- Store password hashes only (bcrypt/Argon2)
- Use secure cookies (HttpOnly, Secure, SameSite)
- Regenerate session IDs on login
- Rate-limit login attempts

---

## A08 — Software or Data Integrity Failures

**What it is:** Trusting code/data without validation.

**What to do**

- Validate external sources and configs
- Sign updates and artifacts
- Avoid unsafe deserialization (prefer JSON)
- Validate configuration before applying
- Isolate modules processing untrusted data
- Never auto-execute downloaded code/templates

---

## A09 — Logging and Alerting Failures

**What it is:** Missing/insufficient logs or alerts.

**What to do**

- Log failures of auth and authorization
- Log admin/config changes
- Include timestamps, user IDs, request IDs
- Centralize logs (SIEM)
- Alert on repeated suspicious activity
- Don’t log sensitive data

---

## A10 — Mishandling of Exceptional Conditions

**What it is:** Unsafe behavior when errors occur.

**What to do**

- Don’t leak internal errors/stack traces
- Handle backend timeouts safely
- Always run authz checks even during degradation
- Validate inputs in fallback paths
- Use resilience patterns (circuit breakers, throttling)
- Ensure errors never bypass business logic

---

## Quick Testing Matrix

| Category | What to Test                                              |
| -------- | --------------------------------------------------------- |
| A01      | Privilege checks, IDORs, JWT tampering, forced browsing   |
| A02      | Debug flags, admin interfaces, headers, container configs |
| A03      | Package integrity, pipeline tampering, unpinned           |
