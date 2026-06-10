import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { User, MapPin, Check } from "lucide-react";

export default function Profile() {
  const { user, updateProfile, loading } = useAuth();
  const [, navigate] = useLocation();
  const [name, setName] = useState(user?.name ?? "");
  const [address, setAddress] = useState(user?.deliveryAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  if (!loading && !user) {
    navigate("/login");
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateProfile({ name: name || undefined, deliveryAddress: address || undefined });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-8 sm:mt-16 animate-in fade-in slide-in-from-bottom-6 duration-500">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <User className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground text-sm mt-1">{user?.email}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                Delivery Address
              </label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Street, City, Country, Postal Code"
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">Used as default delivery address for orders</p>
            </div>

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full rounded-xl" disabled={saving}>
              {saved ? (
                <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Saved!</span>
              ) : saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
