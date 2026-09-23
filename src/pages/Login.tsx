import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError('');
    try {
      await login(email.trim(), password);
      toast({ description: 'Welcome back!' });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <BookOpenText className="h-8 w-8 text-yellow-900 mx-auto mb-2" />
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Log in to like words, suggest new ones and follow your fixes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full bg-yellow-900 hover:bg-yellow-950 gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Logging in...' : 'Log in'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              No account yet?{' '}
              <Link to="/register" className="underline font-medium">Sign up</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
