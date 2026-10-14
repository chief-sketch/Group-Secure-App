# Security Specification & Threat Model

## 1. Data Invariants
- Users can only read and manage their own profile, or admins can view/manage all profiles.
- Standard users cannot promote themselves to 'admin' or alter their approved status.
- Channel messages belong to a chat. Messages can only be read/created if the user is signed in.
- Audit logs are append-only. No user (even an admin) may update or delete existing audit entries.
- The runtime owner `dmbogo20@gmail.com` is bootstrapped as a super-administrator.

## 2. The Dirty Dozen Payloads (Adversarial Test Cases)
1. **Self-Promotion Attack**: Standard user attempting to create/update profile with `role: "admin"`. -> REJECT
2. **Ghost Fields Injection**: Sending user profile with `isVerified: true` or `shadowField: "evil"`. -> REJECT
3. **Audit Tampering**: Attempting to delete an audit log document. -> REJECT
4. **Audit Overwrite**: Attempting an update write on `/audit_logs/{id}`. -> REJECT
5. **ID Path Poisoning**: Supplying a 2KB garbage document ID. -> REJECT
6. **Impersonation**: Writing a message with `senderId` not matching `request.auth.uid`. -> REJECT
7. **Unbounded String Flooding**: Posting message with 50,000 character text. -> REJECT
8. **Negative Size Flooding**: Creating an array with invalid sizes. -> REJECT
9. **Blanket Query Scraping**: Running collectionGroup query without owner or chat boundaries. -> REJECT
10. **Orphaned Message**: Writing message to a non-existent or invalid chat ID. -> REJECT
11. **PII Extraction**: Non-admin unauthenticated read on `/users/{id}`. -> REJECT
12. **Status Short-Circuit**: Directly bypassing pending status during self-signup. -> REJECT
