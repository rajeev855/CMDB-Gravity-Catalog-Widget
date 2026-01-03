# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this widget, please report it responsibly:

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly with details of the vulnerability
3. Include steps to reproduce the issue
4. Allow reasonable time for a fix before public disclosure

## Security Considerations

This widget interacts with ServiceNow's IRE (Identification and Reconciliation Engine) API. Ensure:

- Proper CMDB ACLs are configured on your ServiceNow instance
- Only authorized users have access to catalog items using this widget
- File uploads are restricted to trusted users

## Third-Party Dependencies

This widget loads SheetJS from an external CDN for Excel file parsing. Consider:
- Adding Subresource Integrity (SRI) verification
- Bundling the library locally for enhanced security
