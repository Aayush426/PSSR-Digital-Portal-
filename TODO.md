# TODO - Hard delete initiator assignment (keep user row)

- [ ] Inspect/confirm current UI behavior for revoke/assign initiator in `Frontend/src/pages/admin/DashboardPage.tsx`.
- [x] Backend: add hard-delete endpoint in `backend/app/routes/pssr.py`.
- [x] Backend: add service method in `backend/app/services/initiator_service.py` to delete assignment row (no user deactivation).
- [ ] Frontend: add API client method in `Frontend/src/services/api.ts`.
- [ ] Frontend: wire DashboardPage “Revoke Initiator” button to hard delete endpoint (rename label if needed).
- [ ] Invalidate correct React Query keys after deletion.

- [ ] Run backend + frontend build/typecheck to ensure compilation.

