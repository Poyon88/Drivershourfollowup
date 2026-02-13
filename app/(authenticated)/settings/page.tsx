"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAllData } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { LogOut, User, Lock, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setEmail(user.email || "");
    }
    fetchUser();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error("Erreur lors du changement de mot de passe.");
    } else {
      toast.success("Mot de passe mis à jour avec succès.");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">
          Gérez votre profil et vos préférences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profil
          </CardTitle>
          <CardDescription>Informations de votre compte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled />
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Clear database */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-4 w-4" /> Réinitialiser la base de données
          </CardTitle>
          <CardDescription>
            Supprime toutes les données importées : chauffeurs, périodes, enregistrements mensuels et historique d&apos;imports. Cette action est irréversible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!clearConfirm ? (
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setClearConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Vider toutes les données
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-600">
                Êtes-vous sûr ? Toutes les données seront définitivement supprimées.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  disabled={clearing}
                  onClick={async () => {
                    setClearing(true);
                    try {
                      await clearAllData();
                      toast.success("Base de données vidée avec succès.");
                      setClearConfirm(false);
                    } catch (error) {
                      toast.error(
                        error instanceof Error ? error.message : "Erreur lors de la suppression"
                      );
                    } finally {
                      setClearing(false);
                    }
                  }}
                >
                  {clearing ? "Suppression en cours..." : "Confirmer la suppression"}
                </Button>
                <Button
                  variant="outline"
                  disabled={clearing}
                  onClick={() => setClearConfirm(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
