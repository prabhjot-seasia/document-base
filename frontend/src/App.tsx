import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './provider/authProvider';
import { PermissionProvider } from './contexts/PermissionContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AuthCallback } from './routes/AuthCallback';
import { Dashboard } from './components/Dashboard';
import { DocumentViewer } from './components/DocumentViewer';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PermissionProvider>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/documents/:id/versions/:vid" element={<DocumentViewer />} />
              <Route path="/documents/:id" element={<DocumentViewer />} />
              <Route path="/*" element={<Dashboard />} />
            </Route>
          </Routes>
        </PermissionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
