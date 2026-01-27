# Balance Sheet - Expense Tracker

Flask-based expense tracking app with smart auto-categorization and analytics.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Flask + Flask-SQLAlchemy |
| Database | SQLite |
| Frontend | Bootstrap 5 + Chart.js |
| Theme | Xero-inspired dark mode |

## Quick Start

```bash
pip install -r requirements.txt
python app.py
# Opens at http://127.0.0.1:8080
```

## Documentation

| Doc | Description |
|-----|-------------|
| [Project Setup](./docs/project-setup.md) | Full setup guide for replicating this stack |
| [Documentation Template](./docs/documentation-template.md) | How to create docs for new projects |
| [Smart Categorization](./docs/smart-categorization.md) | Auto-categorize by keywords, essential vs optional |
| [Expense Tracking](./docs/expense-tracking.md) | CRUD operations, tags, recurring detection |
| [Analytics](./docs/analytics.md) | Statistics API, category breakdown, trends |
| [CSV Import](./docs/csv-import.md) | Bank statement parsing, date formats |
| [Frontend](./docs/frontend.md) | Bootstrap UI, Chart.js charts, dark theme |
| [Database](./docs/database.md) | SQLAlchemy models, SQLite schema |

## Project Structure

```
balance-sheet/
  app.py              # Flask app, routes, models, categorization (362 lines)
  requirements.txt    # Dependencies
  templates/
    index.html        # Single-page app template (209 lines)
  static/
    css/style.css     # Xero dark theme (166 lines)
    js/app.js         # API calls, Chart.js (228 lines)
  instance/
    expenses.db       # SQLite database (auto-created)
```

## Key Features

- **Smart Categorization**: 9 categories with keyword matching
- **Essential vs Optional**: Classify spending types automatically
- **Recurring Detection**: Auto-tags subscriptions (Netflix, Spotify, etc.)
- **CSV Import**: Bulk import from bank statements
- **Multi-Period Stats**: Month, year, all-time analytics
- **12-Month Trends**: Visual spending history
- **Tag System**: Many-to-many tagging

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Main page |
| `/api/expenses` | GET | List all expenses |
| `/api/expenses` | POST | Create expense |
| `/api/expenses/<id>` | DELETE | Delete expense |
| `/api/categories` | GET | List categories |
| `/api/statistics` | GET | Analytics with ?period= |
| `/api/import-csv` | POST | Bulk CSV import |

## Categories

| Category | Color | Essential |
|----------|-------|-----------|
| Food & Dining | Red | Conditional |
| Transportation | Blue | Conditional |
| Healthcare | Orange | Yes |
| Pet Care | Pink | Yes |
| Kids & Education | Yellow | Yes |
| Bills & Utilities | Teal | Yes |
| Subscriptions | Cyan | No |
| Shopping | Purple | No |
| Entertainment | Orange | No |
| Other | Gray | No |

## Database Models

- **Category**: id, name, color
- **Tag**: id, name
- **Expense**: id, description, amount, date, category_id, is_recurring, is_essential, notes, tags
- **expense_tags**: Junction table for many-to-many
