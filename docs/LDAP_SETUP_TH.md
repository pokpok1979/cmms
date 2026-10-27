# LDAP user synchronization

LDAP supplies usernames, names, email, departments and positions. CMMS uses local passwords for all accounts; it does not authenticate user passwords against AD.

Configure the LDAP Service Account password to allow directory searches. This credential is separate from user login passwords.

New imported users are inactive and have no CMMS password. An authorized Admin sets their initial password in User Management and activates the account. Users can then change their own password in Profile by supplying their current password. Synchronization preserves existing CMMS password hashes and roles.

Usernames use the LDAP username directly without a company prefix. Existing duplicate usernames are skipped during synchronization.

When deploying this change to an existing installation, run:

```powershell
node --import tsx scripts/use-local-ldap-passwords.ts
```

TLS configuration and the encrypted Service Account credential remain in LDAP settings. Configure LDAP_ENCRYPTION_KEY on the server before saving credentials. LDAP connections support LDAPS, StartTLS, or explicitly selected plain LDAP.
