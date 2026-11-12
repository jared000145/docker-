import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { recordAuthStatus } from '@/lib/authDiagnostic';

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { first_name: string; last_name: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateAvatar: (value: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRef=useRef(profile);
  const currentUserId=useRef(user?.id);
  currentUserId.current=user?.id;
  profileRef.current=profile;
  useEffect(()=>{
    if(!user?.id) return;
    let active=true;
    const channel=supabase.channel(`own-profile-${user.id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles',filter:`user_id=eq.${user.id}`},payload=>{
      if(!active) return;
      const next=payload.new as Profile;
      if(next.user_id!==user.id) return;
      if(profileRef.current?.institution_id!==next.institution_id) queryClient.clear();
      setProfile(next);
    }).subscribe();
    return()=>{active=false;void supabase.removeChannel(channel);};
  },[user?.id,queryClient]);

  useEffect(() => {
    let active = true;
    let authRevision = 0;
    let profileRevision = 0;
    let previousUserId: string | null = null;

    const applySession = (nextSession: Session | null) => {
      const requestRevision = ++profileRevision;
      const nextUserId = nextSession?.user.id ?? null;
      const identityChanged = previousUserId !== nextUserId;
      if (identityChanged) queryClient.clear();
      previousUserId = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (identityChanged) { setProfile(null); setLoading(!!nextSession); }

      if (!nextSession?.user) { setLoading(false); return; }

      void (async () => {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", nextSession.user.id)
            .maybeSingle();
          if (error) throw error;
          if (active && requestRevision === profileRevision) setProfile(data);
        } catch (error) {
          if (!active || requestRevision !== profileRevision) return;
          console.error("Unable to load the signed-in user's profile:", error);
          toast.error("Votre profil n'a pas pu être chargé. Certaines fonctions peuvent être indisponibles.");
        } finally {
          if (active && requestRevision === profileRevision) setLoading(false);
        }
      })();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === 'SIGNED_OUT') recordAuthStatus('La session a été fermée. Veuillez vous reconnecter.');
      authRevision += 1;
      applySession(nextSession);
    });

    const initialAuthRevision = authRevision;
    void supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!active || authRevision !== initialAuthRevision) return;
        if (error) {
          console.error("Unable to restore the saved authentication session:", error);
          setLoading(false);
          toast.error("Impossible de restaurer votre session. Veuillez vous reconnecter.");
          return;
        }
        applySession(initialSession);
      })
      .catch((error: unknown) => {
        if (!active || authRevision !== initialAuthRevision) return;
        console.error("Unable to restore the saved authentication session:", error);
        setLoading(false);
        toast.error("Impossible de restaurer votre session. Veuillez vous reconnecter.");
      });

    return () => {
      active = false;
      profileRevision += 1;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    recordAuthStatus('Connexion en cours…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    recordAuthStatus(error ? 'Connexion refusée. Vérifiez votre email et votre mot de passe.' : 'Connexion acceptée. Vérification de votre accès…');
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, metadata?: { first_name: string; last_name: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: window.location.origin },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  };
  const updateAvatar = async (value: string | null) => {
    const id=user?.id;
    if(!id)throw new Error('Connectez-vous pour modifier votre photo.');
    const {error}=await supabase.from('profiles').update({avatar_url:value}).eq('user_id',id);
    if(error)throw error;
    if(currentUserId.current===id)setProfile(previous=>previous?.user_id===id?{...previous,avatar_url:value}:previous);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
