# Smart Categorization

Auto-categorizes expenses by keywords with essential vs optional classification.

## Overview

The `smart_categorize()` function analyzes expense descriptions to:
1. Assign a category
2. Determine if essential or optional
3. Suggest relevant tags

## Categories

| Category | Color | Essential by Default |
|----------|-------|---------------------|
| Food & Dining | `#e74c3c` | Conditional |
| Transportation | `#3498db` | Conditional |
| Healthcare | `#e67e22` | Yes |
| Pet Care | `#ff6b9d` | Yes |
| Kids & Education | `#feca57` | Yes |
| Bills & Utilities | `#1abc9c` | Yes |
| Subscriptions | `#48dbfb` | No |
| Shopping | `#9b59b6` | No |
| Entertainment | `#f39c12` | No |
| Other | `#95a5a6` | No |

## Categorization Rules

Defined in `CATEGORIZATION_RULES` dictionary (app.py lines 14-69):

```python
CATEGORIZATION_RULES = {
    'Food & Dining': {
        'keywords': ['woolworths', 'coles', 'aldi', 'supermarket', 'grocery',
                     'cafe', 'restaurant', 'uber eats', 'mcdonald', ...],
        'essential_keywords': ['woolworths', 'coles', 'aldi', 'supermarket', 'grocery'],
        'essential': True
    },
    'Transportation': {
        'keywords': ['uber', 'taxi', 'petrol', 'fuel', 'parking', 'toll', ...],
        'essential_keywords': ['petrol', 'fuel', 'rego', 'registration'],
        'essential': True
    },
    # ... more categories
}
```

### Rule Structure

Each category has:
- `keywords`: List of strings to match (case-insensitive)
- `essential_keywords`: Subset that marks expense as essential
- `essential`: Default essential status for category

## smart_categorize() Function

Location: `app.py` lines 101-118

```python
def smart_categorize(description):
    """Returns (category_name, is_essential, suggested_tags)"""
    desc_lower = description.lower()

    for category_name, rules in CATEGORIZATION_RULES.items():
        for keyword in rules['keywords']:
            if keyword in desc_lower:
                # Check if essential
                is_essential = rules['essential']
                if is_essential:
                    is_essential = any(kw in desc_lower for kw in rules['essential_keywords'])

                # Generate tags
                tags = ['essential'] if is_essential else ['optional']
                if 'subscription' in category_name.lower() or \
                   any(sub in desc_lower for sub in ['netflix', 'spotify', 'prime', 'gym']):
                    tags.append('recurring')

                return category_name, is_essential, tags

    return 'Other', False, ['optional']
```

## Essential vs Optional Logic

### Categories Always Essential
- Healthcare
- Pet Care
- Kids & Education
- Bills & Utilities

### Conditional Categories
- **Food & Dining**: Essential only if matches `essential_keywords` (groceries)
  - "Woolworths" → Essential (grocery)
  - "Uber Eats" → Optional (takeout)
- **Transportation**: Essential only if matches `essential_keywords`
  - "Shell Petrol" → Essential (fuel)
  - "Uber ride" → Optional (rideshare)

### Always Optional
- Subscriptions
- Shopping
- Entertainment

## Auto-Tagging

Tags are suggested based on:
1. **essential** or **optional** based on classification
2. **recurring** if subscription-related keywords found:
   - Netflix, Spotify, Amazon Prime, Gym
   - Category is "Subscriptions"

## Usage in CSV Import

When importing bank statements, each row is auto-categorized:

```python
# In import_csv() (app.py line 320)
category_name, is_essential, suggested_tags = smart_categorize(description)

category = Category.query.filter_by(name=category_name).first()
expense = Expense(
    description=description,
    amount=amount,
    date=date_obj,
    category_id=category.id,
    is_essential=is_essential
)

for tag_name in suggested_tags:
    # Create and attach tags
```

## Adding New Keywords

To add keywords to a category, edit `CATEGORIZATION_RULES`:

```python
'Food & Dining': {
    'keywords': [
        # Add new keywords here
        'new_store_name',
        'another_restaurant',
        ...
    ],
    'essential_keywords': [
        # Add if should mark as essential
    ],
    'essential': True
}
```

## Example Classifications

| Description | Category | Essential | Tags |
|-------------|----------|-----------|------|
| "Woolworths Metro" | Food & Dining | Yes | essential |
| "Uber Eats order" | Food & Dining | No | optional |
| "Netflix subscription" | Subscriptions | No | optional, recurring |
| "Dr Smith Medical" | Healthcare | Yes | essential |
| "JB Hi-Fi" | Other | No | optional |
| "AGL Electricity" | Bills & Utilities | Yes | essential |
