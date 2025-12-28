# Database Migration Consolidation Plan

## Executive Summary

The current migration structure has **29 migration files**, with **7+ notification-related fix migrations** created on December 21st alone. This creates maintenance complexity and deployment risk.

## Current State Analysis

### Migration Categories

1. **Core Schema (Dec 13)** - KEEP AS-IS
   - `20241213_initial_schema.sql` - Base tables
   - `20241213_rls_policies.sql` - Security policies
   - `20241213_helper_functions.sql` - **OUTDATED** (has old 6-param notification function)
   - `20241213_seed_data.sql` - Initial data

2. **Feature Additions (Dec 16-18)** - CONSOLIDATE
   - `20241216_system_settings.sql`
   - `20241216_user_preferences.sql`
   - `20241218_categories_and_auto_codes.sql`
   - `20241218_requisition_templates.sql`

3. **Bug Fixes (Dec 18)** - CONSOLIDATE
   - `20241218_fix_item_code_generation.sql`
   - `20241218_fix_generate_item_code_function.sql`
   - `20241218_fix_budget_validation.sql`

4. **Schema Changes (Dec 18-19)** - REVIEW & CONSOLIDATE
   - `20241218_flexible_project_budgeting.sql` - Made project_account_id nullable
   - `20241219_cleanup_project_accounts.sql`
   - `20241219_add_project_to_expense_accounts.sql`
   - `20241219_restore_budget_validation.sql`

5. **Notification System (Dec 19-21)** - **CRITICAL - CONSOLIDATE**
   - `20241219_notifications_system.sql` - Original (used ENUM)
   - `20241219_notifications_system_safe.sql` - Safe version
   - `20241219_notifications_repair.sql` - Added missing columns
   - `20241221_fix_notification_type.sql` - Fixed type issues
   - `20241221_fix_notification_workflow.sql` - V1 fix
   - `20241221_fix_notification_workflow_v2.sql` - V2 fix
   - `20241221_complete_reset.sql` - Nuclear option
   - `20241221_fix_for_actual_schema.sql` - Schema matching
   - `20241221_handle_direct_approval.sql` - NULL handling
   - `20241221_final_notification_fix.sql` - "Final" fix
   - `20241221_ultimate_fix.sql` - **ACTUAL WORKING VERSION** ✓

6. **Diagnostic** - DELETE
   - `20241221_diagnostic_check.sql` - Not a migration

7. **Other**
   - `20241221_fix_rls_circular_dependency.sql` - Keep
   - `20241219_cleanup_test_data.sql` - Keep

## Recommended Consolidation Strategy

### Option A: Fresh Baseline (RECOMMENDED)

**Best for:** Production deployment

**Steps:**
1. Export current working schema using `pg_dump`
2. Create single baseline migration `20241222_consolidated_baseline.sql`
3. Archive old migrations to `migrations/archive/`
4. Test on fresh database instance
5. Deploy to production

**Pros:**
- Clean slate
- No migration history baggage
- Easy to understand
- Reduces deployment time

**Cons:**
- Requires fresh database or careful migration tracking
- Loses granular history

### Option B: Keep Core + Consolidate Fixes (SAFER)

**Best for:** Existing deployed database

**Steps:**
1. Keep Dec 13 core migrations (4 files)
2. Create `20241222_features_and_fixes.sql` combining Dec 16-18
3. Create `20241222_notification_system_final.sql` = ultimate_fix.sql
4. Archive all other Dec 21 notification files

**Pros:**
- Preserves core migration history
- Safer for existing deployments
- Still achieves 70% reduction (29 → 9 files)

**Cons:**
- Some historical complexity remains

## Proposed Consolidated Structure

```
supabase/migrations/
├── 20241213_initial_schema.sql              [KEEP]
├── 20241213_rls_policies.sql                [KEEP]
├── 20241213_seed_data.sql                   [KEEP]
├── 20241222_helper_functions_v2.sql         [NEW - Updated]
├── 20241222_features_consolidated.sql       [NEW]
├── 20241222_notification_system_final.sql   [NEW]
└── archive/                                  [ARCHIVE OLD]
    ├── 20241213_helper_functions.sql
    ├── 20241216_system_settings.sql
    ├── (... all notification fixes ...)
    └── README.md (explains what's archived)
```

**Result:** 29 files → 6 files (79% reduction)

## Migration File Specs

### 1. `20241222_helper_functions_v2.sql`

**Purpose:** Replace old helper_functions.sql with updated versions

**Changes from original:**
- Remove old `create_notification` (6-param with ENUM)
- Remove old `notify_requisition_status_change`
- Remove old `notify_new_comment`
- Keep all other helper functions (PO numbers, totals, etc.)

**Status:** READY TO CREATE

### 2. `20241222_features_consolidated.sql`

**Purpose:** Combine all feature additions and fixes

**Includes:**
- System settings tables
- User preferences
- Item categories
- Auto-code generation (FIXED)
- Budget validation (FIXED)
- Requisition templates
- Flexible project budgeting

**Status:** NEEDS REVIEW & CONSOLIDATION

### 3. `20241222_notification_system_final.sql`

**Purpose:** Final working notification system

**Content:** Direct copy of `20241221_ultimate_fix.sql`

**Includes:**
- Notification tables (if not in initial schema)
- create_notification (5-param, TEXT types)
- create_notification_for_users
- notify_on_requisition_status_change (handles NULL reviewed_by)
- notify_new_comment (updated to 5-param)
- All triggers

**Status:** READY TO CREATE (copy ultimate_fix.sql)

## Implementation Checklist

- [ ] Backup production database
- [ ] Test current schema export
- [ ] Create `migrations/archive/` directory
- [ ] Create new consolidated migrations
- [ ] Test on fresh local database
- [ ] Test on staging database
- [ ] Verify all features work
- [ ] Document migration strategy
- [ ] Update deployment docs
- [ ] Deploy to production

## Risk Mitigation

### Pre-Deployment
1. Full database backup
2. Test restore procedure
3. Test rollback procedure
4. Staging environment validation

### During Deployment
1. Maintenance window
2. Read-only mode during migration
3. Incremental testing
4. Rollback plan ready

### Post-Deployment
1. Verify all features
2. Check notification system
3. Test requisition workflow
4. Monitor error logs
5. Keep old migrations accessible for 30 days

## Timeline Estimate

- **Planning & Review:** 2 hours
- **Creating Consolidated Migrations:** 4 hours
- **Testing on Local DB:** 2 hours
- **Staging Validation:** 2 hours
- **Documentation:** 1 hour
- **Production Deployment:** 1 hour
- **Post-Deployment Validation:** 1 hour

**Total:** ~13 hours (2 working days)

## Next Steps

1. **IMMEDIATE:** Create backup of current database
2. **TODAY:** Create `20241222_notification_system_final.sql` (copy ultimate_fix)
3. **THIS WEEK:** Create consolidated feature migration
4. **THIS WEEK:** Test on fresh database
5. **NEXT WEEK:** Deploy to staging
6. **FOLLOWING WEEK:** Deploy to production

## Notes

- The `20241221_ultimate_fix.sql` is the WORKING notification system
- All previous notification migrations can be safely archived
- The helper_functions.sql file needs updating to remove old notification functions
- Consider adding migration validation tests

---

**Created:** December 21, 2024
**Status:** DRAFT - Awaiting Approval
**Priority:** HIGH - 29 files is excessive for production
