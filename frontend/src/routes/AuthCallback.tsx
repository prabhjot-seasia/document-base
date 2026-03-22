import { useEffect } from 'react';
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.REACT_APP_AUTH_SERVICE_URL || 'http://localhost:8080';
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID || 'document-base-clientid';

let exchangeStarted = false;

export const AuthCallback: React.FC = () => {
  useEffect(() => {
    if (exchangeStarted) return;
    exchangeStarted = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      window.location.replace('/');
      return;
    }

    axios
      .post(`${AUTH_SERVICE_URL}/auth/token`, {
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        redirect_uri: `${window.location.origin}/auth/callback`,
      })
      .then((response) => {
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('jwt', access_token);
        if (refresh_token) {
          localStorage.setItem('refresh_token', refresh_token);
        }
        window.location.replace('/');
      })
      .catch(() => {
        window.location.replace('/');
      });
  }, []);

  return null;
};
