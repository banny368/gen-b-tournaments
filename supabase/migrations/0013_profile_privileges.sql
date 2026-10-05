-- ============================================================
-- Gen B Tournaments — 0013: hotfix — profile_private write privileges
-- The blanket revoke in 0007 was followed by grants for SELECT/UPDATE
-- only; INSERT (and DELETE, e.g. re-inserting own row) were missing,
-- so users could not save date of birth / phone / state.
-- ============================================================

grant insert, delete, update on public.profile_private to authenticated;
