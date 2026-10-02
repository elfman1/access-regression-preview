# Synthetic benchmark

2026-10-01T04:28:02.105Z

Synthetic PostgreSQL RLS only; no Supabase HTTP, JWT validation, Storage or Realtime coverage

The benchmark passes when healthy cases pass, deliberately broken cases fail, and infrastructure mistakes produce errors. These results are not customer validation or competitor superiority.

| Case | Expected | Observed | Detail |
|---|---|---|---|
| healthy_read | pass | pass | Expected permissions observed |
| healthy_anonymous | pass | pass | Expected permissions observed |
| healthy_insert | pass | pass | Expected permissions observed |
| healthy_update | pass | pass | Expected permissions observed |
| healthy_delete | pass | pass | Expected permissions observed |
| healthy_move | pass | pass | Expected permissions observed |
| healthy_removed | pass | pass | Expected permissions observed |
| healthy_demoted | pass | pass | Expected permissions observed |
| rls_disabled | fail | fail | Other tenant invoice visible |
| read_everyone | fail | fail | Other tenant invoice visible |
| insert_everywhere | fail | fail | Forbidden write returned changed rows |
| update_everywhere | fail | fail | Forbidden write returned changed rows |
| delete_everywhere | fail | fail | Forbidden write returned changed rows |
| tenant_transfer | fail | fail | Forbidden write returned changed rows |
| stale_membership | fail | fail | Second tenant fixture missing |
| stale_owner_claim | fail | fail | Forbidden write returned changed rows |
| anonymous_read | fail | fail | Anonymous invoice visible |
| member_can_update | fail | fail | Forbidden write returned changed rows |
| member_can_delete | fail | fail | Forbidden write returned changed rows |
| permissive_policy_bypass | fail | fail | Other tenant invoice visible |
| empty_fixture | fail | fail | Authorized fixture missing |
| broken_setup | error | error | function nonexistent_function() does not exist |
| missing_table | error | error | relation "invoices" does not exist |

Unexpected results: 0
