import { useEffect, useState } from "react";
import { safeNextPath } from "@/lib/authRouting";
import { usePermissions } from "@/hooks/usePermissions";
import { useLanguage } from "@/hooks/useLanguage";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Hash, BookOpen, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/useAdmin";
import { useProfessor } from "@/hooks/useProfessor";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useParent } from "@/hooks/useParent";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import studentsCampus from "@/assets/students-campus.webp";
import { useTenantSlug } from "@/hooks/useTenantSlug";
import { tenantCssVars } from "@/lib/tenantTheme";
import RectorPlusLogo from "@/components/branding/RectorPlusLogo";
import { readAuthStatus, recordAuthStatus } from '@/lib/authDiagnostic';

const LoginPage = () => {
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isProfessor, isLoading: profLoading } = useProfessor();
  const { isSuperAdmin, isLoading: superLoading } = useSuperAdmin();
  const { isParent, isLoading: parentLoading } = useParent();
  const { isDirector, isResponsablePedagogique, isResponsableCycle, isLoading: permissionsLoading } = usePermissions();
  const [verifiedScope, setVerifiedScope] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [matricule, setMatricule] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(readAuthStatus);
  useEffect(() => {
    const update = () => setAuthStatus(readAuthStatus());
    window.addEventListener('rp-auth-status', update);
    return () => window.removeEventListener('rp-auth-status', update);
  }, []);
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "email" || params.get("next")?.startsWith("/super-admin") ? "admin" : "student";
  });
  const [highContrast, setHighContrast] = useState(false);
  const { slug, tenant, isTenantHost, isLoading: tenantLoading } = useTenantSlug();
  const matriculeKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  /**
   * Vérifie que l'utilisateur connecté appartient bien à l'établissement
   * de cette page de connexion. Un refus conserve la session et affiche son lien.
   */
  const enforceTenantMembership = async (): Promise<boolean> => {
    if (isSuperAdmin || (!isTenantHost && !tenant?.id)) return true;
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !authenticatedUser) {
      recordAuthStatus('La session ne peut pas être vérifiée. Réessayez la connexion.');
      toast.error("Impossible de vérifier votre compte. Veuillez vous reconnecter.");
      return false;
    }

    // Platform administrators are not attached to an institution. Check their
    // server role before rejecting an old or unavailable tenant context.
    const { data: platformRole, error: roleError } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", authenticatedUser.id).eq("role", "super_admin").maybeSingle();
    if (roleError) {
      recordAuthStatus('Impossible de vérifier les droits du compte. Réessayez dans quelques instants.');
      toast.error("Impossible de vérifier vos droits. Veuillez réessayer.");
      return false;
    }
    if (platformRole) return true;
    if (isTenantHost && !tenant) {
      recordAuthStatus('Accès refusé : établissement introuvable pour cette page.');
      toast.error(t("Établissement introuvable. Vérifiez votre lien.", "Institution not found. Check your link."));
      return false;
    }
    if (!tenant?.id) return true;

    const { data: prof, error: profileError } = await supabase
      .from("profiles")
      .select("institution_id")
      .eq("user_id", authenticatedUser.id)
      .maybeSingle();

    if (profileError || !prof) {
      console.error("Unable to verify institution membership:", profileError);
      recordAuthStatus('Accès interrompu : le profil du compte ne peut pas être chargé.');
      toast.error("Impossible de vérifier votre établissement. Veuillez réessayer.");
      return false;
    }

    if (!prof.institution_id) {
      recordAuthStatus('Ce compte ne possède pas de rôle plateforme ni d’établissement associé.');
      return false;
    }
    if (prof.institution_id === tenant.id) return true;

    const { data: own, error: institutionError } = await supabase
      .from("institutions")
      .select("name, slug")
      .eq("id", prof.institution_id)
      .maybeSingle();

    if (institutionError) {
      recordAuthStatus('Impossible de charger votre établissement. Réessayez dans quelques instants.');
      console.error("Unable to load the account's institution:", institutionError);
      toast.error("Impossible de vérifier votre établissement. Veuillez réessayer.");
      return false;
    }


    const link = own?.slug ? `${own.slug}.rectorplus.com` : null;
    recordAuthStatus('Ce compte appartient à un autre établissement. Utilisez son lien de connexion.');
    toast.error(
      own?.name
        ? `Ce compte appartient à « ${own.name} ». Connectez-vous sur votre page : ${link ?? "le lien de votre établissement"}`
        : "Ce compte n'appartient pas à cet établissement.",
      { duration: 10000 }
    );
    return false;
  };

  const signInWithMatricule = async (value: string, domains: string[]) => {
    const key = matriculeKey(value);
    for (const domain of domains) {
      const result = await signIn(`${key}@${domain}`, password);
      if (!result.error) return result;
    }
    return { error: new Error("Invalid login credentials") };
  };

  const submitLogin = async (
    event: React.FormEvent,
    authenticate: () => Promise<{ error: Error | null }>,
    invalidCredentialsMessage: string
  ) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await authenticate();
      if (error) {
        toast.error(invalidCredentialsMessage);
      } else {
        toast.success("Connexion réussie");
      }
    } catch (error) {
      console.error("Unable to complete sign-in:", error);
      toast.error("Une erreur est survenue pendant la connexion. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || authLoading || superLoading || tenantLoading || loading) { setVerifiedScope(null); return; }
    let active = true;
    const scope = `${user.id}:${tenant?.id ?? "platform"}`;
    setVerifiedScope(null);
    void enforceTenantMembership().then(valid => { if (active) setVerifiedScope(valid ? scope : null); }).catch(() => { if (active) setVerifiedScope(null); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tenant?.id, tenantLoading, loading, authLoading, superLoading, isSuperAdmin]);

  useEffect(() => {
    if (!user || loading || tenantLoading || verifiedScope !== `${user.id}:${tenant?.id ?? "platform"}` || adminLoading || profLoading || superLoading || parentLoading || permissionsLoading) return;
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    recordAuthStatus(isSuperAdmin ? 'Accès super administrateur validé. Ouverture du tableau de bord…' : 'Accès du compte validé. Ouverture de votre espace…');
    navigate(next || (isSuperAdmin ? "/super-admin" : isDirector ? "/director" : isResponsablePedagogique ? "/pedagogique" : isResponsableCycle ? "/cycle" : isAdmin ? "/admin" : isProfessor ? "/professor" : isParent ? "/parent/dashboard" : "/dashboard"), { replace: true });
  }, [user, loading, tenantLoading, tenant?.id, verifiedScope, adminLoading, profLoading, superLoading, parentLoading, permissionsLoading, isSuperAdmin, isDirector, isResponsablePedagogique, isResponsableCycle, isAdmin, isProfessor, isParent, navigate]);

  // Sur un lien d'établissement, on attend la charte avant d'afficher quoi que ce soit
  // (évite le flash de l'identité Rectorplus par défaut).
  if (isTenantHost && tenantLoading && !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  const handleStudentLogin = async (e: React.FormEvent) => {
    await submitLogin(
      e,
      () => signInWithMatricule(matricule, ["student.campusflow.com", "student.scolarplus.local"]),
      "Matricule ou mot de passe incorrect"
    );
  };

  const handleProfessorLogin = async (e: React.FormEvent) => {
    await submitLogin(
      e,
      () => signInWithMatricule(matricule, ["prof.campusflow.com"]),
      "Matricule ou mot de passe incorrect"
    );
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    await submitLogin(e, () => signIn(email.trim(), password), "Email ou mot de passe incorrect");
  };



  const displayName = tenant ? (tenant.login_title?.trim() || tenant.name) : null;
  const brandName = displayName ?? "Rectorplus";
  const bgImage = tenant?.cover_image_url || studentsCampus;
  const tagline = tenant?.login_subtitle?.trim() || tenant?.slogan || null;
  const layout = (tenant?.login_layout || "split").toLowerCase();
  const centered = layout === "centered" || layout === "minimal";
  const overlay = Math.min(95, Math.max(0, Number(tenant?.login_overlay ?? 55))) / 100;

  return (
    <div className="min-h-screen flex bg-background" style={tenantCssVars(tenant)}>
      <Helmet>
        <title>{`Connexion — ${brandName}`}</title>
        <meta name="description" content={`Connectez-vous à l'espace ${brandName} : étudiants, professeurs, administration et direction.`} />
        <meta property="og:title" content={`Connexion — ${brandName}`} />
        <meta property="og:description" content={`Accédez à votre espace ${brandName}.`} />
      </Helmet>
      <div className={`${centered ? "hidden" : "hidden lg:flex lg:w-1/2"} relative overflow-hidden bg-secondary`}>
        <img
          src={bgImage}
          alt={`Espace de connexion ${brandName}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 1 - overlay * 0.5 }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-primary to-secondary" style={{ opacity: overlay }} />
        <div className="absolute inset-0 bg-pattern-dots opacity-20" />



        {/* Halo doré */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-accent/20 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-40 -left-20 w-[28rem] h-[28rem] rounded-full bg-primary/20 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3"
          >
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-2xl object-cover shadow-gold bg-white/90 p-1" />
            ) : <RectorPlusLogo className="h-12 w-12 rounded-xl bg-card/90 p-1 shadow-gold" />}
            <div>
              <span className="block text-2xl sm:text-3xl font-heading font-extrabold text-primary-foreground tracking-tight drop-shadow-sm">
                {displayName ?? (<>Rector<span className="text-gradient-gold">plus</span></>)}
              </span>

              <p className="text-primary-foreground/80 text-xs uppercase tracking-widest">
                {tagline ?? t("L’espace de votre établissement", "Your institution’s workspace")}
              </p>

            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-md"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-foreground/10 border border-primary-foreground/30 text-primary-foreground text-xs font-semibold mb-6 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {t("Gestion scolaire et universitaire", "School and university management")}
            </div>
            <h2 className="text-5xl font-heading font-bold text-primary-foreground mb-5 leading-tight drop-shadow-sm">
              {tenant ? (
                <>Bienvenue à <span className="text-gradient-gold">{displayName}</span>.</>
              ) : (
                <>{t("Votre scolarité, au même endroit.", "Your academic life, in one place.")}</>
              )}
            </h2>
            <p className="text-primary-foreground/90 text-lg leading-relaxed">
              {tagline ?? t("Retrouvez vos résultats, votre emploi du temps et les informations de votre établissement. Connectez-vous avec les identifiants qui vous ont été remis.", "Find your results, schedule and institution updates. Sign in with the account provided by your institution.")}
            </p>



            <div className="mt-8 flex items-center gap-6 text-primary-foreground/85 text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                Multi-tenant
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-foreground/15 flex items-center justify-center">
                  <Globe2 className="w-4 h-4" />
                </div>
                Temps réel
              </div>
            </div>
          </motion.div>

          <p className="text-primary-foreground/75 text-xs">© 2026 {brandName} · Propulsé par Rectorplus</p>
        </div>
      </div>

      {/* Formulaire droite */}
      <div className={`w-full ${centered ? "" : "lg:w-1/2"} flex items-center justify-center p-6 sm:p-12 relative ${highContrast ? "bg-background" : "bg-background/80"}`}>
        <img
          src={bgImage}
          alt={`Espace de connexion ${brandName}`}
          className={`absolute inset-0 h-full w-full object-cover ${centered ? "" : "lg:hidden"}`}
          style={{ opacity: 1 - overlay * 0.6 }}
        />

        <div className={`absolute inset-0 ${centered ? "" : "lg:hidden"} ${highContrast ? "bg-background/90" : "bg-background/75"}`} />
        <div className={`absolute inset-0 bg-grid-fade pointer-events-none ${highContrast ? "opacity-0" : "opacity-20"}`} />


        <motion.div
          className={`glass-card-elevated relative w-full max-w-md space-y-8 p-6 sm:p-8 ${highContrast ? "bg-card border-primary/60 shadow-elevated" : ""}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex justify-end gap-2">
            <select aria-label="Langue / Language" value={language} onChange={e => setLanguage(e.target.value as 'fr' | 'en')} className="rounded-lg border bg-card px-2 text-sm"><option value="fr">Français</option><option value="en">English</option></select>
            <button
              type="button"
              onClick={() => setHighContrast((value) => !value)}
              aria-pressed={highContrast}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                highContrast
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/60 text-foreground hover:bg-muted"
              }`}
            >
              {t('Contraste élevé', 'High contrast')}
              <span className={`h-2.5 w-2.5 rounded-full ${highContrast ? "bg-primary-foreground" : "bg-muted-foreground"}`} />
            </button>
          </div>

          <div className={`text-center ${centered ? "" : "lg:hidden"}`}>
            <div className="inline-flex items-center gap-3 mb-2">
              {tenant?.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-12 rounded-2xl object-cover shadow-gold bg-white/90 p-1" />
              ) : <RectorPlusLogo className="h-12 w-12 rounded-xl bg-card/90 p-1 shadow-gold" />}
              <h1 className="text-2xl font-heading font-extrabold text-foreground">
                {displayName ?? (<>Rector<span className="text-gradient-gold">plus</span></>)}
              </h1>

            </div>
          </div>

          <div className="text-center space-y-2">
            {tenant && (
              <p className="text-lg sm:text-xl font-heading font-extrabold uppercase tracking-wide text-primary leading-tight">
                {displayName}
              </p>
            )}
            <h2 className="text-3xl font-heading font-bold text-foreground">{t('Bon retour !', 'Welcome back!')}</h2>
            <p className="text-sm text-muted-foreground">
              {tagline ?? (tenant ? `Connexion à l'espace ${displayName}` : t("Choisissez votre profil pour accéder à votre espace", "Choose your profile to access your workspace"))}
            </p>



          </div>

          <Tabs value={tab} onValueChange={value => { setTab(value); setPassword(""); setShowPassword(false); }} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 h-auto">
              <TabsTrigger value="student" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2">
                {t("Étudiant", "Student")}
              </TabsTrigger>
              <TabsTrigger value="professor" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2">
                {t("Professeur", "Teacher")}
              </TabsTrigger>
              <TabsTrigger value="admin" className="data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm py-2">
                {t("Email", "Email")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="student" className="mt-6">
              <p className="text-muted-foreground text-sm text-center mb-5">
                {t("Connectez-vous avec votre matricule", "Sign in with your student ID")}
              </p>
              <form onSubmit={handleStudentLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("Matricule", "ID number")}</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input placeholder="XXXX-XXXX-XXXXX" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="pl-11 h-12 bg-card border-border placeholder:text-muted-foreground/50 focus-visible:ring-accent" required />
                  </div>
                  <p className="text-xs text-muted-foreground/70">{t("Utilisez le matricule remis par votre établissement.", "Use the ID number provided by your institution.")}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("Mot de passe", "Password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11 h-12 bg-card border-border focus-visible:ring-accent" required minLength={6} />
                    <button aria-label={t("Afficher ou masquer le mot de passe", "Show or hide password")} type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 btn-gold font-semibold text-base">
                  {loading ? t("Connexion...", "Signing in...") : t("Se connecter", "Sign in")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="professor" className="mt-6">
              <p className="text-muted-foreground text-sm text-center mb-5">
                {t("Connectez-vous avec votre matricule professeur", "Sign in with your teacher ID")}
              </p>
              <form onSubmit={handleProfessorLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("Matricule", "ID number")}</label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input placeholder="XXXX-XXXX-XXXXX" value={matricule} onChange={(e) => setMatricule(e.target.value)} className="pl-11 h-12 bg-card border-border placeholder:text-muted-foreground/50 focus-visible:ring-accent" required />
                  </div>
                  <p className="text-xs text-muted-foreground/70">Format attendu : XXXX-XXXX-XXXXX</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("Mot de passe", "Password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11 h-12 bg-card border-border focus-visible:ring-accent" required minLength={6} />
                    <button aria-label={t("Afficher ou masquer le mot de passe", "Show or hide password")} type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 btn-gold font-semibold text-base">
                  {loading ? t("Connexion...", "Signing in...") : t("Se connecter", "Sign in")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="admin" className="mt-6">
              {authStatus && <p role="status" className="mb-4 rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">{authStatus}</p>}
              <p className="text-sm text-muted-foreground mb-4">{t("Parents, personnel et utilisateurs disposant d’un email : connectez-vous ici. Votre rôle détermine votre espace.", "Parents, staff and users with an email: sign in here. Your role determines your workspace.")}</p>
              <p className="text-muted-foreground text-sm text-center mb-5">
                Connexion <span className="text-foreground font-medium">administrateur / super-admin</span>
              </p>
              <form onSubmit={handleAdminLogin} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Adresse email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input autoComplete="username" type="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-11 h-12 bg-card border-border focus-visible:ring-accent" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("Mot de passe", "Password")}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input autoComplete="current-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11 h-12 bg-card border-border focus-visible:ring-accent" required minLength={6} />
                    <button aria-label={t("Afficher ou masquer le mot de passe", "Show or hide password")} type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-12 btn-gold font-semibold text-base">
                  {loading ? t("Connexion...", "Signing in...") : t("Se connecter", "Sign in")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center">
            <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              {t('Mot de passe oublié ?', 'Forgot password?')}
            </a>
          </div>


          <p className="text-center text-xs text-muted-foreground">
            {t("Propulsé par", "Powered by")} <span className="font-semibold text-gradient-gold">Rectorplus</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
