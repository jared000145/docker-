import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Send, ArrowLeft, MessageSquare, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { WHATSAPP_NUMBERS, CONTACT_EMAIL, waLink } from "@/components/marketing/MarketingLayout";

const ContactPage = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-message", {
        body: { senderName: form.name, senderEmail: form.email, subject: form.subject, message: form.message },
      });
      if (error) throw error;
      toast.success("Message envoyé, nous revenons vers vous rapidement.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      toast.error(err.message || "Échec de l'envoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-primary/5 to-background">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="glass-card-elevated p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-heading font-bold">Nous contacter</h1>
            <p className="text-sm text-muted-foreground">
              Écrivez-nous, nous répondons sous 24-48h à <b>service@rectorplus.com</b>
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Nom</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            </div>
            <div><Label>Sujet</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div><Label>Message</Label><Textarea rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required /></div>
            <Button type="submit" disabled={loading} className="w-full h-12 btn-gold">
              <Send className="w-4 h-4 mr-2" />
              {loading ? "Envoi..." : "Envoyer le message"}
            </Button>
          </form>

          <div className="border-t border-border/40 pt-5">
            <p className="mb-3 text-center text-xs font-semibold text-muted-foreground">Ou contactez-nous directement</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {WHATSAPP_NUMBERS.map((n) => (
                <div key={n.tel} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card/40 p-3">
                  <a href={`tel:${n.tel}`} className="inline-flex items-center justify-center gap-2 text-sm font-medium hover:text-accent">
                    <Phone className="h-4 w-4 text-accent" /> {n.label}
                  </a>
                  <a
                    href={waLink(n.wa)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 text-xs text-success hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              ))}
            </div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> {CONTACT_EMAIL}
            </a>
          </div>

          <Link to="/" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default ContactPage;
