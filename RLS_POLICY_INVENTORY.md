# Complete RLS Policy Inventory

> **Generated:** 2026-02-21  
> **Source migrations analyzed (authoritative):**
> 1. `20260122_complete_rls_cleanup.sql`
> 2. `20260216_fix_missing_rls_policies.sql`
> 3. `20260216_fix_uom_types_rls_policies.sql`
> 4. `20260215_workflow_role_migration.sql`
> 5. `20260211_platform_admin_system.sql`
> 6. `20260212_billing_system.sql`
> 7. `20260121_fix_organizations_rls_policy.sql`
>
> **Supporting migrations also traced:**
> `20241213_rls_policies.sql`, `20250112_02_features_and_settings.sql`, `20250112_11_restrict_audit_logs_FIX.sql`, `20250113_01_multi_tenancy_fixed.sql`, `20250113_02_security_fixes_complete.sql`, `20250113_07_fix_data_isolation_complete.sql`, `20260120_audit_logging_security.sql`, `20260120_critical_rls_policies_write_operations.sql`, `20260120_rate_limiting.sql`, `20260121_rls_auth_performance_fix.sql`, `20260121_fix_security_definer_views.sql`, `20260212_admin_auth_hardening.sql`

---

## CRITICAL NOTE: Function Signature Change Impact

Migration `20260215_workflow_role_migration.sql` **dropped and recreated** `is_super_admin()` and `get_user_role()` with new signatures:

```sql
-- OLD (dropped):
is_super_admin()          → RETURNS BOOLEAN
get_user_role()           → RETURNS user_role

-- NEW (created):
is_super_admin(check_org_id UUID DEFAULT NULL) → RETURNS BOOLEAN
get_user_role(check_org_id UUID DEFAULT NULL)  → RETURNS user_role
```

This invalidated all existing policies whose expression trees referenced the old function OIDs. Policies that were **NOT recreated** in `20260215`, `20260216_fix_missing`, or `20260216_fix_uom_types` are marked **⚠️ BROKEN** below — they still exist in `pg_policies` but fail at evaluation time with a stale OID reference.

**Functions NOT affected** (OIDs unchanged, policies survived):
- `user_belongs_to_org(UUID)`
- `user_is_org_admin(UUID)`
- `user_is_org_owner(UUID)`
- `is_platform_admin()`
- `is_assigned_to_project(UUID)`

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Active — created/recreated after `20260215` or doesn't reference dropped functions |
| ⚠️ BROKEN | Policy exists but references stale `is_super_admin()` / `get_user_role()` OID |
| 🔒 | Intentionally has no policy for this operation (access blocked by design) |
| `(SELECT auth.uid())` | Uses the optimized subquery pattern for auth.uid() |
| `auth.uid()` direct | Uses bare `auth.uid()` (performance concern, re-evaluated per row) |

---

## 1. `organizations`

**RLS:** Enabled (since `20250113_01`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view their organizations` | SELECT | `user_belongs_to_org(id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Owners can update organization` | UPDATE | `user_is_org_owner(id)` | — | `user_is_org_owner()` | No | ✅ |
| 3 | `Platform admins can view all organizations` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 4 | `Platform admins can update any organization` | UPDATE | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| — | *No INSERT policy* | INSERT | — | — | — | — | 🔒 Edge Function only |
| — | *No DELETE policy* | DELETE | — | — | — | — | 🔒 |

**Source:** #1–2 from `20250113_01`, #3–4 from `20260211`. INSERT dropped in `20260121_fix_organizations_rls_policy.sql`.

---

## 2. `organization_members`

**RLS:** Enabled (since `20250113_01`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view org members` | SELECT | `user_belongs_to_org(organization_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Platform admins can view all org members` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 3 | `Admins can add org members` | INSERT | — | `user_is_org_admin(organization_id)` | `user_is_org_admin()` | No | ✅ |
| 4 | `Admins can update org members` | UPDATE | `user_is_org_admin(organization_id) AND (role <> 'owner' OR user_id = (SELECT auth.uid()))` | — | `user_is_org_admin()` | No | ✅ |
| 5 | `Admins can remove org members` | DELETE | `user_is_org_admin(organization_id) AND role != 'owner'` | — | `user_is_org_admin()` | No | ✅ |

**Source:** #1, 3, 5 from `20250113_01`; #2 from `20260211`; #4 from `20260122_complete_rls_cleanup`.

---

## 3. `organization_settings`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view their org settings` | SELECT | `org_id IS NULL OR user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Admins can create org settings` | INSERT | — | `org_id IS NULL OR user_is_org_admin(org_id)` | `user_is_org_admin()` | No | ✅ |
| 3 | `Admins can update org settings` | UPDATE | `org_id IS NULL OR user_is_org_admin(org_id)` | — | `user_is_org_admin()` | No | ✅ |
| 4 | `Admins can delete org settings` | DELETE | `org_id IS NULL OR user_is_org_admin(org_id)` | — | `user_is_org_admin()` | No | ✅ |

**Source:** All from `20260121_rls_auth_performance_fix.sql`.

---

## 4. `users`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view users` | SELECT | `id = (SELECT auth.uid()) OR user_belongs_to_org(org_id) OR is_super_admin()` | — | `user_belongs_to_org()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 2 | `Platform admins can view all users` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 3 | `Users can update users` | UPDATE | `id = (SELECT auth.uid()) OR user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can create users` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin()` | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 5 | `Admins can delete users` | DELETE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 6 | `Super admins can manage users` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1, 3–5 from `20260121_rls_auth_performance_fix.sql`; #2 from `20260211`; #6 from `20241213` (never dropped).  
**⚠️ ALL write policies and the main SELECT are BROKEN.** Only platform admin SELECT works.

---

## 5. `projects`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view org projects` | SELECT | `org_id IS NULL OR user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Admins can create projects` | INSERT | — | `org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id)` | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Admins can update projects` | UPDATE | `org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 4 | `Admins can delete projects` | DELETE | `org_id IS NULL OR user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |

**Source:** #1 from `20260121_rls_auth_performance_fix.sql`; #2–4 from `20260216_fix_missing_rls_policies.sql`.

---

## 6. `expense_accounts`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view org expense accounts` | SELECT | `user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Admins can create expense accounts` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Admins can update expense accounts` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 4 | `Admins can delete expense accounts` | DELETE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |

**Source:** #1 from `20250113_07_fix_data_isolation_complete.sql`; #2–4 from `20260216_fix_missing_rls_policies.sql`.

---

## 7. `categories`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view categories` | SELECT | `user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Admins can create categories` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Admins can update categories` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 4 | `Admins can delete categories` | DELETE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |

**Source:** #1 from `20250113_07_fix_data_isolation_complete.sql`; #2–4 from `20260216_fix_missing_rls_policies.sql`.

---

## 8. `uom_types`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view uom types` | SELECT | `user_belongs_to_org(org_id) OR is_super_admin(org_id)` | — | `user_belongs_to_org()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Admins can create uom types` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Admins can update uom types` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 4 | `Admins can delete uom types` | DELETE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |

**Source:** All from `20260216_fix_uom_types_rls_policies.sql`.

---

## 9. `items`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view items` | SELECT | `user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Members can create items in their org` | INSERT | — | `user_belongs_to_org(org_id) OR is_super_admin() OR get_user_role() = 'store_manager'` | `user_belongs_to_org()`, `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN |
| 3 | `Users can update items` | UPDATE | `user_belongs_to_org(org_id) AND (created_by = (SELECT auth.uid()) OR user_is_org_admin(org_id) OR is_super_admin(org_id) OR get_user_role(org_id) = 'store_manager')` | — | `user_belongs_to_org()`, `user_is_org_admin()`, `is_super_admin(org_id)`, `get_user_role(org_id)` | No | ✅ |
| 4 | `Admins can delete items` | DELETE | `user_is_org_admin(org_id) OR is_super_admin() OR get_user_role() = 'store_manager'` | — | `user_is_org_admin()`, `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN |
| 5 | `Admins and store managers can manage items` | ALL | `is_super_admin() OR get_user_role() = 'store_manager'` | `is_super_admin() OR get_user_role() = 'store_manager'` | `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20250113_07`; #2, #4 from `20260121_rls_auth_performance_fix.sql`; #3 from `20260215_workflow_role_migration.sql`; #5 from `20241213`.  
**⚠️ INSERT and DELETE are BROKEN.** Only SELECT and UPDATE work.

---

## 10. `requisitions`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view own requisitions` | SELECT | `((org_id IS NULL) OR user_belongs_to_org(org_id)) AND (submitted_by = (SELECT auth.uid()) OR user_is_org_admin(org_id) OR is_super_admin(org_id))` | — | `user_belongs_to_org()`, `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Users can create requisitions` | INSERT | — | `submitted_by = (SELECT auth.uid()) AND (org_id IS NULL OR user_belongs_to_org(org_id))` | `user_belongs_to_org()` | No | ✅ |
| 3 | `Users can update own requisitions` | UPDATE | `((org_id IS NULL) OR user_belongs_to_org(org_id)) AND (submitted_by = (SELECT auth.uid()) OR user_is_org_admin(org_id))` | — | `user_belongs_to_org()`, `user_is_org_admin()` | No | ✅ |
| 4 | `Users can delete requisitions` | DELETE | `is_super_admin(org_id) OR ((SELECT auth.uid()) = submitted_by AND status = 'draft')` | — | `is_super_admin(org_id)` | No | ✅ |
| 5 | `Super admins can manage all requisitions` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1, 4 from `20260215`; #2 from `20260121`; #3 from `20260122`; #5 from `20241213`.

---

## 11. `requisition_items`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view requisition items` | SELECT | `EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_items.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Users can insert requisition items` | INSERT | — | `EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_id AND r.submitted_by = (SELECT auth.uid()) AND (r.org_id IS NULL OR user_belongs_to_org(r.org_id)))` | `user_belongs_to_org()` | No | ✅ |
| 3 | `Users can update requisition items` | UPDATE | `user_belongs_to_org(org_id) AND (EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_items.requisition_id AND r.submitted_by = (SELECT auth.uid())) OR user_is_org_admin(org_id))` | — | `user_belongs_to_org()`, `user_is_org_admin()` | No | ✅ |
| 4 | `Users can delete requisition items` | DELETE | `user_belongs_to_org(org_id) AND (EXISTS (SELECT 1 FROM requisitions r WHERE r.id = requisition_items.requisition_id AND r.submitted_by = (SELECT auth.uid())) OR user_is_org_admin(org_id))` | — | `user_belongs_to_org()`, `user_is_org_admin()` | No | ✅ |
| 5 | `Super admins can manage requisition items` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20260215`; #2 from `20260121`; #3–4 from `20260122`; #5 from `20241213`.

---

## 12. `requisition_templates`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view own templates` | SELECT | `created_by = (SELECT auth.uid()) OR (org_id IS NOT NULL AND user_belongs_to_org(org_id))` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Users can create own templates` | INSERT | — | `created_by = (SELECT auth.uid()) AND (org_id IS NULL OR user_belongs_to_org(org_id))` | `user_belongs_to_org()` | No | ✅ |
| 3 | `Users can update own templates` | UPDATE | `created_by = (SELECT auth.uid())` | — | — | No | ✅ |
| 4 | `Users can delete own templates` | DELETE | `created_by = (SELECT auth.uid())` | — | — | No | ✅ |
| 5 | `Users can manage own templates` | ALL | `auth.uid() = created_by` | `auth.uid() = created_by` | — | No | ✅ (legacy from `20250112_02`, never dropped, redundant) |

**Source:** #1–2 from `20260121`; #3–4 from `20260122`; #5 from `20250112_02` (never dropped, uses `auth.uid()` directly so not affected by function change).

---

## 13. `requisition_template_items`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view own template items` | SELECT | `EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = (SELECT auth.uid()))` | — | — | No | ✅ |
| 2 | `Users can update own template items` | UPDATE | `EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = (SELECT auth.uid()))` | — | — | No | ✅ |
| 3 | `Users can delete own template items` | DELETE | `EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = (SELECT auth.uid()))` | — | — | No | ✅ |
| 4 | `Users can manage own template items` | ALL | `EXISTS (SELECT 1 FROM requisition_templates WHERE id = template_id AND created_by = auth.uid())` | Same | — | No | ✅ (legacy from `20250112_02`, never dropped, provides INSERT) |

**Source:** #1–3 from `20260122_complete_rls_cleanup`; #4 from `20250112_02` (never dropped; this is the only policy granting INSERT).

---

## 14. `comments`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view comments` | SELECT | `EXISTS (SELECT 1 FROM requisitions r WHERE r.id = comments.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Users can add comments` | INSERT | — | `user_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM requisitions r WHERE r.id = comments.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Users can update own comments` | UPDATE | `user_id = (SELECT auth.uid())` | `user_id = (SELECT auth.uid())` | — | No | ✅ |
| 4 | `Users can delete own comments` | DELETE | `user_id = (SELECT auth.uid())` | — | — | No | ✅ |

**Source:** #1 from `20260215`; #2 from `20260216_fix_missing`; #3–4 from `20260122`.

---

## 15. `attachments`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view attachments` | SELECT | `EXISTS (SELECT 1 FROM requisitions r WHERE r.id = attachments.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Users can upload attachments` | INSERT | — | `uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM requisitions r WHERE r.id = attachments.requisition_id AND r.submitted_by = auth.uid())` | — | No (bare `auth.uid()`) | ✅ (legacy from `20241213`, never dropped) |
| 3 | `Users can update own attachments` | UPDATE | `uploaded_by = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM requisitions r WHERE r.id = attachments.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | `uploaded_by = (SELECT auth.uid())` | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 4 | `Users can delete own attachments` | DELETE | `uploaded_by = (SELECT auth.uid())` | — | — | No | ✅ |

**Source:** #1 from `20260215`; #2 from `20241213` (never dropped); #3 from `20260216_fix_missing`; #4 from `20260122`.

---

## 16. `purchase_orders`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view purchase orders` | SELECT | `EXISTS (SELECT 1 FROM requisitions r WHERE r.id = purchase_orders.requisition_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Admins can create purchase orders` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin()` | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 3 | `Admins can update purchase orders` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can delete purchase orders` | DELETE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 5 | `Authorized users can manage purchase orders` | ALL | `is_super_admin() OR get_user_role() IN ('approver', 'store_manager')` | Same | `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20260215`; #2–4 from `20260121`; #5 from `20241213`.  
**⚠️ ALL write policies are BROKEN.** Only SELECT works.

---

## 17. `po_items`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view PO items` | SELECT | `EXISTS (SELECT 1 FROM purchase_orders po JOIN requisitions r ON r.id = po.requisition_id WHERE po.id = po_items.po_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Authorized users can manage PO items` | ALL | `is_super_admin() OR get_user_role() IN ('approver', 'store_manager')` | Same | `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20260215`; #2 from `20241213`.  
**⚠️ No working INSERT/UPDATE/DELETE policies exist.** Only SELECT works.

---

## 18. `receipt_transactions`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view receipt transactions` | SELECT | `user_belongs_to_org(org_id) OR is_super_admin()` | — | `user_belongs_to_org()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 2 | `Admins can create receipt transactions` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin()` | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 3 | `Admins can update receipt transactions` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can delete receipt transactions` | DELETE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 5 | `Store managers can manage receipts` | ALL | `is_super_admin() OR get_user_role() = 'store_manager'` | Same | `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1–4 from `20260121`; #5 from `20241213`.  
**⚠️ ALL policies are BROKEN.** Table is effectively inaccessible via RLS.

---

## 19. `receipt_items`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view receipt items` | SELECT | `EXISTS (SELECT 1 FROM receipt_transactions rt JOIN purchase_orders po ON po.id = rt.po_id JOIN requisitions r ON r.id = po.requisition_id WHERE rt.id = receipt_items.receipt_id AND (r.submitted_by = (SELECT auth.uid()) OR is_assigned_to_project(r.project_id) OR is_super_admin(r.org_id)))` | — | `is_assigned_to_project()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Admins can create receipt items` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin()` | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 3 | `Admins can update receipt items` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can delete receipt items` | DELETE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 5 | `Store managers can manage receipt items` | ALL | `is_super_admin() OR get_user_role() = 'store_manager'` | Same | `is_super_admin()`, `get_user_role()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20260215`; #2–4 from `20260121`; #5 from `20241213`.  
**⚠️ All write policies BROKEN.** Only SELECT works.

---

## 20. `user_project_assignments`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view project assignments` | SELECT | `user_id = (SELECT auth.uid()) OR user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 2 | `Admins can create project assignments` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin()` | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 3 | `Admins can update project assignments` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can delete project assignments` | DELETE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 5 | `Super admins can manage assignments` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN (legacy from `20241213`, never dropped) |

**Source:** #1 from `20260215`; #2–4 from `20260121`; #5 from `20241213`.  
**⚠️ All write policies BROKEN.** Only SELECT works.

---

## 21. `approval_workflows`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view org workflows` | SELECT | `user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Admins can create approval workflows` | INSERT | — | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 3 | `Admins can update approval workflows` | UPDATE | `user_is_org_admin(org_id) OR is_super_admin()` | — | `user_is_org_admin()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 4 | `Admins can delete approval workflows` | DELETE | `user_is_org_admin(org_id) OR is_super_admin(org_id)` | — | `user_is_org_admin()`, `is_super_admin(org_id)` | No | ✅ |
| 5 | `Admins can manage approval workflows` | ALL | `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')` | Same | — (direct query) | No | ✅ (legacy from `20250112_02`, never dropped; uses direct users.role check, not function) |

**Source:** #1 from `20250113_07`; #2 from `20260216_fix_missing`; #3 from `20260121` (BROKEN — was not recreated in fix migrations); #4 from `20260216_fix_missing`; #5 from `20250112_02`.  
**Note:** The legacy FOR ALL policy (#5) effectively provides UPDATE access for users with `users.role = 'super_admin'`, partially compensating for #3 being broken. But it checks the **global** `users.role`, not the per-org `workflow_role`.

---

## 22. `notifications`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view their org notifications` | SELECT | `user_id = (SELECT auth.uid()) AND ((org_id IS NULL) OR user_belongs_to_org(org_id))` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `System can create notifications` | INSERT | — | `user_belongs_to_org(org_id)` | `user_belongs_to_org()` | No | ✅ |
| 3 | `Service role can create notifications` | INSERT | — | `true` | — | — | ✅ (TO service_role) |
| 4 | `Users can update their own notifications` | UPDATE | `user_belongs_to_org(org_id) AND user_id = (SELECT auth.uid())` | — | `user_belongs_to_org()` | No | ✅ |
| 5 | `Users can delete their own notifications` | DELETE | `user_belongs_to_org(org_id) AND (user_id = (SELECT auth.uid()) OR user_is_org_admin(org_id))` | — | `user_belongs_to_org()`, `user_is_org_admin()` | No | ✅ |

**Source:** #1, 4–5 from `20260122`; #2 from `20260120_critical`; #3 from `20250112_11_restrict_audit_logs_FIX`.

---

## 23. `email_notifications`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Admins can view all email notifications` | SELECT | `is_super_admin()` | — | `is_super_admin()` (new, default-org fallback) | No | ✅ |
| — | *No INSERT policy* | INSERT | — | — | — | — | 🔒 SECURITY DEFINER function only |
| — | *No UPDATE policy* | UPDATE | — | — | — | — | 🔒 Edge Function only |
| — | *No DELETE policy* | DELETE | — | — | — | — | 🔒 |

**Source:** #1 from `20260215`. INSERT+UPDATE intentionally dropped in `20260121_fix_organizations_rls_policy.sql`.

---

## 24. `fiscal_year_settings`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view fiscal year settings` | SELECT | `user_belongs_to_org(org_id)` | — | `user_belongs_to_org()` | No | ✅ |
| 2 | `Only admins can update fiscal year settings` | UPDATE | `is_super_admin()` | — | `is_super_admin()` (new, default-org fallback) | No | ✅ |
| 3 | `Admins can manage fiscal year settings` | ALL | `EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin')` | Same | — (direct query) | No | ✅ (legacy from `20250112_02`, never dropped; grants INSERT/DELETE) |

**Source:** #1 from `20250113_07`; #2 from `20260215`; #3 from `20250112_02`.

---

## 25. `audit_logs`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Super admins can view audit logs` | SELECT | `is_super_admin()` | — | `is_super_admin()` | No | ⚠️ BROKEN |
| 2 | `Service role can insert audit logs` | INSERT | — | `true` | — | — | ✅ (TO service_role) |
| — | *No UPDATE policy* | UPDATE | — | — | — | — | 🔒 |
| — | *No DELETE policy* | DELETE | — | — | — | — | 🔒 |

**Source:** #1 from `20241213`; #2 from `20250112_11_restrict_audit_logs_FIX`.  
**⚠️ SELECT is BROKEN.** Audit logs are unreadable by anyone except via service role.

---

## 26. `security_audit_logs`

**RLS:** Enabled (since `20260120_audit_logging_security`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Admins can view security audit logs` | SELECT | `is_super_admin() OR user_is_org_owner(current_org_id)` | — | `is_super_admin()`, `user_is_org_owner()` | No | ⚠️ BROKEN |
| 2 | `Service role full access` | ALL | `true` | — | — | — | ✅ (TO service_role) |
| 3 | `Service role can insert security audit logs` | INSERT | — | `false` | — | — | ✅ (blocks authenticated direct inserts) |

**Source:** #1 from `20260121_rls_auth_performance_fix`; #2 from `20260120_audit_logging_security`; #3 from `20260121_fix_security_definer_views`.  
**⚠️ Authenticated SELECT is BROKEN.** Only service_role can read.

---

## 27. `project_accounts`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view project accounts` | SELECT | `is_assigned_to_project(project_id) OR is_super_admin()` | — | `is_assigned_to_project()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 2 | `Admins can manage project accounts` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN |

**Source:** Both from `20241213` (never updated for multi-tenancy, never re-created).  
**⚠️ ALL policies BROKEN.** Table is effectively inaccessible.

---

## 28. `account_items`

**RLS:** Enabled (since `20241213`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view account items` | SELECT | `EXISTS (SELECT 1 FROM project_accounts pa WHERE pa.id = account_items.project_account_id AND (is_assigned_to_project(pa.project_id) OR is_super_admin()))` | — | `is_assigned_to_project()`, `is_super_admin()` | No | ⚠️ BROKEN |
| 2 | `Admins can manage account items` | ALL | `is_super_admin()` | `is_super_admin()` | `is_super_admin()` | No | ⚠️ BROKEN |

**Source:** Both from `20241213` (never updated for multi-tenancy, never re-created).  
**⚠️ ALL policies BROKEN.** Table is effectively inaccessible.

---

## 29. `platform_admins`

**RLS:** Enabled (since `20260211`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Platform admins can view all admins` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |

**Source:** `20260211_platform_admin_system.sql`.  
**Note:** No INSERT/UPDATE/DELETE policies for `authenticated`. Management via service role or `is_platform_admin()` SECURITY DEFINER functions.

---

## 30. `platform_audit_log`

**RLS:** Enabled (since `20260211`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Platform admins can view audit log` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 2 | `Platform admins can insert audit log` | INSERT | — | `is_platform_admin()` | `is_platform_admin()` | No | ✅ |

**Source:** `20260211_platform_admin_system.sql`.

---

## 31. `platform_announcements`

**RLS:** Enabled (since `20260211`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Platform admins can manage announcements` | ALL | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 2 | `All users can view published announcements` | SELECT | `is_published = true AND (expires_at IS NULL OR expires_at > NOW())` | — | — | No | ✅ |

**Source:** `20260211_platform_admin_system.sql`.

---

## 32. `platform_feedback`

**RLS:** Enabled (since `20260211`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can create feedback` | INSERT | — | `auth.uid() = submitted_by` | — | No (bare `auth.uid()`) | ✅ |
| 2 | `Users can view all feedback` | SELECT | `true` | — | — | — | ✅ |
| 3 | `Platform admins can update feedback` | UPDATE | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |

**Source:** `20260211_platform_admin_system.sql`.

---

## 33. `platform_feedback_votes`

**RLS:** Enabled (since `20260211`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can manage own votes` | ALL | `auth.uid() = user_id` | — | — | No (bare `auth.uid()`) | ✅ |
| 2 | `Users can view all votes` | SELECT | `true` | — | — | — | ✅ |

**Source:** `20260211_platform_admin_system.sql`.

---

## 34. `billing_history`

**RLS:** Enabled (since `20260212_billing_system`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `billing_history_select` | SELECT | `EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = billing_history.organization_id AND om.user_id = auth.uid() AND om.is_active = true AND om.role IN ('owner', 'admin'))` | — | — (direct query) | No (bare `auth.uid()`) | ✅ |
| 2 | `Platform admins can view all billing history` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| — | *No INSERT policy* | INSERT | — | — | — | — | 🔒 Webhooks use service_role |

**Source:** #1 from `20260212_billing_system.sql`; #2 from `20260211_platform_admin_system.sql`.

---

## 35. `platform_login_attempts`

**RLS:** Enabled (since `20260212_admin_auth_hardening`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `platform_admins_read_login_attempts` | SELECT | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |
| 2 | `anyone_can_insert_login_attempts` | INSERT | — | `true` | — | — | ✅ |

**Source:** `20260212_admin_auth_hardening.sql`.

---

## 36. `platform_admin_sessions`

**RLS:** Enabled (since `20260212_admin_auth_hardening`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `platform_admins_manage_sessions` | ALL | `is_platform_admin()` | — | `is_platform_admin()` | No | ✅ |

**Source:** `20260212_admin_auth_hardening.sql`.

---

## 37. `rate_limit_log`

**RLS:** Enabled (since `20260120_rate_limiting`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `rate_limit_service_role_only` | ALL | `false` | — | — | — | ✅ (denies all user access; service_role only) |

**Source:** `20260120_rate_limiting.sql`.

---

## 38. `user_preferences`

**RLS:** Enabled (since `20250112_02`)

| # | Policy Name | Op | USING clause | WITH CHECK | Helper functions called | JWT direct? | Status |
|---|------------|-----|-------------|------------|------------------------|-------------|--------|
| 1 | `Users can view own preferences` | SELECT | `user_id = auth.uid()` | — | — | No (bare `auth.uid()`) | ✅ |
| 2 | `Users can manage own preferences` | ALL | `user_id = auth.uid()` | `user_id = auth.uid()` | — | No (bare `auth.uid()`) | ✅ |

**Source:** `20250112_02_features_and_settings.sql` (never overridden).

---

## Summary: Helper Function Usage Across All Policies

### `user_belongs_to_org(org_id)`
Used in **25+ active policies**. OID unchanged — all working.

### `user_is_org_admin(org_id)`
Used in **20+ active policies**. OID unchanged — all working.

### `user_is_org_owner(org_id)`
Used in: `organizations` UPDATE, `security_audit_logs` SELECT (broken context).

### `is_super_admin(check_org_id)` (NEW signature)
Used in **12 policies created post-20260215** — all working with `org_id` parameter.

### `is_super_admin()` (OLD signature — DROPPED OID)
Referenced by **~18 policies that are now BROKEN**.

### `get_user_role(check_org_id)` (NEW signature)
Used in: `items` UPDATE (post-20260215) — working.

### `get_user_role()` (OLD signature — DROPPED OID)
Referenced by **~5 policies that are now BROKEN**.

### `is_platform_admin()`
Used in **10 policies** (platform tables + cross-tenant) — all working.

### `is_assigned_to_project(project_id)`
Used in **6 active policies** (comments, attachments, requisition_items, purchase_orders, po_items, receipt_items SELECT) — all working.

### Direct `auth.uid()` (bare, not subqueried)
Used in: `platform_feedback` INSERT, `platform_feedback_votes` ALL, `billing_history` SELECT, `user_preferences` SELECT/ALL, `attachments` INSERT. **Performance concern** — re-evaluated per row.

### `(SELECT auth.uid())` (optimized subquery)
Used in most post-`20260121` policies. **Good pattern.**

### Direct `users.role = 'super_admin'` query (no helper function)
Used in: `fiscal_year_settings` FOR ALL, `approval_workflows` FOR ALL. **Survived function signature change** but checks global `users.role`, NOT the per-org `workflow_role` — **not multi-tenancy aware**.

---

## ⚠️ BROKEN Policies Summary (JWT Migration Priority)

These policies reference the old (dropped) `is_super_admin()` / `get_user_role()` OIDs and fail at evaluation:

| Table | Broken Operations | Impact |
|-------|------------------|--------|
| **users** | SELECT, INSERT, UPDATE, DELETE + legacy ALL | Users can't view/manage other users (only platform_admin SELECT works) |
| **items** | INSERT, DELETE + legacy ALL | Can't create or delete items |
| **purchase_orders** | INSERT, UPDATE, DELETE + legacy ALL | Can't create/edit/delete POs |
| **po_items** | legacy ALL (only policy for writes) | Can't create/edit/delete PO line items |
| **receipt_transactions** | SELECT, INSERT, UPDATE, DELETE + legacy ALL | **Entire table inaccessible** |
| **receipt_items** | INSERT, UPDATE, DELETE + legacy ALL | Can't create/edit/delete receipt items |
| **user_project_assignments** | INSERT, UPDATE, DELETE + legacy ALL | Can't manage assignments |
| **approval_workflows** | UPDATE (INSERT/DELETE fixed) | Can't update workflows (legacy ALL partially compensates) |
| **project_accounts** | SELECT + ALL | **Entire table inaccessible** |
| **account_items** | SELECT + ALL | **Entire table inaccessible** |
| **audit_logs** | SELECT | Audit logs unreadable |
| **security_audit_logs** | SELECT (authenticated) | Security logs unreadable (service_role still works) |

**Total: 12 tables with broken policies, ~30 individual broken policies.**

---

## Tables with NO JWT Claims Usage

**Zero policies currently read JWT claims directly.** All policies use:
- Helper functions (`user_belongs_to_org`, `user_is_org_admin`, `is_super_admin`, etc.)
- Direct `auth.uid()` calls
- Direct `users.role` table queries

The only function that reads JWT claims is `get_current_org_id()` (reads `request.jwt.claims->>'org_id'`), but this is used in the `set_org_id_on_insert()` trigger, NOT in any RLS policy.

**This means the JWT migration has a clean starting point — no policies need JWT claim removal, only JWT claim addition.**
