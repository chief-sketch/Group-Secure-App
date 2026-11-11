# Clear Governance Activity & Audit Logs Implementation Plan

Allow administrators to clear the governance activity feed from both the Admin Governance Dashboard and the Data Retention & Logs Audit Log view, supporting document deletion in Firestore and a clean empty state.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following choices were confirmed in Phase 1 clarification:
> - **Clear Target**: The primary user intent is to clear the **Recent governance activity** feed, with action availability in both the **Governance Dashboard** and the **Audit Log page**.
> - **Compliance / Retention Strategy**: Confirmed choice: **Delete audit log documents from Firestore**.
> - **Security Rule Adjustment**: Currently `firestore.rules` specifies `allow update, delete: if false;` on `/auditLogs/{logId}`. We will adjust the security rule to `allow delete: if isApprovedAdmin();` so only approved administrators can delete audit logs, preserving security while fulfilling the deletion requirement.
> - **Audit Trail of Clearance**: When clearing logs, an authoritative audit record for the clearance action itself is logged so compliance history records who cleared the logs and when.

---

## 1. Overview & Core Concept

- **What It Does**: Adds a dedicated **"Clear activity"** action with an accessible hold-to-confirm safety modal on both the **Governance Dashboard** (in the "Recent governance activity" card header) and the **Audit Log** tab. Administrators can clear the loaded governance activity and purge existing audit documents from Firestore.
- **Target Persona**: Authorized security administrators (`role === 'admin'` and `status === 'approved'`).
- **Key Value**: Enables administrators to clean up test logs, routine clutter, or reset activity history while preventing accidental triggers via a 1-second hold-to-confirm interaction.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **On Dashboard**: In the header of the "Recent governance activity" card (next to filter chips and "View full audit ledger"), a subtle destructive button `Clear activity` with a trash icon is displayed for administrators.
2. **On Audit Log Tab**: In the audit ledger header (next to "Export CSV"), a matching `Clear logs` button is provided.
3. **Safety Modal (`ClearActivityDialog`)**:
   - Opens an accessible modal with `useFocusTrap` and `Escape` key handling.
   - Shows alert context: explains that this will delete logged governance actions from Firestore.
   - Hold-to-confirm button using `<HoldToConfirmButton durationMs={1000} variant="danger" />` with visual fill bar, keyboard trigger (Space/Enter), and screen reader announcements.
4. **Instant Completion Feedback**:
   - A success toast `"Governance activity cleared"` appears.
   - The activity feed transitions immediately to a clean empty state: *"No recent activity · Governance logs have been cleared"*.

### Visual Architecture & Palette
- **Card Background**: Solid `#17232A` with `#2C3B44` border (flat dark style, anti-glass).
- **Destructive Button**: Crimson accent `#FF6B6B` with `#E5484D`/15 hover fill and `#E5484D`/30 border.
- **Typography**: Montserrat Medium base with SemiBold titles (`font-montserrat`), monospace tabular numerals for timestamps.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                      Admin UI                          │
│   Dashboard.tsx (Recent Activity)  &  AuditLog.tsx    │
└───────────────────────────┬────────────────────────────┘
                            │ Click "Clear activity"
                            ▼
┌────────────────────────────────────────────────────────┐
│           ClearActivityDialog (Modal)                  │
│       - Confirmation details                           │
│       - HoldToConfirmButton (1s hold / keyboard Space) │
└───────────────────────────┬────────────────────────────┘
                            │ onConfirm()
                            ▼
┌────────────────────────────────────────────────────────┐
│                   AppContext                           │
│   clearGovernanceActivity(deleteFromDb: boolean)       │
└───────────────────────────┬────────────────────────────┘
                            │ Calls Firestore Service
                            ▼
┌────────────────────────────────────────────────────────┐
│               firebaseService.ts                       │
│   - batch delete from collection('auditLogs')         │
│   - log clearance audit entry ("Activity cleared")     │
│   - optimistic update in AppContext state              │
└────────────────────────────────────────────────────────┘
```

### Component & File Changes

1. **`firestore.rules`**:
   - Update `match /auditLogs/{logId}` rule:
     ```
     allow delete: if isApprovedAdmin();
     ```
   - Deploy rules via `fax / DeployRules` rpc action.

2. **`src/lib/firebaseService.ts`**:
   - Add `deleteAuditLogsInFirestore(adminUid: string, adminEmail: string)`:
     - Fetches existing audit log doc IDs.
     - Performs a batch delete using `writeBatch(db)`.
     - Logs a final audit record: `"Governance activity cleared by ${adminEmail}"`.

3. **`src/context/AppContext.tsx`**:
   - Add `clearGovernanceActivity: () => Promise<void>` to `AppContextType` and implementation.
   - Updates `setAuditLogs([])` and provides user feedback toast.

4. **`src/components/admin/ClearActivityDialog.tsx` (NEW)**:
   - Accessible modal with danger badge, descriptive guidance, and `<HoldToConfirmButton>`.

5. **`src/components/admin/Dashboard.tsx`**:
   - Add `Clear activity` button to header of "Recent governance activity" card.

6. **`src/components/admin/AuditLog.tsx`**:
   - Add `Clear logs` button alongside the existing "Export CSV" button.

---

## 4. Verification Plan

- Run `compile_applet` and `lint_applet` to verify TypeScript types, imports, and builds.
- Verify security rule deployment.
- Verify interaction: Click "Clear activity" -> modal opens -> hold 1s -> audit entries clear -> toast appears.
