import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Query, Permission, Role, type Models } from 'appwrite';
import { account, tables, ID } from '@/lib/appwrite';
import { envConfigs } from '@/configs/env-configs';

export interface Profile extends Models.Row {
  userId: string;
  username: string;
  displayName: string;
  bio?: string;
  role: 'user' | 'moderator' | 'admin';
}

interface AuthContextValue {
  user: Models.User<Models.Preferences> | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const res = await tables.listRows<Profile>(
        envConfigs.appwriteDatabaseId,
        envConfigs.appwriteProfilesTableId,
        [Query.equal('userId', userId)],
      );
      setProfile(res.rows[0] ?? null);
    } catch {
      setProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const u = await account.get();
      setUser(u);
      await loadProfile(u.$id);
    } catch {
      setUser(null);
      setProfile(null);
    }
  }, [loadProfile]);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const ensureProfile = useCallback(async (u: Models.User<Models.Preferences>) => {
    const res = await tables.listRows<Profile>(
      envConfigs.appwriteDatabaseId,
      envConfigs.appwriteProfilesTableId,
      [Query.equal('userId', u.$id)],
    );
    if (res.rows[0]) {
      setProfile(res.rows[0]);
      return;
    }
    const created = await tables.createRow<Profile>(
      envConfigs.appwriteDatabaseId,
      envConfigs.appwriteProfilesTableId,
      ID.unique(),
      {
        userId: u.$id,
        username: (u.name || u.email.split('@')[0] || 'user').toLowerCase().replace(/\s+/g, '_').slice(0, 64),
        displayName: u.name || u.email.split('@')[0],
        role: 'user',
      },
      [
        Permission.update(Role.user(u.$id)),
        Permission.delete(Role.user(u.$id)),
      ],
    );
    setProfile(created);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await account.createEmailPasswordSession(email, password);
    await refreshSession();
  }, [refreshSession]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const u = await account.create(ID.unique(), email, password, name);
    await account.createEmailPasswordSession(email, password);
    await ensureProfile(u);
    setUser(await account.get());
  }, [ensureProfile]);

  const logout = useCallback(async () => {
    await account.deleteSessions();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, refreshProfile: () => refreshSession() }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
