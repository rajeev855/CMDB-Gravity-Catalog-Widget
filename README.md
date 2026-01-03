# CMDB Gravity Catalog Widget

A simplified Service Portal widget for use in **Catalog Items**. Designed to be embedded as a variable in catalog item forms.

## Features
- ✅ File upload (XLSX, CSV, JSON)
- ✅ Inline cell editing
- ✅ IRE simulation and commit
- ✅ Results saved to RITM on commit
- ❌ No debug mode (removed for cleaner UI)
- ❌ No header section (removed for catalog integration)

## Files

| File | ServiceNow Widget Field |
|------|------------------------|
| `widget-template.html` | HTML Template |
| `widget-client-script.js` | Client Script |
| `widget-server-script.js` | Server Script |
| `widget-css.css` | CSS |

## Setup in ServiceNow

### 1. Create the Widget
1. Go to **Service Portal > Widgets**
2. Create new widget: `cmdb_catalog_import`
3. Copy content from each file into corresponding field

### 2. Create Catalog Item Variable
1. Open your Catalog Item
2. Add a new variable:
   - Type: **Custom Widget**
   - Widget: `cmdb_catalog_import`
   - Name: `cmdb_import`

### 3. Save Results to RITM (Optional)
Add this **Catalog Client Script** (onSubmit):

```javascript
function onSubmit() {
    // Get results from widget
    var results = window.cmdbImportResults || '';
    if (results) {
        g_form.setValue('comments', results);
    }
    return true;
}
```

Or create a **Catalog Item Script** to process the results server-side.

## RITM Data Structure

When committed, results are stored as JSON:

```json
{
    "timestamp": "2024-12-29T16:00:00.000Z",
    "fileName": "servers.xlsx",
    "totalRows": 5,
    "created": 3,
    "updated": 2,
    "errors": 0,
    "results": [
        {"status": "Create", "sysId": "abc123", "name": "Server1", "message": "New CI"}
    ]
}
```

## Security Considerations

- **Access Control**: Ensure proper ServiceNow ACLs are configured for CMDB write access
- **File Upload**: Only allow trusted users to access catalog items with this widget
- **External Dependency**: SheetJS is loaded from CDN; consider adding SRI verification for production

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines.

## Author

**Rajeev Vunukonda** - Core concept and development

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
