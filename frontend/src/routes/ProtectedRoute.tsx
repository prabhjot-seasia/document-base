import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../provider/authProvider';

export const ProtectedRoute: React.FC = () => {
  const { token, loading, initiateLogin } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      initiateLogin();
    }
  }, [loading, token, initiateLogin]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return <Outlet />;
};
