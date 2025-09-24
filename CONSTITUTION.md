<!--
Sync Impact Report:
- Version change: 1.0.0 → 1.1.0
- Structure reorganized for clarity, consolidating principles without content loss
- No principles modified, added, or removed - content preserved
- Templates requiring updates: ✅ all checked and compatible
- Follow-up TODOs: None
-->

# CTRL FreaQ Development Constitution

## Core Principles

### I. Library-First Architecture

Every feature begins as a standalone library with clear boundaries and
responsibilities. Libraries must be:

- Self-contained with minimal external dependencies
- Independently testable and documented
- Purpose-driven with explicit functionality scope
- Reusable across different contexts and projects

No organizational-only libraries—each must solve a concrete problem.

### II. CLI Interface Standard

Every library (excluding frontend components) exposes core functionality through
a command-line interface following strict protocols:

- **Input**: Command-line arguments and/or stdin
- **Output**: Results to stdout, errors to stderr
- **Formats**: Support both JSON and human-readable output
- **Behavior**: Consistent flag patterns and error codes

Text-based I/O ensures debuggability and composability.

### III. Test-First Development (NON-NEGOTIABLE)

Test-driven development is mandatory and strictly enforced:

1. **Tests written first** → User/stakeholder approval → Tests fail →
   Implementation
2. **Red-Green-Refactor cycle** must be followed without exception
3. **Test coverage** must include edge cases and error conditions
4. **Test isolation** ensures independent, repeatable execution

No implementation without failing tests that define the requirements.

#### Test File Organization (NON-NEGOTIABLE)

1. **Unit Tests**
   - File convention: `*.test.ts(x)` or `*.spec.ts(x)`
   - Location: colocated with the source file they cover (same folder).
     `__tests__` directories are forbidden.

2. **Integration Tests**
   - File convention: `*.test.ts(x)`
   - Location: package/app-level `tests/integration/` directories only. Source
     trees must remain free of integration specs.

3. **Contract Tests**
   - File convention: `*.contract.test.ts`
   - Location: `tests/contracts/` alongside the owning package/app. Every
     OpenAPI or contract file must have a sibling contract test here.

4. **End-to-End (Playwright) Tests**
   - File conventions: `*.e2e.ts` for functional flows, `*.visual.ts` for visual
     regressions.
   - Location: `tests/e2e/` exclusively; no other path may contain Playwright
     suites.

5. **Performance & Specialized Suites**
   - File convention: `*.performance.test.ts` (or analogous suffix).
   - Location: dedicated subfolders under `tests/` such as `tests/performance/`.
     Do not mix with unit or integration suites.

6. **Shared Fixtures & Utilities**
   - Location: package-level `src/testing/fixtures` (or app-level
     `tests/fixtures`). Tests must import shared fixtures via documented path
     aliases; ad hoc fixture folders are prohibited.

### IV. Integration Testing & Observability

Integration tests are required for specific change categories:

- New library public APIs and contracts
- Changes to existing library interfaces
- Inter-service or cross-system communication
- Shared data schemas and protocols
- Real dependency interactions (no mocking for integration layer)

All systems must provide comprehensive observability through:

- **Structured logging** with consistent formats and levels
- **Multi-tier log streaming** for real-time and historical analysis
- **Performance metrics** collection and monitoring
- **Error tracking** with context and stack traces
- **Health checks** and service status endpoints

### V. Simplicity & Versioning

Complexity must be justified and minimized:

- **YAGNI principle**: Implement only current requirements
- **Prefer composition** over inheritance and complex abstractions
- **Limit project scope** to essential functionality
- **Remove unused code** and dependencies regularly
- **Question every dependency** and abstraction layer

Start simple, evolve incrementally based on real needs.

Versioning & Breaking Changes: Does NOT apply during MVP.

## SOC 2 Implementation Rules for LLM Code Generation

### Authentication & Authorization Rules

#### Rule 1: All endpoints must verify authentication

- Check for valid JWT/session token before processing any request
- Return 401 Unauthorized if token is missing or invalid
- Include token expiration checks

#### Rule 2: Implement role-based access control (RBAC)

- Define user roles in database schema (e.g., admin, user, viewer)
- Check user permissions before executing any data operation
- Return 403 Forbidden for unauthorized access attempts
- Use least-privilege principle: default to no access

#### Rule 3: Support multi-factor authentication hooks

- Add 'mfa_enabled' and 'mfa_secret' fields to user schema
- Include 'requires_mfa' flag in authentication responses
- Implement token refresh mechanism with shorter expiry for non-MFA sessions

### Logging Requirements

#### Rule 4: Log all authentication events

- Successful login: timestamp, user_id, ip_address, user_agent
- Failed login: timestamp, attempted_username, ip_address, reason
- Logout: timestamp, user_id, session_duration
- Token refresh: timestamp, user_id, old_token_id, new_token_id

#### Rule 5: Log all data access and modifications

- CREATE: timestamp, user_id, resource_type, resource_id, new_values
- READ: timestamp, user_id, resource_type, resource_id, fields_accessed
- UPDATE: timestamp, user_id, resource_type, resource_id, old_values, new_values
- DELETE: timestamp, user_id, resource_type, resource_id, deleted_values

#### Rule 6: Log all authorization failures

- timestamp, user_id, attempted_action, resource_type, resource_id,
  required_permission, user_permission

#### Rule 7: Log administrative and configuration changes

- User role changes: timestamp, admin_id, target_user_id, old_role, new_role
- System settings: timestamp, admin_id, setting_name, old_value, new_value
- Permission changes: timestamp, admin_id, resource, old_permissions,
  new_permissions

#### Rule 8: Use structured JSON logging

```json
{
  "timestamp": "ISO-8601",
  "level": "INFO|WARN|ERROR",
  "event_type": "auth|data_access|admin_action|system",
  "user_id": "uuid",
  "session_id": "uuid",
  "ip_address": "string",
  "action": "string",
  "resource": "string",
  "result": "success|failure",
  "metadata": {}
}
```

### Data Protection Rules

#### Rule 9: Encrypt sensitive data at rest

- Use field-level encryption for PII (SSN, credit cards, health data)
- Apply database-level encryption for all tables
- Never store passwords in plaintext - use bcrypt/scrypt/argon2
- Encryption key references should be stored, not the keys themselves

#### Rule 10: Enforce HTTPS/TLS for all communications

- Reject non-HTTPS requests in production
- Use TLS 1.2 minimum for all connections
- Include HSTS headers in responses
- Validate SSL certificates for third-party API calls

#### Rule 11: Implement secure session management

- Generate cryptographically secure session tokens (min 128 bits)
- Set secure cookie flags: Secure, HttpOnly, SameSite
- Implement session timeout (default: 30 minutes inactive)
- Invalidate sessions on logout and password change

### Input Validation & Error Handling

#### Rule 12: Validate and sanitize all inputs

- Parameterize all database queries (prevent SQL injection)
- HTML-encode user content before display (prevent XSS)
- Validate data types, lengths, and formats
- Reject requests with unexpected fields

#### Rule 13: Implement safe error handling

- Never expose stack traces to users
- Log detailed errors server-side with unique error IDs
- Return generic error messages to clients
- Include error_id in user-facing messages for support correlation

### Database Schema Requirements

#### Rule 14: Include audit fields in all tables

```sql
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
created_by UUID NOT NULL REFERENCES users(id),
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_by UUID NOT NULL REFERENCES users(id),
deleted_at TIMESTAMP NULL,  -- for soft deletes
deleted_by UUID NULL REFERENCES users(id)
```

#### Rule 15: Implement soft deletes for audit trail

- Add 'deleted_at' timestamp field instead of hard DELETE
- Filter soft-deleted records in normal queries
- Retain deleted records for audit purposes

### API Design Rules

#### Rule 16: Version all APIs

- Include version in URL path (/api/v1/) or header
- Never break existing API contracts
- Deprecate old versions with advance notice

#### Rule 17: Implement rate limiting

- Track requests per user/IP
- Return 429 Too Many Requests when exceeded
- Include rate limit headers in responses
- Log rate limit violations

#### Rule 18: Add request IDs for traceability

- Generate unique request_id for each API call
- Include request_id in all log entries
- Return request_id in response headers
- Pass request_id to downstream services

### Third-Party Integration Rules

#### Rule 19: Secure credential storage

- Never hardcode credentials in source code
- Use environment variables or secret management services
- Rotate API keys regularly
- Log credential usage but never log the credentials themselves

#### Rule 20: Validate third-party responses

- Verify SSL certificates
- Validate response schemas
- Implement timeout and retry logic
- Log all third-party API interactions

### Implementation Checklist for Each Feature

When implementing any feature, ensure:

1. **Authentication**: User is authenticated before accessing the feature
2. **Authorization**: User has permission to perform the requested action
3. **Logging**: All actions are logged with sufficient detail
4. **Encryption**: Sensitive data is encrypted in transit and at rest
5. **Input Validation**: All inputs are validated and sanitized
6. **Error Handling**: Errors are logged server-side, generic messages sent to
   client
7. **Audit Trail**: Database changes include who/when information
8. **Rate Limiting**: API endpoints have appropriate rate limits
9. **Request Tracking**: Each request has a unique ID for tracing
10. **Testing**: Security tests are included (auth failures, invalid inputs,
    rate limits)

## Development Standards

### Code Quality Requirements

- All code must pass static analysis and linting
- All code must comply with any defined Coding Standards
- Code reviews required for all changes with at least one approval
- Documentation updated with code changes
- Performance regression testing for critical paths
- Security scanning for vulnerabilities and exposed secrets

### Architecture Guidelines

- Loose coupling between components and services
- Clear separation of concerns and responsibilities
- Immutable data structures where possible
- Fail-fast error handling with meaningful messages
- Graceful degradation for non-critical failures

## Governance

### Constitution Authority

This constitution supersedes all other development practices and guidelines. All
project decisions must align with these principles.

### Amendment Process

Constitution changes require:

1. **Documentation** of proposed changes with rationale
2. **Stakeholder approval** through formal review process
3. **Migration plan** for existing code and practices
4. **Template updates** to maintain consistency across documentation

### Compliance Verification

- All pull requests must demonstrate compliance with applicable principles
- Code reviews must verify adherence to constitutional requirements
- Complexity introduced must be explicitly justified against simplicity
  principle
- Regular audits to ensure ongoing compliance

### Quality Controls Protection

- Compliance with this Constitution and all quality-control configurations is
  mandatory for every change.
- Modifying quality-control configuration files is prohibited unless it is the
  explicit, primary intent of the change and clearly stated by the author. This
  includes (non‑exhaustive): `eslint.config.*`, `.eslintrc*`,
  `prettier.config.*`, `.prettierrc*`, `.editorconfig`, `tsconfig*.json`,
  `turbo.json`, `.github/workflows/**`, `.yamllint*`, `.husky/**`, and
  `lint-staged` settings in `package.json`.
- When such changes are intended, they must:
  - Be isolated to a dedicated PR with rationale in the title and description,
  - Update related documentation and CI as needed,
  - Preserve or strengthen quality gates (lint, typecheck, tests, coverage).
    Weakening gates is not allowed.
- Any attempt to bypass or weaken quality controls is a violation and must be
  rejected during review.

**Version**: 1.1.0 | **Ratified**: 2025-09-11 | **Last Amended**: 2025-09-20
