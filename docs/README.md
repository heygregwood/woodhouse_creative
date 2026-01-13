# Woodhouse Creative Documentation

**Last Updated:** January 13, 2026

---

## Documentation Structure

```
docs/
├── engineering/     # Technical implementation details
├── product/         # Features and workflows
├── playbook/        # Day-to-day operations
└── archive/         # Historical/completed plans
```

---

## Quick Navigation

| Need to... | Go to |
|------------|-------|
| Understand the codebase | [CLAUDE.md](../CLAUDE.md) |
| Query Firestore | [playbook/QUICK_COMMANDS.md](playbook/QUICK_COMMANDS.md) |
| Send dealer emails | [product/EMAIL_AUTOMATION.md](product/EMAIL_AUTOMATION.md) |
| Approve new dealers | [product/ADMIN_DASHBOARD.md](product/ADMIN_DASHBOARD.md) |
| Fix common issues | [playbook/TROUBLESHOOTING.md](playbook/TROUBLESHOOTING.md) |
| Understand API endpoints | [engineering/API_REFERENCE.md](engineering/API_REFERENCE.md) |
| Check data schema | [engineering/DATA_MODEL.md](engineering/DATA_MODEL.md) |

---

## Engineering Documentation

Technical implementation details for developers.

| Document | Purpose |
|----------|---------|
| [DATA_MODEL.md](engineering/DATA_MODEL.md) | Firestore schema, SQLite reference, field definitions |
| [API_REFERENCE.md](engineering/API_REFERENCE.md) | All 28 API endpoints with request/response formats |
| [TYPESCRIPT_MODULES.md](engineering/TYPESCRIPT_MODULES.md) | lib/*.ts modules documentation |
| [PYTHON_SCRIPTS.md](engineering/PYTHON_SCRIPTS.md) | CLI scripts (local fallbacks) |
| [EXCEL_SYNC_REFERENCE.md](engineering/EXCEL_SYNC_REFERENCE.md) | Excel column mapping |
| [DEALER_NAMES.md](engineering/DEALER_NAMES.md) | Naming conventions |
| [MIGRATION_HISTORY.md](engineering/MIGRATION_HISTORY.md) | SQLite → Firestore migration |

---

## Product Documentation

Features, workflows, and how things work.

| Document | Purpose |
|----------|---------|
| [ADMIN_DASHBOARD.md](product/ADMIN_DASHBOARD.md) | Dashboard pages and features |
| [DEALER_LIFECYCLE.md](product/DEALER_LIFECYCLE.md) | CONTENT → FULL → REMOVED states |
| [RENDER_PIPELINE.md](product/RENDER_PIPELINE.md) | Video rendering workflow |
| [EMAIL_AUTOMATION.md](product/EMAIL_AUTOMATION.md) | 6 email types and triggers |
| [SPREADSHEET_SYSTEM.md](product/SPREADSHEET_SYSTEM.md) | Google Sheets structure and workflow |

---

## Playbook Documentation

Day-to-day operations and quick reference.

| Document | Purpose |
|----------|---------|
| [QUICK_COMMANDS.md](playbook/QUICK_COMMANDS.md) | Common commands for daily use |
| [DEVELOPMENT_WORKFLOW.md](playbook/DEVELOPMENT_WORKFLOW.md) | Local → Preview → Production |
| [TROUBLESHOOTING.md](playbook/TROUBLESHOOTING.md) | Common issues and fixes |
| [COMPLIANCE_GUIDE.md](playbook/COMPLIANCE_GUIDE.md) | Allied Air compliance |
| [COMPLIANCE_WOODHOUSE.md](playbook/COMPLIANCE_WOODHOUSE.md) | Project-specific rules |

---

## Archive

Historical documents and completed plans.

| Document | Status |
|----------|--------|
| [DEALER_ONBOARDING_AUTOMATION_PLAN.md](archive/DEALER_ONBOARDING_AUTOMATION_PLAN.md) | Completed Jan 2026 |
| [END_TO_END_DOCUMENTATION_DRAFT.md](archive/END_TO_END_DOCUMENTATION_DRAFT.md) | Historical reference |
| [WORKFLOW_CURRENT.md](archive/WORKFLOW_CURRENT.md) | Manual process (pre-automation) |
| [DOCUMENTATION_IMPROVEMENT_PLAN.md](archive/DOCUMENTATION_IMPROVEMENT_PLAN.md) | Completed Jan 2026 |

---

## Getting Started

**New to the project?** Read in this order:

1. [CLAUDE.md](../CLAUDE.md) - Development workflow and mandatory rules
2. [engineering/DATA_MODEL.md](engineering/DATA_MODEL.md) - Data structure
3. [product/DEALER_LIFECYCLE.md](product/DEALER_LIFECYCLE.md) - How dealers work
4. [playbook/QUICK_COMMANDS.md](playbook/QUICK_COMMANDS.md) - Common operations

---

## Documentation Standards

All docs follow these standards:

1. **Last Updated date** at top of each doc
2. **Code references** with file paths: `lib/firebase.ts:30`
3. **Related documentation** links at bottom
4. **CHANGELOG.md updates** for data structure changes

---

## Contributing

Before updating documentation:

1. Read [CLAUDE.md](../CLAUDE.md) - Documentation Updates section
2. Follow 3-step workflow: Read code → Read docs → Compare
3. Add/update Last Updated date
4. Update [CHANGELOG.md](../CHANGELOG.md)
