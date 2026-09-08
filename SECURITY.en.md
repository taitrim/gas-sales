# Security Policy

**Language:** 🇻🇳 [Tiếng Việt](SECURITY.md) · 🇬🇧 English

## Reporting a vulnerability

If you discover a security issue, **do not open a public Issue**. Send it to the
maintainer via email / private message (or GitHub Private Vulnerability Reporting when
enabled).

Please include:

- The location of the issue (relevant file/endpoint) and a minimal way to reproduce it.
- The impact and a real-world exploit, if known.

We commit to:

- Responding within 72 hours.
- Not disclosing the issue to third parties before a fix is released.

## Scope

- `backend/src/**` — JWT authentication, authorization, SQL injection, upload/backup handling.
- Production configuration (`deploy/`, `backend/.env.example`).

For guidance on running the app securely, see the "security notes" section in
`deploy/windows-tunnel/README.md`.