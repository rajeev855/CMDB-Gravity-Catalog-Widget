#!/bin/bash
# Deploy CMDB Gravity Catalog Widget v8 to ServiceNow
# Usage: ./deploy.sh
# Requires: python3 (for JSON escaping), curl

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load credentials
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found at $ENV_FILE"
    echo "Create it with: SN_INSTANCE, SN_USER, SN_PASS, SN_WIDGET_SYS_ID"
    exit 1
fi
source "$ENV_FILE"

# Validate required vars
for var in SN_INSTANCE SN_USER SN_PASS SN_WIDGET_SYS_ID; do
    if [ -z "${!var:-}" ]; then
        echo "ERROR: $var is not set in .env"
        exit 1
    fi
done

if [ "$SN_PASS" = "YOUR_PASSWORD_HERE" ]; then
    echo "ERROR: Update SN_PASS in .env with your actual password"
    exit 1
fi

# Verify source files exist
for file in widget-client-script.js widget-template.html widget-css.css widget-server-script.js; do
    if [ ! -f "$SCRIPT_DIR/$file" ]; then
        echo "ERROR: $file not found in $SCRIPT_DIR"
        exit 1
    fi
done

echo "Deploying widget to $SN_INSTANCE..."
echo "Widget sys_id: $SN_WIDGET_SYS_ID"

# Build JSON payload using python3 for safe escaping
PAYLOAD=$(python3 -c "
import json, sys, os

script_dir = sys.argv[1]

def read_file(name):
    with open(os.path.join(script_dir, name), 'r') as f:
        return f.read()

payload = {
    'client_script': read_file('widget-client-script.js'),
    'template': read_file('widget-template.html'),
    'css': read_file('widget-css.css'),
    'script': read_file('widget-server-script.js')
}

print(json.dumps(payload))
" "$SCRIPT_DIR")

# PATCH the widget via ServiceNow Table API
RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X PATCH \
    "$SN_INSTANCE/api/now/table/sp_widget/$SN_WIDGET_SYS_ID" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -u "$SN_USER:$SN_PASS" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    WIDGET_NAME=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('name','unknown'))" 2>/dev/null || echo "unknown")
    echo ""
    echo "SUCCESS: Widget '$WIDGET_NAME' updated."
    echo "View: $SN_INSTANCE/sp_widget.do?sys_id=$SN_WIDGET_SYS_ID"
else
    echo ""
    echo "FAILED: HTTP $HTTP_CODE"
    echo "$BODY" | python3 -c "
import sys,json
try:
    err = json.load(sys.stdin).get('error',{})
    print('Error:', err.get('message','Unknown error'))
    if err.get('detail'):
        print('Detail:', err['detail'])
except:
    print(sys.stdin.read())
" 2>/dev/null || echo "$BODY"
    exit 1
fi
