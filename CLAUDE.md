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
  app.py              # Flask app, routes, models, categorization (~1630 lines)
  requirements.txt    # Dependencies (Flask, SQLAlchemy, fpdf2, dateutil)
  templates/
    index.html        # Single-page app template (~675 lines)
    login.html        # Login page
  static/
    css/style.css     # Xero dark theme (~320 lines)
    js/app.js         # API calls, Chart.js (~1960 lines)
  instance/
    expenses.db       # SQLite database (auto-created, NOT in git)
  venv/               # Python virtual environment (NOT in git)
```

## Key Features

### Core
- **Smart Categorization**: 18 categories with Melbourne-specific keyword matching
- **Essential vs Optional**: Classify spending types automatically
- **Income Detection**: Keywords + amount-based detection
- **Recurring Detection**: Auto-tags subscriptions (Netflix, Spotify, etc.)
- **CSV Import**: Bulk import from bank statements (ANZ, CBA, NAB, Amex formats)
- **Manual Transaction Entry**: Add transactions without CSV files
- **Multi-Period Stats**: Month, year, last 3/12 months, all-time analytics
- **12-Month Trends**: Visual spending history
- **Tag System**: Many-to-many tagging

### Advanced Features
- **Learned Rules System**: App remembers category corrections for future imports
- **PDF Export**: Professional reports with customizable sections
- **Duplicate Detection**: Find and remove duplicate transactions
- **Service Station Recategorization**: Auto-sort by amount ($40+ = fuel, <$40 = food)
- **Bulk Edit**: Change category/essential status for multiple transactions
- **Category Management**: Inline rename, color picker, add/delete categories
- **BPAY Matching**: Store biller codes for smart categorization
- **Cash Position & Runway**: Track how long your money will last
- **Year Toggle**: Switch statistics display between years (2025/2026)

## Learned Rules System

When you change a transaction's category with "Apply to all", the app saves a rule for future imports:

```python
# Priority order:
# 1. BPAY biller code (priority 100)
# 2. Exact description match (priority 50)
# 3. Contains description match (priority 10)
```

View and manage rules in Settings > Learned Categorization Rules.

## Income Detection

The app detects income using these keywords:
- `payment received`, `direct debit received`, `online payment received`
- `direct credit from`, `transfer from`
- `salary`, `wage`, `deposit`, `refund`
- `jeremy wald` (Denbigh Road rental)
- `rt etgar` (Brooklyn Avenue rental)

Exclusions:
- `transfer to`, `payment to` = Always expense
- Family transfers (gideon, tayla, reisner) = Skip
- Credit card payments (amex) = Skip

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/login` | GET/POST | Authentication |
| `/` | GET | Main page (requires login) |
| `/api/expenses` | GET | List all expenses |
| `/api/expenses` | POST | Create expense |
| `/api/expenses/<id>` | PUT | Update expense |
| `/api/expenses/<id>` | DELETE | Delete expense |
| `/api/expenses/bulk-update-category` | POST | Bulk category change + save rule |
| `/api/expenses/bulk-update-essential` | POST | Bulk essential toggle |
| `/api/categories` | GET | List categories |
| `/api/categories` | POST | Create category |
| `/api/categories/<id>` | PUT | Update category (name/color) |
| `/api/categories/<id>` | DELETE | Delete category |
| `/api/statistics` | GET | Analytics with ?period=&year= |
| `/api/import-csv` | POST | Bulk CSV import |
| `/api/export/pdf` | POST | Generate PDF report |
| `/api/duplicates` | GET | Scan for duplicates |
| `/api/duplicates/remove` | DELETE | Remove selected duplicates |
| `/api/expenses/recategorize-service-stations` | POST | Auto-recategorize |
| `/api/learned-rules` | GET/POST | List/create learned rules |
| `/api/learned-rules/<id>` | DELETE | Delete learned rule |
| `/api/cash-position` | GET/POST | Track cash runway |
| `/api/cash-position/runway` | GET | Calculate runway |

## Categories (18 total)

| Category | Essential |
|----------|-----------|
| Food & Dining | Conditional (groceries=yes, restaurants=no) |
| Transportation | Conditional (fuel=yes, uber=no) |
| Housing & Rent | Yes |
| Healthcare | Yes |
| Pet Care | Yes |
| Personal Care | Yes |
| Kids & Education | Yes |
| Childcare & Education | Yes |
| Bills & Utilities | Yes |
| Gym & Fitness | Yes |
| Subscriptions | Yes |
| Books & Media | Yes |
| Investments & Savings | Yes |
| Taxation | Yes |
| Income | No |
| Shopping | Conditional (baby supplies=yes) |
| Home & Hardware | Conditional (repairs=yes) |
| Entertainment | No |
| Alcohol & Liquor | No |
| Electronics & Tech | No |
| Other | No |

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
    transaction_type VARCHAR(10) DEFAULT 'expense',
    notes TEXT,
    source_account VARCHAR(100),
    bpay_biller_code VARCHAR(20),
    created_at DATETIME
);

-- Junction table for expense-tag many-to-many
CREATE TABLE expense_tags (
    expense_id INTEGER REFERENCES expense(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tag(id) ON DELETE CASCADE,
    PRIMARY KEY (expense_id, tag_id)
);

-- Learned Rules (for persistent categorization)
CREATE TABLE learned_rule (
    id INTEGER PRIMARY KEY,
    description_pattern VARCHAR(200),
    bpay_biller_code VARCHAR(20),
    category_id INTEGER NOT NULL REFERENCES category(id),
    is_essential BOOLEAN DEFAULT FALSE,
    transaction_type VARCHAR(10) DEFAULT 'expense',
    match_type VARCHAR(20) DEFAULT 'exact',
    priority INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
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

**Important**: The database (`instance/expenses.db`) is NOT committed to git because it contains personal financial data. Backup the database manually if needed.

## Recovery Notes

This app was recovered from Claude session logs after local files were lost (Jan 2025).

**To prevent future data loss:**
1. Always push changes to GitHub
2. Backup database periodically
3. Full documentation saved at `~/Desktop/BALANCE_SHEET_DOCUMENTATION.md`

GitHub: https://github.com/giddr/balance-sheetv3
