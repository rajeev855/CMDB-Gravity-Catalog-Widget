# Gravity: On-Demand IRE CMDB Widget

A ServiceNow Service Portal widget that lets users import CMDB configuration items directly from Excel, CSV, or JSON files using the IRE (Identification and Reconciliation Engine) API.

## Features

- Upload XLSX, CSV, or JSON files (up to 2,000 rows)
- Paginated data preview (50 rows/page) with inline cell editing
- Simulate imports via IRE before committing — see what will be created, updated, or error
- Batch processing (200 rows/batch) with progress bar — no API timeouts
- Commit to CMDB only after successful simulation
- Pre-cached computed values for smooth UI performance even at scale

## Pre-requisites

**Register the CMDB data source** (run once per instance):

1. Go to **System Definition > Fix Scripts** > New
2. Paste the contents of `fix-script-register-datasource.js`
3. Run the fix script

This registers `CMDBGravityWidget` as a valid IRE data source so the Identify/Reconcile API accepts imports from this widget.

## Installation

1. Go to **Service Portal > Widgets** > New
2. Set the widget name to `Gravity: On-Demand IRE CMDB Widget`
3. Copy the contents of each file into the corresponding widget field:

| File | Widget Field |
|------|-------------|
| `widget-client-script.js` | Client Script |
| `widget-server-script.js` | Server Script |
| `widget-template.html` | HTML Template |
| `widget-css.css` | CSS |

4. Save the widget
5. Add it to any Service Portal page or catalog item

## Deploy via Script (optional)

If you prefer automated deployment:

1. Copy `.env.example` to `.env` and fill in your instance credentials
2. Run `./deploy.sh`

```bash
cp .env.example .env
# Edit .env with your instance URL, username, and password
./deploy.sh
```

## File Format

Your import file must include a `sys_class_name` column. All other columns map to CMDB CI fields.

Example:

| sys_class_name | name | serial_number | ip_address |
|---------------|------|---------------|------------|
| cmdb_ci_server | web-prod-01 | SN12345 | 10.0.1.10 |
| cmdb_ci_server | db-prod-01 | SN12346 | 10.0.1.11 |

## How It Works

1. **Upload** — User uploads an Excel, CSV, or JSON file
2. **Preview** — Data is displayed in a paginated table; cells can be edited inline
3. **Simulate** — IRE dry-run shows which CIs will be created, updated, or error
4. **Commit** — On confirmation, CIs are written to the CMDB via IRE

API calls are batched (200 rows per request) to avoid payload limits and timeouts.

## Author

**Rajeev Vunukonda**

## License

MIT
