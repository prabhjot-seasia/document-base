import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:8080';
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID || 'document-base-clientid';

interface UserInfo {
  user_id: string;
  username: string;
  email: string;
  roles: string[];
  groups: string[];
  permissions: { resource: string; action: string }[];
}

interface AuthContextType {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  initiateLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initializeToken = () => {
    const storedToken = localStorage.getItem('jwt');
    if (!storedToken) return null;

    try {
      const payload = JSON.parse(atob(storedToken.split('.')[1]));
      const currentTime = Date.now() / 1000;
      if (payload.exp && payload.exp < currentTime) {
        localStorage.removeItem('jwt');
        localStorage.removeItem('refresh_token');
        return null;
      }
      return storedToken;
    } catch {
      localStorage.removeItem('jwt');
      localStorage.removeItem('refresh_token');
      return null;
    }
  };

  const [token, setToken] = useState<string | null>(initializeToken());
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(
    token ? localStorage.getItem('refresh_token') : null
  );
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/me');
      setUser(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        clearAuth();
      }
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = () => {
    localStorage.removeItem('jwt');
    localStorage.removeItem('refresh_token');
    setToken(null);
    setRefreshTokenValue(null);
    setUser(null);
  };

  const initiateLogin = (): void => {
    const redirectUri = `${window.location.origin}/auth/callback`;
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(128);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    localStorage.setItem('oauth_state', state);
    localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'documents:read documents:write',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${AUTH_SERVICE_URL}/sso/login?${params}`;
  };

  const logout = async () => {
    try {
      const currentToken = localStorage.getItem('jwt');
      if (currentToken) {
        await axios.post(`${AUTH_SERVICE_URL}/sso/logout`, { token: currentToken });
      }
    } catch {
    } finally {
      clearAuth();
    }
  };

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error: any) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (refreshTokenValue) {
            try {
              const response = await axios.post(`${AUTH_SERVICE_URL}/auth/token`, {
                grant_type: 'refresh_token',
                refresh_token: refreshTokenValue,
              });

              const { access_token } = response.data;
              localStorage.setItem('jwt', access_token);
              setToken(access_token);
              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return api(originalRequest);
            } catch {
              clearAuth();
              return Promise.reject(error);
            }
          }

          // No refresh token — clear auth so ProtectedRoute redirects to login
          clearAuth();
          return Promise.reject(error);
        }

        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [refreshTokenValue]);

  const generateRandomString = (length: number): string => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => ('0' + byte.toString(16)).slice(-2)).join('');
  };

  const generateCodeChallenge = (codeVerifier: string): string => {
    return btoa(codeVerifier)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, initiateLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
