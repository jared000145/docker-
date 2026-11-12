import InitialPasswordGate from '@/components/account/InitialPasswordGate';
const PublicVerificationPage = lazyRetry(() => import('./pages/PublicVerificationPage'));
import { Suspense } from "react";
import PageSkeleton from "@/components/loading/PageSkeleton";
import { lazyRetry } from "@/lib/lazyRetry";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieConsentBanner from "@/components/privacy/CookieConsentBanner";
import { AuthProvider } from "@/hooks/useAuth";
import RealtimeAccess from '@/components/RealtimeAccess';
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import ProfessorProtectedRoute from "@/components/ProfessorProtectedRoute";
import SuperAdminProtectedRoute from "@/components/SuperAdminProtectedRoute";
import ParentProtectedRoute from "@/components/ParentProtectedRoute";
import LoginPage from "./pages/LoginPage";
const DemoPage = lazyRetry(() => import('./pages/DemoPage'));
import OAuthConsentPage from "./pages/OAuthConsentPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardLayout from "./components/DashboardLayout";
import AdminLayout from "./components/AdminLayout";
import ProfessorLayout from "./components/ProfessorLayout";
import SuperAdminLayout from "./components/SuperAdminLayout";
import ParentLayout from "./components/ParentLayout";
import './styles/workspace.css';
import './styles/platform.css';

const LandingPage = lazyRetry(() => import("./pages/LandingPage"));
const AccountPage = lazyRetry(() => import('./pages/AccountPage'));
const ContactPage = lazyRetry(() => import("./pages/ContactPage"));
const LogicielGestionScolairePage = lazyRetry(() => import("./pages/marketing/LogicielGestionScolairePage"));
const PlateformeUniversitePage = lazyRetry(() => import("./pages/marketing/PlateformeUniversitePage"));
const SchoolManagementSystemPage = lazyRetry(() => import("./pages/marketing/SchoolManagementSystemPage"));
const BlogPage = lazyRetry(() => import("./pages/marketing/BlogPage"));
const BlogArticlePage = lazyRetry(() => import("./pages/marketing/BlogArticlePage"));
const CguPage = lazyRetry(() => import("./pages/marketing/CguPage"));
const ConfidentialitePage = lazyRetry(() => import("./pages/marketing/ConfidentialitePage"));
const DocumentationPage = lazyRetry(() => import("./pages/marketing/DocumentationPage"));
const UnsubscribePage = lazyRetry(() => import("./pages/UnsubscribePage"));
const DashboardPage = lazyRetry(() => import("./pages/DashboardPage"));
const GradesPage = lazyRetry(() => import("./pages/GradesPage"));
const CoursesPage = lazyRetry(() => import("./pages/CoursesPage"));
const CalendarPage = lazyRetry(() => import("./pages/CalendarPage"));
const PaymentsPage = lazyRetry(() => import("./pages/PaymentsPage"));
const CurriculumPage = lazyRetry(() => import("./pages/CurriculumPage"));
const StudentMessagesPage = lazyRetry(() => import("./pages/StudentMessagesPage"));
const StudentNotificationsPage = lazyRetry(() => import("./pages/StudentNotificationsPage"));
const StudentEventsPage = lazyRetry(() => import("./pages/StudentEventsPage"));
const StudentSoutenancesPage = lazyRetry(() => import("./pages/StudentSoutenancesPage"));
const StudentBDEPage = lazyRetry(() => import("./pages/StudentBDEPage"));
const CommunityPage = lazyRetry(() => import("./pages/CommunityPage"));
const StudentVisioPage = lazyRetry(() => import("./pages/StudentVisioPage"));
const ProfileSettingsPage = lazyRetry(() => import("./pages/ProfileSettingsPage"));
const GoogleLinkCallbackPage = lazyRetry(() => import("./pages/GoogleLinkCallbackPage"));
const StudentCardPage = lazyRetry(() => import("./pages/StudentCardPage"));
const StudentLibraryPage = lazyRetry(() => import("./pages/StudentLibraryPage"));
const StudentAbsencesPage = lazyRetry(() => import("./pages/StudentAbsencesPage"));
const AdminDashboardPage = lazyRetry(() => import("./pages/admin/AdminDashboardPage"));
const AdminStudentsPage = lazyRetry(() => import("./pages/admin/AdminStudentsPage"));
const AdminSubjectsPage = lazyRetry(() => import("./pages/admin/AdminSubjectsPage"));
const AdminGradesPage = lazyRetry(() => import("./pages/admin/AdminGradesPage"));
const AdminPaymentsPage = lazyRetry(() => import("./pages/admin/AdminPaymentsPage"));
const AdminSchedulePage = lazyRetry(() => import("./pages/admin/AdminSchedulePage"));
const AdminNotificationsPage = lazyRetry(() => import("./pages/admin/AdminNotificationsPage"));
const AdminMessagesPage=lazyRetry(()=>import('./pages/admin/AdminMessagesPage'));
const AdminFilieresPage = lazyRetry(() => import("./pages/admin/AdminFilieresPage"));
const AdminFiliereLevelPage = lazyRetry(() => import("./pages/admin/AdminFiliereLevelPage"));
const AdminProfessorsPage = lazyRetry(() => import("./pages/admin/AdminProfessorsPage"));
const AdminEventsPage = lazyRetry(() => import("./pages/admin/AdminEventsPage"));
const AdminSoutenancesPage = lazyRetry(() => import("./pages/admin/AdminSoutenancesPage"));
const AdminBDEPage = lazyRetry(() => import("./pages/admin/AdminBDEPage"));
const AdminSettingsPage = lazyRetry(() => import("./pages/admin/AdminSettingsPage"));
const AdminRattrapagesPage = lazyRetry(() => import("./pages/admin/AdminRattrapagesPage"));
const AdminStudentDetailPage = lazyRetry(() => import("./pages/admin/AdminStudentDetailPage"));
const AdminLibraryPage = lazyRetry(() => import("./pages/admin/AdminLibraryPage"));
const AdminUEsPage = lazyRetry(() => import("./pages/admin/AdminUEsPage"));
const AdminAcademicSettingsPage = lazyRetry(() => import("./pages/admin/AdminAcademicSettingsPage"));
const AdminAttendancePage = lazyRetry(() => import("./pages/admin/AdminAttendancePage"));
const AdminStudentYearsPage = lazyRetry(() => import("./pages/admin/AdminStudentYearsPage"));
const AdminTeamPage = lazyRetry(() => import("./pages/admin/AdminTeamPage"));
const AdminClassroomsPage = lazyRetry(() => import("./pages/admin/AdminClassroomsPage"));
const AdminParentsPage = lazyRetry(() => import("./pages/admin/AdminParentsPage"));
const AdminFinancePage = lazyRetry(() => import("./pages/admin/AdminFinancePage"));
const AdminFinancesPage = lazyRetry(() => import("./pages/admin/AdminFinancesPage"));
const AdminClosurePage = lazyRetry(() => import("./pages/admin/AdminClosurePage"));
const AdminClosureTrimestrePage = lazyRetry(() => import("./pages/admin/AdminClosureTrimestrePage"));
const ParentLoginPage = lazyRetry(() => import("./pages/parent/ParentLoginPage"));
const ParentDashboardPage = lazyRetry(() => import("./pages/parent/ParentDashboardPage"));
const ParentNotesPage = lazyRetry(() => import("./pages/parent/ParentNotesPage"));
const ParentAbsencesPage = lazyRetry(() => import("./pages/parent/ParentAbsencesPage"));
const ParentPaiementsPage = lazyRetry(() => import("./pages/parent/ParentPaiementsPage"));
const ParentPlanningPage = lazyRetry(() => import("./pages/parent/ParentPlanningPage"));
const ParentDocumentsPage = lazyRetry(() => import("./pages/parent/ParentDocumentsPage"));
const ParentNotificationsPage = lazyRetry(() => import("./pages/parent/ParentNotificationsPage"));
const ProfessorDashboardPage = lazyRetry(() => import("./pages/professor/ProfessorDashboardPage"));
const ProfessorSubjectsPage = lazyRetry(() => import("./pages/professor/ProfessorSubjectsPage"));
const ProfessorGradesPage = lazyRetry(() => import("./pages/professor/ProfessorGradesPage"));
const ProfessorSchedulePage = lazyRetry(() => import("./pages/professor/ProfessorSchedulePage"));
const ProfessorMessagesPage = lazyRetry(() => import("./pages/professor/ProfessorMessagesPage"));
const ProfessorNotificationsPage = lazyRetry(() => import("./pages/professor/ProfessorNotificationsPage"));
const ProfessorVisioPage = lazyRetry(() => import("./pages/professor/ProfessorVisioPage"));
const ProfessorAttendancePage = lazyRetry(() => import("./pages/professor/ProfessorAttendancePage"));
const ProfessorSettingsPage = lazyRetry(() => import("./pages/professor/ProfessorSettingsPage"));

const SuperAdminDashboardPage = lazyRetry(() => import("./pages/superadmin/SuperAdminDashboardPage"));
const SuperAdminInstitutionsPage = lazyRetry(() => import("./pages/superadmin/SuperAdminInstitutionsPage"));
const SuperAdminAdminsPage = lazyRetry(() => import("./pages/superadmin/SuperAdminAdminsPage"));
const SuperAdminSubscriptionsPage = lazyRetry(() => import("./pages/superadmin/SuperAdminSubscriptionsPage"));
const SuperAdminBackupsPage = lazyRetry(() => import("./pages/superadmin/SuperAdminBackupsPage"));
const SuperAdminImportPage = lazyRetry(() => import("./pages/superadmin/SuperAdminImportPage"));
const SuperAdminFinancePage = lazyRetry(() => import("./pages/superadmin/SuperAdminFinancePage"));
const SuperAdminRestorePage = lazyRetry(() => import("./pages/superadmin/SuperAdminRestorePage"));
const SuperAdminPreregistrationsPage = lazyRetry(() => import("./pages/superadmin/SuperAdminPreregistrationsPage"));
const PreregistrationPage = lazyRetry(() => import("./pages/PreregistrationPage"));
const AdminAccessControlPage = lazyRetry(() => import("./pages/admin/AdminAccessControlPage"));
const AdminAuditPage = lazyRetry(() => import("./pages/admin/AdminAuditPage"));
const AdminExclusionsPage = lazyRetry(() => import("./pages/admin/AdminExclusionsPage"));
const AdminCyclesPage = lazyRetry(() => import("./pages/admin/AdminCyclesPage"));
const AdminClassesPage = lazyRetry(() => import("./pages/admin/AdminClassesPage"));
const AdminGroupsPage = lazyRetry(() => import("./pages/admin/AdminGroupsPage"));
const AdminGradesTrimestrePage = lazyRetry(() => import("./pages/admin/AdminGradesTrimestrePage"));
const AdminPVPage = lazyRetry(() => import("./pages/admin/AdminPVPage"));
const AdminApplicationsPage = lazyRetry(() => import("./pages/admin/AdminApplicationsPage"));
const AdminAdmissionsPage = lazyRetry(() => import("./pages/admin/AdminAdmissionsPage"));
const OrientationPage = lazyRetry(() => import("./pages/OrientationPage"));
const StudentApplicationsPage = lazyRetry(() => import("./pages/ApplicationsPage"));
const LyceeVerifyPage = lazyRetry(() => import("./pages/LyceeVerifyPage"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const BulletinVerifyPage = lazyRetry(() => import("./pages/BulletinVerifyPage"));
const ReceiptVerifyPage = lazyRetry(() => import("./pages/ReceiptVerifyPage"));
const AttestationVerifyPage = lazyRetry(() => import("./pages/AttestationVerifyPage"));
const DocumentVerifyPage = lazyRetry(() => import("./pages/DocumentVerifyPage"));
const DirectorLayout = lazyRetry(() => import("./components/DirectorLayout"));
const DirectorProtectedRoute = lazyRetry(() => import("./components/DirectorProtectedRoute"));
const DirectorCampusesPage = lazyRetry(() => import("./pages/director/DirectorCampusesPage"));
const DirectorDashboardPage = lazyRetry(() => import("./pages/director/DirectorDashboardPage"));
const DirectorDocumentsPage = lazyRetry(() => import("./pages/director/DirectorDocumentsPage"));
const DirectorReportsPage = lazyRetry(() => import("./pages/director/DirectorReportsPage"));
const DirectorFinancePage = lazyRetry(() => import("./pages/director/DirectorFinancePage"));
const DirectorSignaturePage = lazyRetry(() => import("./pages/director/DirectorSignaturePage"));
const DirectorNotificationsPage = lazyRetry(() => import("./pages/director/DirectorNotificationsPage"));
const ValidatorLayout = lazyRetry(() => import("./components/ValidatorLayout"));
const ValidatorProtectedRoute = lazyRetry(() => import("./components/ValidatorProtectedRoute"));
const ValidatorDocumentsPage = lazyRetry(() => import("./pages/validator/ValidatorDocumentsPage"));
const ValidatorSignaturePage = lazyRetry(() => import("./pages/validator/ValidatorSignaturePage"));
const ValidatorDashboardPage = lazyRetry(() => import("./pages/validator/ValidatorDashboardPage"));
import { VALIDATOR_ROLES } from "@/lib/validatorRoles";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
  },
});

const ProtectedDashboard = () => (
  <ProtectedRoute><InitialPasswordGate><DashboardLayout /></InitialPasswordGate></ProtectedRoute>
);
const ProtectedAdmin = () => (
  <AdminProtectedRoute><InitialPasswordGate><AdminLayout /></InitialPasswordGate></AdminProtectedRoute>
);
const ProtectedProfessor = () => (
  <ProfessorProtectedRoute><InitialPasswordGate><ProfessorLayout /></InitialPasswordGate></ProfessorProtectedRoute>
);
const ProtectedSuperAdmin = () => (
  <SuperAdminProtectedRoute><InitialPasswordGate><SuperAdminLayout /></InitialPasswordGate></SuperAdminProtectedRoute>
);
const ProtectedParent = () => (
  <ParentProtectedRoute><InitialPasswordGate><ParentLayout /></InitialPasswordGate></ParentProtectedRoute>
);

const PageLoader = () => <PageSkeleton />;


/* Helper: generate admin-like routes under a given prefix with a given wrapper */
function adminRoutes(prefix: string, Wrapper: React.ComponentType) {
  return (
    <>
      <Route path={`${prefix}/filieres`} element={<Wrapper />}><Route index element={<AdminFilieresPage />} /></Route>
      <Route path={`${prefix}/filieres/:filiereId/:level`} element={<Wrapper />}><Route index element={<AdminFiliereLevelPage />} /></Route>
      <Route path={`${prefix}/students`} element={<Wrapper />}><Route index element={<AdminStudentsPage />} /></Route>
      <Route path={`${prefix}/students/:userId`} element={<Wrapper />}><Route index element={<AdminStudentDetailPage />} /></Route>
      <Route path={`${prefix}/professors`} element={<Wrapper />}><Route index element={<AdminProfessorsPage />} /></Route>
      <Route path={`${prefix}/subjects`} element={<Wrapper />}><Route index element={<AdminSubjectsPage />} /></Route>
      <Route path={`${prefix}/grades`} element={<Wrapper />}><Route index element={<AdminGradesPage />} /></Route>
      {/* /payments retired — redirected to /finances (kept as alias) */}
      <Route path={`${prefix}/payments`} element={<Wrapper />}><Route index element={<AdminFinancesPage />} /></Route>
      <Route path={`${prefix}/schedule`} element={<Wrapper />}><Route index element={<AdminSchedulePage />} /></Route>
      <Route path={`${prefix}/events`} element={<Wrapper />}><Route index element={<AdminEventsPage />} /></Route>
      <Route path={`${prefix}/soutenances`} element={<Wrapper />}><Route index element={<AdminSoutenancesPage />} /></Route>
      <Route path={`${prefix}/bde`} element={<Wrapper />}><Route index element={<AdminBDEPage />} /></Route>
      <Route path={`${prefix}/notifications`} element={<Wrapper />}><Route index element={<AdminNotificationsPage />} /></Route>
      <Route path={`${prefix}/messages`} element={<Wrapper />}><Route index element={<AdminMessagesPage />} /></Route>
      <Route path={`${prefix}/rattrapages`} element={<Wrapper />}><Route index element={<AdminRattrapagesPage />} /></Route>
      <Route path={`${prefix}/settings`} element={<Wrapper />}><Route index element={<AdminSettingsPage />} /></Route>
      <Route path={`${prefix}/library`} element={<Wrapper />}><Route index element={<AdminLibraryPage />} /></Route>
      <Route path={`${prefix}/ues`} element={<Wrapper />}><Route index element={<AdminUEsPage />} /></Route>
      <Route path={`${prefix}/academic-settings`} element={<Wrapper />}><Route index element={<AdminAcademicSettingsPage />} /></Route>
      <Route path={`${prefix}/attendance`} element={<Wrapper />}><Route index element={<AdminAttendancePage />} /></Route>
      <Route path={`${prefix}/student-years`} element={<Wrapper />}><Route index element={<Navigate to={`${prefix}/access-control`} replace />} /></Route>
      <Route path={`${prefix}/team`} element={<Wrapper />}><Route index element={<AdminTeamPage />} /></Route>
      <Route path={`${prefix}/classrooms`} element={<Wrapper />}><Route index element={<AdminClassroomsPage />} /></Route>
      <Route path={`${prefix}/parents`} element={<Wrapper />}><Route index element={<AdminParentsPage />} /></Route>
      <Route path={`${prefix}/finance`} element={<Wrapper />}><Route index element={<AdminFinancePage />} /></Route>
      <Route path={`${prefix}/finances`} element={<Wrapper />}><Route index element={<AdminFinancesPage />} /></Route>
      <Route path={`${prefix}/finances/verify-receipt`} element={<Wrapper />}><Route index element={<AdminFinancesPage />} /></Route>
      <Route path={`${prefix}/closure`} element={<Wrapper />}><Route index element={<AdminClosurePage />} /></Route>
      <Route path={`${prefix}/closure-trimestre`} element={<Wrapper />}><Route index element={<AdminClosureTrimestrePage />} /></Route>
      <Route path={`${prefix}/access-control`} element={<Wrapper />}><Route index element={<AdminAccessControlPage />} /></Route>
      <Route path={`${prefix}/audit`} element={<Wrapper />}><Route index element={<AdminAuditPage />} /></Route>
      <Route path={`${prefix}/exclusions`} element={<Wrapper />}><Route index element={<AdminExclusionsPage />} /></Route>
      <Route path={`${prefix}/cycles`} element={<Wrapper />}><Route index element={<AdminCyclesPage />} /></Route>
      <Route path={`${prefix}/classes`} element={<Wrapper />}><Route index element={<AdminClassesPage />} /></Route>
      <Route path={`${prefix}/groups`} element={<Wrapper />}><Route index element={<AdminGroupsPage />} /></Route>
      <Route path={`${prefix}/grades-trimestre`} element={<Wrapper />}><Route index element={<AdminGradesTrimestrePage />} /></Route>
      <Route path={`${prefix}/pv`} element={<Wrapper />}><Route index element={<AdminPVPage />} /></Route>
      <Route path={`${prefix}/applications`} element={<Wrapper />}><Route index element={<AdminApplicationsPage />} /></Route>
      <Route path={`${prefix}/admissions`} element={<Wrapper />}><Route index element={<AdminAdmissionsPage />} /></Route>
    </>
  );
}


import { useNotificationCenter } from "@/hooks/useNotificationCenter";
const NotificationCenter = () => { useNotificationCenter(); return null; };
import { useMessagePresence } from "@/hooks/useMessagePresence";
const MessagePresence = () => { useMessagePresence(); return null; };
import PushPrompt from "@/components/PushPrompt";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <RealtimeAccess />
        <NotificationCenter />
        <PushPrompt />
        <MessagePresence />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CookieConsentBanner />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={Capacitor.isNativePlatform() ? <Navigate to="/login" replace /> : <LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<InitialPasswordGate><AccountPage /></InitialPasswordGate>} />
            <Route path="/apercu" element={<DemoPage />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
            <Route path="/e/:tenantSlug" element={<LoginPage />} />

            <Route path="/contact" element={<ContactPage />} />
            <Route path="/logiciel-gestion-scolaire" element={<LogicielGestionScolairePage />} />
            <Route path="/plateforme-universite" element={<PlateformeUniversitePage />} />
            <Route path="/school-management-system" element={<SchoolManagementSystemPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<BlogArticlePage />} />
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/cgu" element={<CguPage />} />
            <Route path="/confidentialite" element={<ConfidentialitePage />} />
            <Route path="/preinscription" element={<PreregistrationPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/google-link-callback" element={<GoogleLinkCallbackPage />} />
            <Route path="/verify/document" element={<DocumentVerifyPage />} />
            <Route path="/verify/receipt/:id" element={<ReceiptVerifyPage />} />
            <Route path="/verify/attestation/:userId" element={<AttestationVerifyPage />} />
            <Route path="/verify/releve/:token" element={<PublicVerificationPage />} />
            <Route path="/verify/card/:token" element={<PublicVerificationPage kind="card" />} />
            <Route path="/verify/:token" element={<PublicVerificationPage />} />
            <Route path="/verify-lycee" element={<PublicVerificationPage />} />
            <Route path="/parent/login" element={<ParentLoginPage />} />

            {/* Parent routes */}
            <Route path="/parent" element={<ProtectedParent />}><Route index element={<ParentDashboardPage />} /></Route>
            <Route path="/parent/dashboard" element={<ProtectedParent />}><Route index element={<ParentDashboardPage />} /></Route>
            <Route path="/parent/notes" element={<ProtectedParent />}><Route index element={<ParentNotesPage />} /></Route>
            <Route path="/parent/absences" element={<ProtectedParent />}><Route index element={<ParentAbsencesPage />} /></Route>
            <Route path="/parent/paiements" element={<ProtectedParent />}><Route index element={<ParentPaiementsPage />} /></Route>
            <Route path="/parent/planning" element={<ProtectedParent />}><Route index element={<ParentPlanningPage />} /></Route>
            <Route path="/parent/documents" element={<ProtectedParent />}><Route index element={<ParentDocumentsPage />} /></Route>
            <Route path="/parent/notifications" element={<ProtectedParent />}><Route index element={<ParentNotificationsPage />} /></Route>

            {/* Student routes */}
            <Route path="/dashboard" element={<ProtectedDashboard />}><Route index element={<DashboardPage />} /></Route>
            <Route path="/grades" element={<ProtectedDashboard />}><Route index element={<GradesPage />} /></Route>
            <Route path="/absences" element={<ProtectedDashboard />}><Route index element={<StudentAbsencesPage />} /></Route>
            <Route path="/courses" element={<ProtectedDashboard />}><Route index element={<CoursesPage />} /></Route>
            <Route path="/calendar" element={<ProtectedDashboard />}><Route index element={<CalendarPage />} /></Route>
            <Route path="/payments" element={<ProtectedDashboard />}><Route index element={<PaymentsPage />} /></Route>
            <Route path="/curriculum" element={<ProtectedDashboard />}><Route index element={<CurriculumPage />} /></Route>
            <Route path="/messages" element={<ProtectedDashboard />}><Route index element={<StudentMessagesPage />} /></Route>
            <Route path="/notifications" element={<ProtectedDashboard />}><Route index element={<StudentNotificationsPage />} /></Route>
            <Route path="/settings" element={<ProtectedDashboard />}><Route index element={<ProfileSettingsPage />} /></Route>
            <Route path="/events" element={<ProtectedDashboard />}><Route index element={<StudentEventsPage />} /></Route>
            <Route path="/soutenances" element={<ProtectedDashboard />}><Route index element={<StudentSoutenancesPage />} /></Route>
            <Route path="/bde" element={<ProtectedDashboard />}><Route index element={<StudentBDEPage />} /></Route>
            <Route path="/community" element={<ProtectedDashboard />}><Route index element={<CommunityPage />} /></Route>
            <Route path="/card" element={<ProtectedDashboard />}><Route index element={<StudentCardPage />} /></Route>
            <Route path="/library" element={<ProtectedDashboard />}><Route index element={<StudentLibraryPage />} /></Route>
            <Route path="/visio" element={<ProtectedDashboard />}><Route index element={<StudentVisioPage />} /></Route>
            <Route path="/orientation" element={<ProtectedDashboard />}><Route index element={<OrientationPage />} /></Route>
            <Route path="/candidatures" element={<ProtectedDashboard />}><Route index element={<StudentApplicationsPage />} /></Route>

            {/* Professor routes */}
            <Route path="/professor" element={<ProtectedProfessor />}><Route index element={<ProfessorDashboardPage />} /></Route>
            <Route path="/professor/subjects" element={<ProtectedProfessor />}><Route index element={<ProfessorSubjectsPage />} /></Route>
            <Route path="/professor/grades" element={<ProtectedProfessor />}><Route index element={<ProfessorGradesPage />} /></Route>
            <Route path="/professor/schedule" element={<ProtectedProfessor />}><Route index element={<ProfessorSchedulePage />} /></Route>
            <Route path="/professor/messages" element={<ProtectedProfessor />}><Route index element={<ProfessorMessagesPage />} /></Route>
            <Route path="/professor/notifications" element={<ProtectedProfessor />}><Route index element={<ProfessorNotificationsPage />} /></Route>
            <Route path="/professor/visio" element={<ProtectedProfessor />}><Route index element={<ProfessorVisioPage />} /></Route>
            <Route path="/professor/attendance" element={<ProtectedProfessor />}><Route index element={<ProfessorAttendancePage />} /></Route>
            <Route path="/professor/settings" element={<ProtectedProfessor />}><Route index element={<ProfessorSettingsPage />} /></Route>


            {/* Admin routes */}
            <Route path="/admin" element={<ProtectedAdmin />}><Route index element={<AdminDashboardPage />} /></Route>
            {adminRoutes("/admin", ProtectedAdmin)}

            {/* Super Admin routes — same admin modules + platform management */}
            <Route path="/super-admin" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminDashboardPage />} /></Route>
            <Route path="/super-admin/institutions" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminInstitutionsPage />} /></Route>
            <Route path="/super-admin/admins" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminAdminsPage />} /></Route>
            <Route path="/super-admin/subscriptions" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminSubscriptionsPage />} /></Route>
            <Route path="/super-admin/finance" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminFinancePage />} /></Route>
            <Route path="/super-admin/backups" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminBackupsPage />} /></Route>
            <Route path="/super-admin/import" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminImportPage />} /></Route>
            <Route path="/super-admin/restore" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminRestorePage />} /></Route>
            <Route path="/super-admin/preinscriptions" element={<ProtectedSuperAdmin />}><Route index element={<SuperAdminPreregistrationsPage />} /></Route>
            {adminRoutes("/super-admin", ProtectedSuperAdmin)}

            {/* Director routes */}
            <Route path="/director" element={<DirectorProtectedRoute><InitialPasswordGate><DirectorLayout /></InitialPasswordGate></DirectorProtectedRoute>}>
              <Route index element={<DirectorDashboardPage />} />
              <Route path="campuses" element={<DirectorCampusesPage />} />
              <Route path="documents" element={<DirectorDocumentsPage />} />
              <Route path="reports" element={<DirectorReportsPage />} />
              <Route path="finance" element={<DirectorFinancePage />} />
              <Route path="signature" element={<DirectorSignaturePage />} />
              <Route path="notifications" element={<DirectorNotificationsPage />} />
            </Route>

            {/* Validator routes — Responsable Pédagogique */}
            <Route
              path="/pedagogique"
              element={
                <ValidatorProtectedRoute role={VALIDATOR_ROLES.pedagogique}>
                  <InitialPasswordGate><ValidatorLayout role={VALIDATOR_ROLES.pedagogique} /></InitialPasswordGate>
                </ValidatorProtectedRoute>
              }
            >
              <Route index element={<ValidatorDashboardPage role={VALIDATOR_ROLES.pedagogique} />} />
              <Route path="documents" element={<ValidatorDocumentsPage role={VALIDATOR_ROLES.pedagogique} />} />
              <Route path="signature" element={<ValidatorSignaturePage role={VALIDATOR_ROLES.pedagogique} />} />
            </Route>

            {/* Validator routes — Responsable du Cycle */}
            <Route
              path="/cycle"
              element={
                <ValidatorProtectedRoute role={VALIDATOR_ROLES.cycle}>
                  <InitialPasswordGate><ValidatorLayout role={VALIDATOR_ROLES.cycle} /></InitialPasswordGate>
                </ValidatorProtectedRoute>
              }
            >
              <Route index element={<ValidatorDashboardPage role={VALIDATOR_ROLES.cycle} />} />
              <Route path="documents" element={<ValidatorDocumentsPage role={VALIDATOR_ROLES.cycle} />} />
              <Route path="signature" element={<ValidatorSignaturePage role={VALIDATOR_ROLES.cycle} />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
