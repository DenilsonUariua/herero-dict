import { Navigate } from 'react-router-dom';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SuggestionsTab } from '@/components/admin/SuggestionsTab';
import { CorrectionsTab } from '@/components/admin/CorrectionsTab';
import { WordsTab } from '@/components/admin/WordsTab';
import { DraftsTab } from '@/components/admin/DraftsTab';
import { WotdTab } from '@/components/admin/WotdTab';
import { MessagesTab } from '@/components/admin/MessagesTab';
import { SettingsTab } from '@/components/admin/SettingsTab';

export default function Admin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading...
        </div>
      </>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin(user)) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen p-6 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <ShieldAlert className="h-10 w-10 text-red-500 mx-auto mb-2" />
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>
                This area is restricted. Your account needs the <code className="bg-muted px-1 rounded">admin</code> label
                in the Appwrite console (Users → your account → Labels).
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen p-6 max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">Admin panel</h1>
          <p className="text-muted-foreground">Review contributions, manage the dictionary, and import words with AI.</p>
        </header>

        <Tabs defaultValue="suggestions">
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="corrections">Fixes</TabsTrigger>
            <TabsTrigger value="words">Words</TabsTrigger>
            <TabsTrigger value="drafts">AI Drafts</TabsTrigger>
            <TabsTrigger value="wotd">Word of the Day</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions"><SuggestionsTab /></TabsContent>
          <TabsContent value="corrections"><CorrectionsTab /></TabsContent>
          <TabsContent value="words"><WordsTab /></TabsContent>
          <TabsContent value="drafts"><DraftsTab /></TabsContent>
          <TabsContent value="wotd"><WotdTab /></TabsContent>
          <TabsContent value="messages"><MessagesTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>
    </>
  );
}
