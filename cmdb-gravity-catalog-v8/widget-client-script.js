api.controller = function ($scope, $http) {
    var c = this;

    // Limits
    var MAX_ROWS = 2000;
    var BATCH_SIZE = 200;

    // Core state
    c.file = null;
    c.parsedRows = [];
    c.columns = [];
    c.simulationResults = [];
    c.commitResults = [];
    c.loading = false;
    c.committed = false;
    c.error = '';
    c.dragActive = false;

    // Pagination state
    c.currentPage = 1;
    c.pageSize = 50;
    c.displayRows = [];
    c.displayStatuses = [];
    c.totalPages = 0;
    c.pageStartIndex = 0;

    // Inline editing state (scoped to current page only)
    c.editingCell = null;
    c.editValue = '';

    // Batch progress
    c.batchProgress = null;

    // Cached computed values
    c.statusCounts = { Create: 0, Update: 0, Error: 0, NoChange: 0 };
    c.commitCounts = { Create: 0, Update: 0, Error: 0, NoChange: 0 };
    c.hasErrorFlag = false;
    c.resultsJSON = '';

    // IRE API endpoints
    var IRE_SIMULATE = '/api/now/identifyreconcile/query';
    var IRE_COMMIT = '/api/now/identifyreconcile';
    var DATA_SOURCE = 'CMDBGravityWidget';

    // --- Caching ---

    c.recalculateCaches = function () {
        var sc = { Create: 0, Update: 0, Error: 0, NoChange: 0 };
        c.simulationResults.forEach(function (r) {
            if (sc.hasOwnProperty(r.status)) { sc[r.status]++; }
        });
        c.statusCounts = sc;

        var cc = { Create: 0, Update: 0, Error: 0, NoChange: 0 };
        c.commitResults.forEach(function (r) {
            if (cc.hasOwnProperty(r.status)) { cc[r.status]++; }
        });
        c.commitCounts = cc;

        c.hasErrorFlag = sc.Error > 0;

        if (!c.committed || c.commitResults.length === 0) {
            c.resultsJSON = '';
        } else {
            c.resultsJSON = JSON.stringify({
                timestamp: new Date().toISOString(),
                fileName: c.file ? c.file.name : '',
                totalRows: c.parsedRows.length,
                created: cc.Create,
                updated: cc.Update,
                errors: cc.Error,
                results: c.commitResults.map(function (r) {
                    return {
                        status: r.status,
                        sysId: r.sysId || '',
                        name: r.input.name || r.input.asset_tag || '',
                        message: r.message
                    };
                })
            });
        }

    };

    // --- Pagination ---

    c.refreshDisplayRows = function () {
        c.totalPages = Math.ceil(c.parsedRows.length / c.pageSize) || 1;
        if (c.currentPage > c.totalPages) { c.currentPage = c.totalPages; }
        if (c.currentPage < 1) { c.currentPage = 1; }
        c.pageStartIndex = (c.currentPage - 1) * c.pageSize;
        var end = c.pageStartIndex + c.pageSize;
        c.displayRows = c.parsedRows.slice(c.pageStartIndex, end);
        c.displayStatuses = c.simulationResults.length > 0
            ? c.simulationResults.slice(c.pageStartIndex, end)
            : [];
    };

    c.nextPage = function () {
        if (c.currentPage < c.totalPages) {
            c.cancelEdit();
            c.currentPage++;
            c.refreshDisplayRows();
        }
    };

    c.prevPage = function () {
        if (c.currentPage > 1) {
            c.cancelEdit();
            c.currentPage--;
            c.refreshDisplayRows();
        }
    };

    // --- Inline Editing (operates on current page only) ---

    c.startEdit = function (displayIndex, column) {
        if (c.simulationResults.length > 0) { return; }
        c.editingCell = { displayIndex: displayIndex, column: column };
        c.editValue = c.displayRows[displayIndex][column] || '';
    };

    c.saveEdit = function () {
        if (!c.editingCell) { return; }
        var globalIndex = c.pageStartIndex + c.editingCell.displayIndex;
        var col = c.editingCell.column;
        var trimmed = String(c.editValue || '').trim();

        if (c.parsedRows[globalIndex][col] !== trimmed) {
            var updatedRow = {};
            Object.keys(c.parsedRows[globalIndex]).forEach(function (key) {
                updatedRow[key] = key === col ? trimmed : c.parsedRows[globalIndex][key];
            });
            c.parsedRows[globalIndex] = updatedRow;
            c.simulationResults = [];
            c.recalculateCaches();
            c.refreshDisplayRows();
        }

        c.editingCell = null;
        c.editValue = '';
    };

    c.cancelEdit = function () {
        c.editingCell = null;
        c.editValue = '';
    };

    c.isEditing = function (displayIndex, column) {
        return c.editingCell &&
            c.editingCell.displayIndex === displayIndex &&
            c.editingCell.column === column;
    };

    c.handleEditKeydown = function (event) {
        if (event.keyCode === 13) { c.saveEdit(); }
        else if (event.keyCode === 27) { c.cancelEdit(); }
    };

    // --- Placeholder for RITM integration ---

    c.publishResults = function () {
        // Results available via c.resultsJSON
    };

    // --- File Parsing ---

    c.loadXLSX = function () {
        if (window.XLSX) { return Promise.resolve(); }
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
        if (file) { c.processFile(file); }
    };

    function normalizeRows(rawRows) {
        return rawRows.map(function (row) {
            var newRow = {};
            Object.keys(row).forEach(function (key) {
                newRow[key] = String(row[key] || '').trim();
            });
            return newRow;
        });
    }

    c.processFile = function (file) {
        c.file = file;
        c.error = '';
        c.parsedRows = [];
        c.columns = [];
        c.simulationResults = [];
        c.commitResults = [];
        c.committed = false;
        c.currentPage = 1;
        c.batchProgress = null;
        c.editingCell = null;
        c.editValue = '';
        c.displayRows = [];
        c.displayStatuses = [];
        c.totalPages = 0;
        c.recalculateCaches();

        $scope.$applyAsync();

        c.loadXLSX().then(function () {
            var reader = new FileReader();
            reader.onload = function (e) {
                try {
                    var data = e.target.result;
                    var rows = [];

                    if (file.name.match(/\.xlsx?$/i)) {
                        var workbook = XLSX.read(data, { type: 'binary' });
                        rows = normalizeRows(
                            XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
                        );
                    } else if (file.name.endsWith('.csv')) {
                        var csvWorkbook = XLSX.read(data, { type: 'string' });
                        rows = normalizeRows(
                            XLSX.utils.sheet_to_json(csvWorkbook.Sheets[csvWorkbook.SheetNames[0]], { defval: '' })
                        );
                    } else if (file.name.endsWith('.json')) {
                        rows = JSON.parse(data);
                    }

                    if (rows.length > MAX_ROWS) {
                        c.error = 'File contains ' + rows.length + ' rows. Maximum allowed is ' + MAX_ROWS + '. Please reduce the file size and try again.';
                        c.file = null;
                        $scope.$apply();
                        return;
                    }

                    c.parsedRows = rows;
                    c.columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                    c.refreshDisplayRows();
                    $scope.$apply();
                } catch (err) {
                    c.error = 'Parse error: ' + err.message;
                    $scope.$apply();
                }
            };
            file.name.match(/\.xlsx?$/i) ? reader.readAsBinaryString(file) : reader.readAsText(file);
        });
    };

    // --- IRE API ---

    c.buildIREPayload = function (rows) {
        return {
            items: rows.map(function (row) {
                if (!row.sys_class_name) {
                    throw new Error('sys_class_name column is required in data');
                }
                var className = row.sys_class_name;
                var values = {};
                Object.keys(row).forEach(function (key) {
                    if (key !== 'sys_class_name') { values[key] = row[key]; }
                });
                return { className: className, values: values };
            })
        };
    };

    c.parseIREResponse = function (response, batchRows) {
        var results = [];
        if (response.result && response.result.items) {
            response.result.items.forEach(function (item, idx) {
                var result = {
                    input: batchRows[idx] || {},
                    rowNumber: idx + 1
                };
                if (item.errors && item.errors.length > 0) {
                    result.status = 'Error';
                    result.message = item.errors.map(function (e) { return e.message || e; }).join('; ');
                } else if (item.operation === 'INSERT' || item.operation === 'insert') {
                    result.status = 'Create';
                    result.message = 'New CI will be created';
                    result.sysId = item.sysId;
                } else if (item.operation === 'UPDATE' || item.operation === 'update') {
                    result.status = 'Update';
                    result.message = 'Existing CI will be updated';
                    result.sysId = item.sysId;
                } else {
                    result.status = 'NoChange';
                    result.message = 'No change detected';
                }
                results.push(result);
            });
        }
        return results;
    };

    // --- Batch Processing ---

    c.processBatches = function (endpoint, isCommit) {
        c.loading = true;
        c.error = '';
        c.cancelEdit();
        var allResults = [];
        var totalBatches = Math.ceil(c.parsedRows.length / BATCH_SIZE);
        c.batchProgress = { current: 0, total: totalBatches };

        function processBatch(batchIndex) {
            if (batchIndex >= totalBatches) {
                if (isCommit) {
                    c.commitResults = allResults;
                    c.committed = true;
                } else {
                    c.simulationResults = allResults;
                }
                c.recalculateCaches();
                c.refreshDisplayRows();
                c.loading = false;
                c.batchProgress = null;
                if (isCommit) { c.publishResults(); }
                return;
            }

            var start = batchIndex * BATCH_SIZE;
            var end = Math.min(start + BATCH_SIZE, c.parsedRows.length);
            var batchRows = c.parsedRows.slice(start, end);
            var payload = c.buildIREPayload(batchRows);

            // Tag each result with its global row number
            var batchStartRow = start + 1;

            $http.post(endpoint, payload, {
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            }).then(function (response) {
                var batchResults = c.parseIREResponse(response.data, batchRows);
                batchResults.forEach(function (r, i) {
                    r.rowNumber = batchStartRow + i;
                });
                allResults = allResults.concat(batchResults);
                c.batchProgress = { current: batchIndex + 1, total: totalBatches };
                processBatch(batchIndex + 1);
            }).catch(function (err) {
                var action = isCommit ? 'Commit' : 'Simulation';
                c.error = action + ' failed at batch ' + (batchIndex + 1) + ' of ' + totalBatches +
                    ': ' + (err.data && err.data.error ? err.data.error.message : err.message || 'Unknown error');
                if (isCommit) {
                    c.commitResults = allResults;
                } else {
                    c.simulationResults = allResults;
                }
                c.recalculateCaches();
                c.refreshDisplayRows();
                c.loading = false;
                c.batchProgress = null;
            });
        }

        processBatch(0);
    };

    c.runSimulation = function () {
        var endpoint = IRE_SIMULATE + '?sysparm_data_source=' + DATA_SOURCE;
        c.processBatches(endpoint, false);
    };

    c.runCommit = function () {
        var endpoint = IRE_COMMIT + '?sysparm_data_source=' + DATA_SOURCE;
        c.processBatches(endpoint, true);
    };
};
