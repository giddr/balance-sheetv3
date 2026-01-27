# Balance Sheet - Expense Tracker

Flask-based expense tracking app with smart auto-categorization, analytics, and PDF export.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Flask + Flask-SQLAlchemy |
| Database | SQLite |
| Frontend | Bootstrap 5 + Chart.js |
| PDF Export | fpdf2 |
| Theme | Xero-inspired dark mode |

## Quick Start

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
# Opens at http://127.0.0.1:8080

# Login password (default): Sebastian0727Gold!
# Set via environment: APP_PASSWORD=yourpassword python app.py
```

## Project Structure

```
balance-sheet/
  app.py              # Flask app, routes, models, categorization (~1600 lines)
  requirements.txt    # Dependencies (Flask, SQLAlchemy, fpdf2, dateutil)
  templates/
    index.html        # Single-page app template (~600 lines)
    login.html        # Login page
  static/
    css/style.css     # Xero dark theme
    js/app.js         # API calls, Chart.js (~1640 lines)
  instance/
    expenses.db       # SQLite database (auto-created, NOT in git)
  venv/               # Python virtual environment (NOT in git)
```

## Key Features

### Core
- **Smart Categorization**: 17 categories with Melbourne-specific keyword matching
- **Essential vs Optional**: Classify spending types automatically
- **Recurring Detection**: Auto-tags subscriptions (Netflix, Spotify, etc.)
- **CSV Import**: Bulk import from bank statements (ANZ, CBA, NAB formats)
- **Multi-Period Stats**: Month, year, all-time analytics
- **12-Month Trends**: Visual spending history
- **Tag System**: Many-to-many tagging

### Advanced (Recovered Jan 2025)
- **PDF Export**: Professional reports with customizable sections
- **Duplicate Detection**: Find and remove duplicate transactions
- **Service Station Recategorization**: Auto-sort by amount ($40+ = fuel, <$40 = food)
- **Bulk Edit**: Change category/essential status for multiple transactions
- **Category Management**: Inline rename, color picker, add/delete categories
- **BPAY Matching**: Store biller codes for smart categorization

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/login` | GET/POST | Authentication |
| `/` | GET | Main page (requires login) |
| `/api/expenses` | GET | List all expenses |
| `/api/expenses` | POST | Create expense |
| `/api/expenses/<id>` | PUT | Update expense |
| `/api/expenses/<id>` | DELETE | Delete expense |
| `/api/categories` | GET | List categories |
| `/api/categories` | POST | Create category |
| `/api/categories/<id>` | PUT | Update category (name/color) |
| `/api/categories/<id>` | DELETE | Delete category |
| `/api/statistics` | GET | Analytics with ?period= |
| `/api/import-csv` | POST | Bulk CSV import |
| `/api/export/pdf` | POST | Generate PDF report |
| `/api/duplicates` | GET | Scan for duplicates |
| `/api/duplicates/remove` | DELETE | Remove selected duplicates |
| `/api/expenses/recategorize-service-stations` | POST | Auto-recategorize |
| `/api/expenses/bulk-update-category` | POST | Bulk category change |
| `/api/expenses/bulk-update-essential` | POST | Bulk essential toggle |
| `/api/cash-position` | GET/POST | Track cash runway |

## Categories (17 total)

| Category | Color | Essential |
|----------|-------|-----------|
| Food & Dining | Red | Conditional (groceries=yes, restaurants=no) |
| Transportation | Blue | Conditional (fuel=yes, uber=no) |
| Housing & Rent | Purple | Yes |
| Healthcare | Orange | Yes |
| Pet Care | Pink | Yes |
| Personal Care | Pink | Yes |
| Kids & Education | Yellow | Yes |
| Childcare & Education | Yellow | Yes |
| Bills & Utilities | Teal | Yes |
| Gym & Fitness | Cyan | Yes |
| Subscriptions | Cyan | Yes |
| Books & Media | Pink | Yes |
| Investments & Savings | Blue | Yes |
| Shopping | Purple | Conditional (baby supplies=yes) |
| Home & Hardware | Orange | Conditional (repairs=yes) |
| Entertainment | Orange | No |
| Alcohol & Liquor | Red | No |
| Electronics & Tech | Gray | No |
| Other | Gray | No |

## Database Schema

```sql
-- Categories
CREATE TABLE category (
    id INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(7) DEFAULT '#3498db'
);

-- Tags
CREATE TABLE tag (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Expenses
CREATE TABLE expense (
    id INTEGER PRIMARY KEY,
    description VARCHAR(200) NOT NULL,
    amount FLOAT NOT NULL,
    date DATE NOT NULL,
    category_id INTEGER REFERENCES category(id),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_frequency VARCHAR(20),
    is_essential BOOLEAN DEFAULT FALSE,
    transaction_type VARCHAR(10) DEFAULT 'expense',  -- 'income' or 'expense'
    notes TEXT,
    source_account VARCHAR(100),      -- Bank account from CSV filename
    bpay_biller_code VARCHAR(20),     -- For BPAY smart categorization
    created_at DATETIME
);

-- Junction table for expense-tag many-to-many
CREATE TABLE expense_tags (
    expense_id INTEGER REFERENCES expense(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (expense_id, tag_id)
);

-- Cash position tracking
CREATE TABLE cash_position (
    id INTEGER PRIMARY KEY,
    date DATE NOT NULL,
    amount FLOAT NOT NULL,
    notes TEXT,
    created_at DATETIME
);
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PASSWORD` | `Sebastian0727Gold!` | Login password |
| `SECRET_KEY` | `your-secret-key...` | Flask session key |

## Git Workflow

```bash
# Check status
git status

# Stage all changes
git add -A

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push origin main
```

**Important**: The database (`instance/expenses.db`) is NOT committed to git because it contains personal financial data. If you need to backup the database, copy it manually.

## Recovery Notes (Jan 2025)

This app was recovered from Claude session logs after local files were lost. The recovery process:
1. Extracted code from Jan 2 and Jan 16 session logs
2. Reconstructed PDF export, duplicate detection, bulk edit features
3. Migrated database schema to add missing columns
4. Database with 2,050 transactions was preserved

Always commit and push changes to avoid data loss.
