# CSV Import

Bulk import expenses from bank/credit card statements with flexible parsing.

## Endpoint

**POST** `/api/import-csv`

Content-Type: `multipart/form-data`

## Request

Form field: `file` - CSV file

## Response

Success:
```json
{
  "message": "Successfully imported 25 expenses",
  "imported": 25,
  "errors": []
}
```

Partial success:
```json
{
  "message": "Successfully imported 23 expenses",
  "imported": 23,
  "errors": [
    "Row 5: Invalid date format: 2026/13/01",
    "Row 12: Missing required fields"
  ]
}
```

## Supported CSV Format

### Required Columns

The importer looks for these column names (case-insensitive):

| Column | Accepted Names |
|--------|----------------|
| Date | `date`, `Date`, `DATE`, `Transaction Date` |
| Description | `description`, `Description`, `DESCRIPTION` |
| Amount | `amount`, `Amount`, `AMOUNT` |

### Example CSV

```csv
date,description,amount
2026-01-15,Woolworths Metro,85.50
2026-01-14,Uber Eats,32.00
2026-01-13,Netflix Subscription,16.99
```

## Supported Date Formats

The importer tries these formats in order:

| Format | Example |
|--------|---------|
| `%Y-%m-%d` | 2026-01-15 |
| `%m/%d/%Y` | 01/15/2026 |
| `%d/%m/%Y` | 15/01/2026 |
| `%Y/%m/%d` | 2026/01/15 |
| `%d-%m-%Y` | 15-01-2026 |
| `%d %b %Y` | 15 Jan 2026 |

## Amount Parsing

- Removes `$` prefix
- Removes commas (`,`)
- Takes absolute value (negative amounts become positive)

Examples:
- `$85.50` → `85.50`
- `-32.00` → `32.00`
- `1,234.56` → `1234.56`

## Implementation

Location: `app.py` lines 279-358

```python
@app.route('/api/import-csv', methods=['POST'])
def import_csv():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_reader = csv.DictReader(stream)

        imported_count = 0
        errors = []

        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # Extract fields (flexible column names)
                date_str = row.get('date') or row.get('Date') or row.get('DATE') or row.get('Transaction Date')
                description = row.get('description') or row.get('Description') or row.get('DESCRIPTION')
                amount_str = row.get('amount') or row.get('Amount') or row.get('AMOUNT')

                if not all([date_str, description, amount_str]):
                    errors.append(f"Row {row_num}: Missing required fields")
                    continue

                # Parse date (try multiple formats)
                date_obj = None
                for date_format in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%Y', '%d %b %Y']:
                    try:
                        date_obj = datetime.strptime(date_str.strip(), date_format).date()
                        break
                    except ValueError:
                        continue

                if not date_obj:
                    errors.append(f"Row {row_num}: Invalid date format: {date_str}")
                    continue

                # Parse amount
                amount_clean = amount_str.replace('$', '').replace(',', '').strip()
                amount = abs(float(amount_clean))

                # Auto-categorize
                category_name, is_essential, suggested_tags = smart_categorize(description)

                # Get or create category
                category = Category.query.filter_by(name=category_name).first()
                if not category:
                    category = Category(name=category_name)
                    db.session.add(category)
                    db.session.flush()

                # Create expense
                expense = Expense(
                    description=description,
                    amount=amount,
                    date=date_obj,
                    category_id=category.id,
                    is_essential=is_essential
                )

                # Add tags
                for tag_name in suggested_tags:
                    tag = Tag.query.filter_by(name=tag_name).first()
                    if not tag:
                        tag = Tag(name=tag_name)
                        db.session.add(tag)
                    expense.tags.append(tag)

                db.session.add(expense)
                imported_count += 1

            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")

        db.session.commit()

        return jsonify({
            'message': f'Successfully imported {imported_count} expenses',
            'imported': imported_count,
            'errors': errors
        })

    except Exception as e:
        return jsonify({'error': f'Failed to process CSV: {str(e)}'}), 400
```

## Frontend Usage

### HTML Form

```html
<form id="import-form">
    <div class="alert alert-info">
        <strong>CSV Format Required:</strong> Your CSV file should have columns:
        <code>date</code>, <code>description</code>, <code>amount</code>
    </div>
    <div class="mb-3">
        <label class="form-label">Select CSV File</label>
        <input type="file" class="form-control" id="csv-file" accept=".csv" required>
    </div>
    <button type="submit" class="btn btn-primary">
        <i class="bi bi-upload"></i> Import Transactions
    </button>
</form>
<div id="import-result" class="mt-3"></div>
```

### JavaScript Handler

```javascript
async function handleImportSubmit(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/import-csv', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (response.ok) {
            let message = `<div class="alert alert-success">${result.message}</div>`;

            if (result.errors && result.errors.length > 0) {
                message += '<div class="alert alert-warning"><strong>Errors:</strong><ul>';
                result.errors.forEach(error => {
                    message += `<li>${error}</li>`;
                });
                message += '</ul></div>';
            }

            document.getElementById('import-result').innerHTML = message;
            fileInput.value = '';
            loadExpenses();
            loadStatistics(currentPeriod);
        }
    } catch (error) {
        console.error('Error importing CSV:', error);
    }
}
```

## Error Handling

| Error | Cause |
|-------|-------|
| "No file provided" | Form submitted without file |
| "No file selected" | Empty filename |
| "Missing required fields" | Row lacks date, description, or amount |
| "Invalid date format" | Date doesn't match any supported format |
| Row-specific errors | Individual parsing failures |

## Auto-Processing

Each imported row automatically:
1. Gets categorized by `smart_categorize()`
2. Gets essential/optional classification
3. Gets relevant tags (essential/optional/recurring)
