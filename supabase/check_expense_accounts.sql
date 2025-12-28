-- Check expense accounts and their project assignments
SELECT
  ea.code AS expense_account_code,
  ea.name AS expense_account_name,
  p.code AS project_code,
  p.name AS project_name,
  ea.project_id
FROM expense_accounts ea
LEFT JOIN projects p ON ea.project_id = p.id
ORDER BY p.code, ea.code;
