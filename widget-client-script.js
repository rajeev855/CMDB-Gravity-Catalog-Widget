api.controller = function ($scope, $http) {
    var c = this;

    // State
    c.file = null;
    c.parsedRows = [];
    c.columns = [];
    c.simulationResults = [];
    c.commitResults = [];
    c.loading = false;
    c.committed = false;
    c.error = '';
    c.dragActive = false;

    // Editing state
    c.editingCell = null;
    c.editValue = '';

    // IRE API endpoints
    var IRE_SIMULATE = '/api/now/identifyreconcile/query';
    var IRE_COMMIT = '/api/now/identifyreconcile';
    var DATA_SOURCE = 'CMDBCatalogImport';

    // Get results as JSON for saving to RITM
    c.getResultsJSON = function () {
        if (!c.committed || c.commitResults.length === 0) return '';
        var summary = {
            timestamp: new Date().toISOString(),
            fileName: c.file ? c.file.name : '',
            totalRows: c.parsedRows.length,
            created: c.getCommitCount('Create'),
            updated: c.getCommitCount('Update'),
            errors: c.getCommitCount('Error'),
            results: c.commitResults.map(function (r) {
                return {
                    status: r.status,
                    sysId: r.sysId || '',
                    name: r.input.name || r.input.asset_tag || '',
                    message: r.message
                };
            })
        };
        return JSON.stringify(summary);
    };

    // Placeholder for future RITM integration
    c.publishResults = function () {
        // Results available via c.getResultsJSON()
        // TODO: Implement RITM variable integration
    };

    // Cell editing
    c.startEdit = function (rowIndex, column) {
        c.editingCell = { rowIndex: rowIndex, column: column };
        c.editValue = c.parsedRows[rowIndex][column] || '';
    };

    c.saveEdit = function () {
        if (c.editingCell) {
            c.parsedRows[c.editingCell.rowIndex][c.editingCell.column] = c.editValue;
            c.simulationResults = [];
            c.editingCell = null;
            c.editValue = '';
        }
    };

    c.cancelEdit = function () {
        c.editingCell = null;
        c.editValue = '';
    };

    c.isEditing = function (rowIndex, column) {
        return c.editingCell && c.editingCell.rowIndex === rowIndex && c.editingCell.column === column;
    };

    c.handleKeyPress = function (event) {
        if (event.keyCode === 13) c.saveEdit();
        else if (event.keyCode === 27) c.cancelEdit();
    };

    // Load SheetJS
    c.loadXLSX = function () {
        if (window.XLSX) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    c.handleFileSelect = function (event) {
        var file = event.target.files[0];
        if (file) c.processFile(file);
    };

    c.processFile = function (file) {
        c.file = file;
        c.error = '';
        c.parsedRows = [];
        c.columns = [];
        c.simulationResults = [];
        c.commitResults = [];
        c.committed = false;

        c.loadXLSX().then(function () {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var data = e.target.result;
                    var rows = [];

                    if (file.name.match(/\.xlsx?$/i)) {
                        var workbook = XLSX.read(data, { type: 'binary' });
                        rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
                        rows = rows.map(function (row) {
                            var newRow = {};
                            Object.keys(row).forEach(function (key) {
                                newRow[key] = String(row[key] || '').trim();
                            });
                            return newRow;
                        });
                    } else if (file.name.endsWith('.csv')) {
                        var lines = data.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
                        var headers = lines[0].split(',').map(function (h) { return h.trim(); });
                        rows = lines.slice(1).map(function (line) {
                            var values = line.split(',');
                            var obj = {};
                            headers.forEach(function (h, i) { obj[h] = (values[i] || '').trim(); });
                            return obj;
                        });
                    } else if (file.name.endsWith('.json')) {
                        rows = JSON.parse(data);
                    }

                    c.parsedRows = rows;
                    c.columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                    $scope.$apply();
                } catch (err) {
                    c.error = 'Parse error: ' + err.message;
                    $scope.$apply();
                }
            };
            file.name.match(/\.xlsx?$/i) ? reader.readAsBinaryString(file) : reader.readAsText(file);
        });
    };

    c.buildIREPayload = function () {
        return {
            items: c.parsedRows.map(function (row) {
                if (!row.sys_class_name) {
                    throw new Error('sys_class_name column is required in data');
                }
                var className = row.sys_class_name;
                var values = {};
                Object.keys(row).forEach(function (key) {
                    if (key !== 'sys_class_name') values[key] = row[key];
                });
                return { className: className, values: values };
            })
        };
    };

    c.parseIREResponse = function (response) {
        var results = [];
        if (response.result && response.result.items) {
            response.result.items.forEach(function (item, idx) {
                var result = { input: c.parsedRows[idx] || {} };
                if (item.errors && item.errors.length > 0) {
                    result.status = 'Error';
                    result.message = item.errors.map(function (e) { return e.message || e; }).join('; ');
                } else if (item.operation === 'INSERT' || item.operation === 'insert') {
                    result.status = 'Create';
                    result.message = 'New CI';
                    result.sysId = item.sysId;
                } else if (item.operation === 'UPDATE' || item.operation === 'update') {
                    result.status = 'Update';
                    result.message = 'Updated';
                    result.sysId = item.sysId;
                } else {
                    result.status = 'NoChange';
                    result.message = 'No change';
                }
                results.push(result);
            });
        }
        return results;
    };

    c.runSimulation = function () {
        c.loading = true;
        c.error = '';
        c.cancelEdit();
        var payload = c.buildIREPayload();
        var endpoint = IRE_SIMULATE + '?sysparm_data_source=' + DATA_SOURCE;

        $http.post(endpoint, payload, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }).then(function (response) {
            c.simulationResults = c.parseIREResponse(response.data);
            c.loading = false;
        }).catch(function (err) {
            c.error = 'Simulation failed: ' + (err.data && err.data.error ? err.data.error.message : err.message);
            c.loading = false;
        });
    };

    c.runCommit = function () {
        c.loading = true;
        c.error = '';
        var payload = c.buildIREPayload();
        var endpoint = IRE_COMMIT + '?sysparm_data_source=' + DATA_SOURCE;

        $http.post(endpoint, payload, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        }).then(function (response) {
            c.commitResults = c.parseIREResponse(response.data);
            c.committed = true;
            c.loading = false;
            c.publishResults();
        }).catch(function (err) {
            c.error = 'Commit failed: ' + (err.data && err.data.error ? err.data.error.message : err.message);
            c.loading = false;
        });
    };

    c.getRowStatus = function (idx) { return c.simulationResults[idx] ? c.simulationResults[idx].status : null; };
    c.getStatusCount = function (status) { return c.simulationResults.filter(function (r) { return r.status === status; }).length; };
    c.getCommitCount = function (status) { return c.commitResults.filter(function (r) { return r.status === status; }).length; };
    c.hasErrors = function () { return c.simulationResults.some(function (r) { return r.status === 'Error'; }); };
};
