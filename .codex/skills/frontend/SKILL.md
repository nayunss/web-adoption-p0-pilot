---
name: frontend
description: Apply the project frontend quality contract. Use when implementing or reviewing user-facing web interfaces, accessibility, responsive behavior, and frontend tests.
---

# Frontend

1. Read the canonical engineering, security, code-quality, and accessibility contracts.
2. Detect the project stack; do not install or replace tools without approval.
3. Preserve semantic HTML, keyboard access, visible focus, readable contrast, and responsive layout.
4. Run the project-approved formatter, linter, typecheck, tests, and accessibility checks.
5. Report checks that require a real browser or downstream environment as `NOT-RUN`.

Do not weaken common gates or expose internal diagnostics to users.
