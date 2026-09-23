import { Link, useNavigate } from 'react-router-dom';
import { BookOpenText, LogOut, User, Lightbulb, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SuggestWordDialog } from '@/components/SuggestWordDialog';
import { useState } from 'react';

export function Navbar() {
  const { user, profile, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [suggestOpen, setSuggestOpen] = useState(false);

  const initials = (profile?.displayName || user?.name || user?.email || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-foreground hover:opacity-80 transition-opacity">
          <BookOpenText className="h-5 w-5 text-yellow-900" />
          <span>Otjiherero Dictionary</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex gap-1.5"
            onClick={() => setSuggestOpen(true)}
          >
            <Lightbulb className="h-4 w-4" />
            Suggest a word
          </Button>

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-yellow-900 text-white text-xs font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate">
                  {profile?.displayName || user.name || user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
                  <User className="h-4 w-4" /> My profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSuggestOpen(true)} className="gap-2">
                  <Lightbulb className="h-4 w-4" /> Suggest a word
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                  className="gap-2 text-red-600 focus:text-red-600"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log in</Link>
              </Button>
              <Button size="sm" className="bg-yellow-900 hover:bg-yellow-950" asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <SuggestWordDialog open={suggestOpen} onOpenChange={setSuggestOpen} />
    </nav>
  );
}
