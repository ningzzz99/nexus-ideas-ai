import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Search, Bot, Target } from "lucide-react";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          title: title.trim(),
          goal: goal.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Session created!" });
      navigate(`/session/${data.session_url}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out" });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-secondary/20">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-spark via-facilitator to-anchor bg-clip-text text-transparent">
              AI Brainstorm Studio
            </h1>
            <p className="text-xl text-muted-foreground">
              Collaborate with 4 AI agents to supercharge your brainstorming sessions
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="border-spark/20 bg-spark-light/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-spark">
                    <Lightbulb className="h-6 w-6 text-spark-foreground" />
                  </div>
                  <CardTitle>Spark</CardTitle>
                </div>
                <CardDescription>The optimist who generates creative ideas</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-probe/20 bg-probe-light/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-probe">
                    <Search className="h-6 w-6 text-probe-foreground" />
                  </div>
                  <CardTitle>Probe</CardTitle>
                </div>
                <CardDescription>The cynic who challenges and refines</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-facilitator/20 bg-facilitator-light/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-facilitator">
                    <Bot className="h-6 w-6 text-facilitator-foreground" />
                  </div>
                  <CardTitle>Facilitator</CardTitle>
                </div>
                <CardDescription>Keeps sessions organized and on track</CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-anchor/20 bg-anchor-light/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-anchor">
                    <Target className="h-6 w-6 text-anchor-foreground" />
                  </div>
                  <CardTitle>Anchor</CardTitle>
                </div>
                <CardDescription>Voice of the customer, keeps you grounded</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="flex justify-center">
            <AuthForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Start a Brainstorm Session</h1>
          <p className="text-muted-foreground">
            Create a session and invite AI agents to collaborate
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Session</CardTitle>
            <CardDescription>
              Set your goal and invite team members with a shareable link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Q4 Product Ideas"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal">Session Goal</Label>
                <Input
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Generate 10 innovative features for mobile app"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating} className="flex-1">
                  {creating ? "Creating..." : "Create Session"}
                </Button>
                <Button type="button" variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
