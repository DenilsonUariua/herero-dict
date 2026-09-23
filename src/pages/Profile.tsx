import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Heart, Lightbulb, Pencil, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchMyLikes, fetchMyCorrections, fetchMySuggestions, type WordCorrection, type WordSuggestion } from '@/lib/dictionary';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'approved' ? 'default'
    : status === 'rejected' ? 'destructive'
    : 'secondary';
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}

export default function Profile() {
  const { user, profile, loading, logout } = useAuth();

  const { data: myLikes, isLoading: likesLoading } = useQuery({
    queryKey: ['my-likes', user?.$id ?? 'anon'],
    queryFn: () => fetchMyLikes(user!.$id),
    enabled: !!user,
  });
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['my-suggestions', user?.$id],
    queryFn: () => fetchMySuggestions(user!.$id),
    enabled: !!user,
  });
  const { data: corrections, isLoading: correctionsLoading } = useQuery({
    queryKey: ['my-corrections', user?.$id],
    queryFn: () => fetchMyCorrections(user!.$id),
    enabled: !!user,
  });

  if (!loading && !user) return <Navigate to="/login" replace />;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading profile...
        </div>
      </>
    );
  }

  const displayName = profile?.displayName || user?.name || user?.email || '';
  const initials = displayName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const memberSince = user?.$createdAt ? new Date(user.$createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : '';

  return (
    <>
      <Navbar />
      <main className="min-h-screen p-6 space-y-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="bg-yellow-900 text-white text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{displayName}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {user?.email} {memberSince && <>&middot; Member since {memberSince}</>}
              </p>
            </div>
            {profile?.role && profile.role !== 'user' && (
              <Badge className="capitalize">{profile.role}</Badge>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="likes">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="likes" className="gap-1.5"><Heart className="h-4 w-4" /> Likes</TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-1.5"><Lightbulb className="h-4 w-4" /> Suggestions</TabsTrigger>
            <TabsTrigger value="corrections" className="gap-1.5"><Pencil className="h-4 w-4" /> Fixes</TabsTrigger>
          </TabsList>

          <TabsContent value="likes" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My liked words</CardTitle>
              </CardHeader>
              <CardContent>
                {likesLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
                ) : !myLikes?.length ? (
                  <p className="text-sm text-muted-foreground">No liked words yet. Tap the heart on any word card.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {myLikes.map((l) => (
                      <Badge key={l.$id} variant="outline" className="text-sm">
                        {String(l.word).replace(/-\s*\d+$/, '').toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suggestions" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My word suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {suggestionsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
                ) : !suggestions?.length ? (
                  <p className="text-sm text-muted-foreground">No suggestions yet. Use &ldquo;Suggest a word&rdquo; to add one.</p>
                ) : (
                  suggestions.map((s) => <ContributionRow key={s.$id} title={s.word} status={s.status} meta={s.partOfSpeech} note={s.reviewNote} date={s.$createdAt} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="corrections" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My suggested fixes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {correctionsLoading ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
                ) : !corrections?.length ? (
                  <p className="text-sm text-muted-foreground">No corrections yet. Use the pencil icon on any word card.</p>
                ) : (
                  corrections.map((c) => <ContributionRow key={c.$id} title={c.word} status={c.status} meta={c.field} note={c.reviewNote} date={c.$createdAt} />)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="text-center">
          <button
            onClick={() => logout()}
            className="text-sm text-muted-foreground hover:text-red-600 underline"
          >
            Log out
          </button>
        </div>
      </main>
    </>
  );
}

function ContributionRow({ title, status, meta, note, date }: {
  title: string;
  status: WordSuggestion['status'] | WordCorrection['status'];
  meta?: string;
  note?: string;
  date: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-semibold truncate">{String(title).replace(/-\s*\d+$/, '').toUpperCase()}</p>
        <p className="text-xs text-muted-foreground">
          {meta ? <span className="capitalize">{meta.replace(/([A-Z])/g, ' $1')} &middot; </span> : null}
          {new Date(date).toLocaleDateString()}
        </p>
        {note && <p className="text-xs text-muted-foreground mt-1 italic">Reviewer: {note}</p>}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}
