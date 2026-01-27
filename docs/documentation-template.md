# Documentation Template

Use this guide to set up the same documentation structure for any new project.

## Folder Structure

```
project-name/
  CLAUDE.md              # High-level summary with links to all docs
  docs/
    project-setup.md     # How to replicate this stack from scratch
    [feature-1].md       # One doc per major feature/subsystem
    [feature-2].md
    ...
```

## CLAUDE.md Structure

This is the entry point. Keep it scannable.

```markdown
# Project Name

One-line description.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | ... |
| Database | ... |
| UI | ... |

## Quick Start

\`\`\`bash
npm install  # or pip install
npm run dev  # or python app.py
\`\`\`

## Environment Variables

\`\`\`env
VAR_NAME=value
\`\`\`

## Documentation

| Doc | Description |
|-----|-------------|
| [Project Setup](./docs/project-setup.md) | Setup guide for new projects |
| [Feature 1](./docs/feature-1.md) | What it does |
| [Feature 2](./docs/feature-2.md) | What it does |

## Project Structure

\`\`\`
src/
  app/
  components/
  lib/
\`\`\`

## Key Files

| File | Purpose |
|------|---------|
| `path/to/file.ts` | What it does |
```

## project-setup.md Structure

This doc should let Claude replicate the entire stack. Include:

1. **Initialize command** - `npx create-next-app` or `mkdir + pip install`
2. **All dependencies** - Exact package names, grouped by purpose
3. **Boilerplate code** - Complete, copyable files for:
   - Configuration files (tailwind.config, next.config, etc.)
   - Core setup files (auth clients, providers, database models)
   - Utility functions
4. **Environment variables** - What's needed
5. **Project structure** - Recommended folder layout

### Example Sections

```markdown
## 1. Initialize Project
\`\`\`bash
npx create-next-app@latest project-name --typescript
\`\`\`

## 2. Install Dependencies
\`\`\`bash
npm install package-a package-b package-c
\`\`\`

## 3. Create Configuration File
### `config-file.ts`
\`\`\`typescript
// Complete, copyable code here
\`\`\`

## 4. Environment Variables
\`\`\`env
VAR_NAME=description
\`\`\`
```

## Feature Doc Structure

Each feature/subsystem gets its own doc. Include:

1. **Overview** - What it does in 2-3 sentences
2. **Key Files** - Table of files involved
3. **How It Works** - Architecture explanation
4. **Code Examples** - Key functions/patterns
5. **API/Endpoints** - If applicable
6. **Database Tables** - If applicable

### Template

```markdown
# Feature Name

Brief description.

## Overview

What this feature does and why.

## Key Files

| File | Purpose |
|------|---------|
| `path/file.ts` | Does X |

## How It Works

Architecture explanation with flow:
1. Step one
2. Step two
3. Step three

## Code Examples

\`\`\`typescript
// Key function or pattern
\`\`\`

## API Endpoints (if applicable)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/x` | GET | Does Y |

## Database Tables (if applicable)

\`\`\`sql
table_name (
  id,
  field_1,
  field_2
)
\`\`\`
```

## How to Document a New Project

1. **Create the structure**
   ```bash
   mkdir docs
   touch CLAUDE.md
   touch docs/project-setup.md
   ```

2. **Identify subsystems** - List major features/areas:
   - Authentication
   - Data models/database
   - Core business logic
   - UI/Frontend
   - Integrations (APIs, third-party services)

3. **Create one doc per subsystem**
   ```bash
   touch docs/authentication.md
   touch docs/database.md
   # etc.
   ```

4. **Write project-setup.md first** - This forces you to document the full stack

5. **Write CLAUDE.md last** - Summarize and link to all docs

## Naming Conventions

- Use kebab-case: `feature-name.md`
- Be descriptive: `smart-categorization.md` not `categorize.md`
- Group related features: `habits-pomodoro.md` for related features

## What Makes Good Documentation

- **Copyable code** - Complete snippets, not fragments
- **File paths** - Always include where code lives
- **Tables** - For lists of files, endpoints, fields
- **Code blocks** - For all code, commands, configs
- **Brief explanations** - Architecture, not tutorials

## When to Reference These Docs

Tell Claude:
> "Reference `project-name/docs/project-setup.md` to set up this new project with the same stack"

Or:
> "Set up authentication like in `project-name/docs/authentication.md`"

Or:
> "Create documentation for this project following the template in `project-name/docs/documentation-template.md`"
