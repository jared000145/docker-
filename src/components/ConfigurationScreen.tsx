import { configurationErrors } from '@/lib/config';

export default function ConfigurationScreen() {
  return <main className="min-h-screen grid place-items-center p-6 bg-background">
    <section className="w-full max-w-xl rounded-2xl border bg-card p-8 shadow-lg space-y-5">
      <p className="font-heading text-primary font-bold text-xl">RectorPlus</p>
      <h1 className="text-2xl font-bold">Configurons votre application</h1>
      <p className="text-muted-foreground">Le projet est installé. Renseignez la connexion à votre base Supabase pour accéder aux espaces utilisateurs.</p>
      <ol className="list-decimal pl-5 space-y-2"><li>Copiez <code>.env.example</code> vers <code>.env</code>.</li><li>Renseignez les variables ci-dessous avec la clé publique de votre projet.</li><li>Redémarrez le serveur de développement, ou reconstruisez l’application Android.</li></ol>
      <ul className="rounded-lg bg-muted p-4 text-sm font-mono space-y-2">{configurationErrors.map(key => <li key={key}>{key}</li>)}</ul>
      <p className="text-sm text-muted-foreground">Une connexion Internet et le schéma RectorPlus sont nécessaires. Aucune donnée fictive n’est utilisée.</p>
      <div className="flex gap-5 text-sm"><a href="/" className="text-primary underline">Retour à l’accueil</a><a href="/apercu" className="text-primary underline">Essayer la démonstration locale</a></div>
    </section>
  </main>;
}
