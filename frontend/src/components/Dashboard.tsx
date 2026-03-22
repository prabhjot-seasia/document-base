import React, { useState, useEffect } from 'react';
import { useAuth } from '../provider/authProvider';
import { usePermissions, RequirePermission } from '../contexts/PermissionContext';
import { DocumentSearch } from './DocumentSearch';
import { DocumentUpload } from './DocumentUpload';
import { DirectoryManager } from './DirectoryManager';
import { ArchiveView } from './ArchiveView';
import axios from 'axios';
import seasiaLogo from '../assets/seasia-logo.svg';
import './Dashboard.css';

const AUTH_SERVICE_URL = process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:8080';
const AUTH_SERVICE_FRONTEND_URL = process.env.REACT_APP_AUTH_SERVICE_FRONTEND_URL || 'http://localhost:3000';
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID || 'document-base-clientid';

interface Service {
  id: string;
  name: string;
  client_id: string;
  scopes: string;
  is_active: boolean;
  redirect_uri?: string;
}

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('documents');
  const [services, setServices] = useState<Service[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('jwt');
      if (!token) return;
      const response = await axios.get(`${AUTH_SERVICE_URL}/me/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(response.data)) {
        setServices(response.data);
      } else if (response.data?.services) {
        setServices(response.data.services);
      }
    } catch {
      // Services may not be available - non-critical
    }
  };

  const handleTabSelect = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const getUserAllowedServices = () => {
    if (!services || services.length === 0) return [];
    return services.filter((service) => service.is_active);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-left">
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            &#9776;
          </button>
          <img src={seasiaLogo} alt="Seasia" className="dashboard-logo" />
          <h1>Document Base</h1>
        </div>
        <div className="user-dropdown-container">
          <button
            className="user-dropdown-toggle"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            aria-expanded={isUserDropdownOpen}
          >
            <span className="user-avatar">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </span>
            <span className="user-name">{user?.username || 'User'}</span>
            <svg
              className={`dropdown-arrow ${isUserDropdownOpen ? 'open' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
            >
              <path d="M2.5 4.5L6 8 9.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>

          {isUserDropdownOpen && (
            <>
              <div className="dropdown-overlay" onClick={() => setIsUserDropdownOpen(false)} />
              <div className="user-dropdown-menu">
                <div className="dropdown-user-info">
                  <div className="dropdown-user-header">
                    <div className="dropdown-user-avatar">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="dropdown-user-details">
                      <div className="dropdown-username">{user?.username}</div>
                      <div className="dropdown-email">{user?.email || 'No email'}</div>
                    </div>
                  </div>

                  {user?.roles && user.roles.length > 0 && (
                    <div className="dropdown-roles">
                      <span className="dropdown-label">Roles:</span>
                      <div className="dropdown-role-badges">
                        {user.roles.map((role: string) => (
                          <span key={role} className="role-badge">{role}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {getUserAllowedServices().length > 0 && (
                  <>
                    <div className="dropdown-divider" />
                    <div className="dropdown-services">
                      <div className="dropdown-section-title">Services</div>
                      {getUserAllowedServices().map((service) => {
                        const isCurrentApp = service.client_id === CLIENT_ID;

                        // Current app — show as disabled
                        if (isCurrentApp) {
                          return (
                            <div
                              key={service.id}
                              className="dropdown-service-link disabled current"
                              title="You are here"
                            >
                              <span className="service-icon">&#9889;</span>
                              <span className="service-name">{service.name}</span>
                              <span className="service-current-badge">current</span>
                            </div>
                          );
                        }

                        // Services with redirect_uri — SSO link
                        if (service.redirect_uri) {
                          const ssoUrl = new URL(`${AUTH_SERVICE_URL}/sso/login`);
                          ssoUrl.searchParams.append('client_id', service.client_id);
                          ssoUrl.searchParams.append('redirect_uri', service.redirect_uri);
                          ssoUrl.searchParams.append('response_type', 'code');
                          ssoUrl.searchParams.append('scope', service.scopes || 'openid');
                          const token = localStorage.getItem('jwt');
                          if (token) {
                            ssoUrl.searchParams.append('token', token);
                          }

                          return (
                            <a
                              key={service.id}
                              href={ssoUrl.toString()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="dropdown-service-link"
                              onClick={() => setIsUserDropdownOpen(false)}
                            >
                              <span className="service-icon">&#9889;</span>
                              <span className="service-name">{service.name}</span>
                              <span className="service-external-icon">&#8599;</span>
                            </a>
                          );
                        }

                        // Fallback — disabled
                        return (
                          <div
                            key={service.id}
                            className="dropdown-service-link disabled"
                            title="No URL configured for this service"
                          >
                            <span className="service-icon">&#9889;</span>
                            <span className="service-name">{service.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                <div className="dropdown-divider" />
                <button className="dropdown-logout" onClick={() => { logout(); setIsUserDropdownOpen(false); }}>
                  <span className="logout-icon">&#9898;</span>
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        {isMobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        <div className={`tabs ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <button
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => handleTabSelect('documents')}
          >
            Documents
          </button>

          <RequirePermission action="write" resource="documents">
            <button
              className={activeTab === 'upload' ? 'active' : ''}
              onClick={() => handleTabSelect('upload')}
            >
              Upload
            </button>
          </RequirePermission>

          <RequirePermission action="write" resource="documents">
            <button
              className={activeTab === 'directories' ? 'active' : ''}
              onClick={() => handleTabSelect('directories')}
            >
              Directories
            </button>
          </RequirePermission>

          <button
            className={activeTab === 'archive' ? 'active' : ''}
            onClick={() => handleTabSelect('archive')}
          >
            Archive
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'documents' && <DocumentSearch />}
          {activeTab === 'upload' && <DocumentUpload onUploaded={() => setActiveTab('documents')} />}
          {activeTab === 'directories' && <DirectoryManager />}
          {activeTab === 'archive' && <ArchiveView />}
        </div>
      </div>
    </div>
  );
};
