import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../provider/authProvider';

interface PermissionContextType {
  hasPermission: (action: string, resource: string) => boolean;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  const hasPermission = (action: string, resource: string): boolean => {
    if (!user?.permissions) return false;

    // Map write to create/update/delete
    if (action === 'create' || action === 'update' || action === 'delete') {
      if (user.permissions.some((p) => p.resource === resource && p.action === 'write')) {
        return true;
      }
    }

    return user.permissions.some((p) => p.resource === resource && p.action === action);
  };

  return (
    <PermissionContext.Provider value={{ hasPermission, loading }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = (): PermissionContextType => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
};

interface RequirePermissionProps {
  action: string;
  resource: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  action,
  resource,
  children,
  fallback = null,
}) => {
  const { hasPermission, loading } = usePermissions();

  if (loading) return <>{fallback}</>;
  return hasPermission(action, resource) ? <>{children}</> : <>{fallback}</>;
};
