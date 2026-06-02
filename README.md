# CMDB Gravity Catalog Widget

A simplified Service Portal widget for use in **Catalog Items**. Designed to be embedded as a variable in catalog item forms.

## Features
- ✅ File upload (XLSX, CSV, JSON)
- ✅ Inline cell editing
- ✅ IRE simulation and commit


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





## Author

**Rajeev Vunukonda** - Core concept and development

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
