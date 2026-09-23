import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function Register() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, name.trim() || email.trim().split('@')[0]);
      toast({ description: 'Account created — welcome!' });
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not create account.';
      setError(msg.includes('already exists') ? 'An account with this email already exists. Try logging in.' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <BookOpenText className="h-8 w-8 text-yellow-900 mx-auto mb-2" />
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Suggest words, propose fixes and build your personal word list.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={128} placeholder="Tjarirove" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full bg-yellow-900 hover:bg-yellow-950 gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating account...' : 'Sign up'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="underline font-medium">Log in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
