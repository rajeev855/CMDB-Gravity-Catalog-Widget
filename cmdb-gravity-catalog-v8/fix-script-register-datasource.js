// ServiceNow Fix Script — Run once before using the widget
// Navigate to: System Definition > Fix Scripts > New
// This registers a CMDB data source so IRE validates imports from this widget

var dsUtil = new global.CMDBDataSourceUtil();
dsUtil.addDataSource("CMDBGravityWidget");
