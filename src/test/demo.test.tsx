import { fireEvent, render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import DemoPage from '@/pages/DemoPage';

function renderDemo(module = 'eleves') {
  return render(<HelmetProvider><MemoryRouter initialEntries={[`/apercu?module=${module}`]}><DemoPage /></MemoryRouter></HelmetProvider>);
}
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('isolated local demonstration', () => {
  it('adds a fictional pupil, filters the roster and restores the saved data', () => {
    const rendered = renderDemo();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un élève' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nom complet'), { target: { value: 'Camille Test' } });
    fireEvent.change(within(dialog).getByLabelText('Classe'), { target: { value: 'Première B' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ajouter le dossier' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un élève' }), { target: { value: 'Camille Test' } });
    expect(screen.getByText('Camille Test')).toBeInTheDocument();
    expect(screen.queryByText('Anaïs Morel')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('rectorplus-demo-v1')!).length).toBe(7);
    rendered.unmount();
    renderDemo();
    expect(screen.getByText('Camille Test')).toBeInTheDocument();
  });
  it('recalculates a grade and simulates a payment in the local sample only', () => {
    renderDemo('notes');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Note de Anaïs Morel' }), { target: { value: '18' } });
    expect(JSON.parse(localStorage.getItem('rectorplus-demo-v1')!)[0].grade).toBe(18);
    fireEvent.click(screen.getByRole('button', { name: 'Paiements' }));
    const row = screen.getByText('Lucas Ndiaye').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Simuler le règlement' }));
    expect(within(row).getByText('À jour')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Aucun paiement réel effectué');
    const lucas = JSON.parse(localStorage.getItem('rectorplus-demo-v1')!).find((student: { id: string }) => student.id === 'EH-002');
    expect(lucas.paid).toBe(lucas.due);
  });
  it('handles an empty search and invalid saved sample data', () => {
    localStorage.setItem('rectorplus-demo-v1', '[{"id":"corrupt"}]');
    renderDemo();
    expect(screen.getByText('Anaïs Morel')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inconnu' } });
    expect(screen.getByText('Aucun élève trouvé')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }));
    expect(screen.getByText('Anaïs Morel')).toBeInTheDocument();
  });
});
