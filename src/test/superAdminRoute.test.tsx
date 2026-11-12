import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SuperAdminProtectedRoute from '@/components/SuperAdminProtectedRoute';

const state = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false, isSuperAdmin: false, isLoading: false }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state }));
vi.mock('@/hooks/useSuperAdmin', () => ({ useSuperAdmin: () => state }));
function Destination() { const location = useLocation(); return <div>{location.pathname + location.search}</div>; }
function open() {
  return render(<MemoryRouter initialEntries={['/super-admin/preinscriptions']}><Routes>
    <Route path="/super-admin/preinscriptions" element={<SuperAdminProtectedRoute><div>Demandes à valider</div></SuperAdminProtectedRoute>} />
    <Route path="/login" element={<Destination />} />
  </Routes></MemoryRouter>);
}
describe('super administrator entry', () => {
  it('sends a signed-out visitor to email login with the requested admin page', () => {
    state.user = null; state.isSuperAdmin = false;
    open();
    expect(screen.getByText('/login?mode=email&next=%2Fsuper-admin%2Fpreinscriptions')).toBeInTheDocument();
  });
  it('opens the existing page for the authenticated super administrator', () => {
    state.user = { id: 'owner' }; state.isSuperAdmin = true;
    open();
    expect(screen.getByText('Demandes à valider')).toBeInTheDocument();
  });
});
