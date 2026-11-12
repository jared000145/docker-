import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import {MemoryRouter,Route,Routes} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {HelmetProvider} from 'react-helmet-async';
import PublicVerificationPage from '@/pages/PublicVerificationPage';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
function page(){return render(<HelmetProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/verify/releve/test']}><Routes><Route path="/verify/releve/:token" element={<PublicVerificationPage/>}/></Routes></MemoryRouter></QueryClientProvider></HelmetProvider>);}
afterEach(()=>{cleanup();rpc.mockReset();});
it('shows the verified student and snapshot result without requiring a login',async()=>{rpc.mockResolvedValue({data:{status:'verified',institution:'Université de test',year:'2026-2027',student:{first_name:'Aïcha',last_name:'QA',number:'QA-01',level:'L1'},results:{average:14.25,decision:'admis',credits:60,total_credits:60}}});page();expect(await screen.findByRole('heading',{name:'Document vérifié'})).toBeInTheDocument();expect(screen.getByText('14.25 / 20')).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Aïcha QA'})).toBeInTheDocument();expect(screen.queryByText('Connexion')).not.toBeInTheDocument();});
it('never presents a reopened or revoked document as valid',async()=>{rpc.mockResolvedValue({data:{status:'revoked'}});page();expect(await screen.findByRole('heading',{name:'Document retiré'})).toBeInTheDocument();expect(screen.queryByText('Résumé des résultats validés')).not.toBeInTheDocument();});
it('distinguishes an unavailable service from an unknown reference',async()=>{rpc.mockResolvedValue({data:null,error:{message:'network'}});page();expect(await screen.findByRole('heading',{name:'Vérification indisponible'},{timeout:4000})).toBeInTheDocument();expect(screen.queryByRole('heading',{name:'Référence introuvable'})).not.toBeInTheDocument();});
