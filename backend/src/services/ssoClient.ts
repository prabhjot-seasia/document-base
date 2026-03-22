import axios from 'axios';
import { config } from '../config';
import { SSOUserInfo } from '../types';

export async function validateToken(token: string): Promise<SSOUserInfo> {
  try {
    const response = await axios.get<SSOUserInfo>(
      `${config.auth.serviceUrl}/sso/validate`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Client-ID': config.auth.clientId,
          'X-Client-Secret': config.auth.clientSecret,
        },
        timeout: 10000,
      }
    );
    return response.data;
  } catch (error: any) {
    return {
      valid: false,
      user_id: '',
      username: '',
      email: '',
      roles: [],
      groups: [],
      permissions: [],
      error: error.message || 'Failed to validate token',
    };
  }
}

export function hasPermission(
  userInfo: SSOUserInfo,
  resource: string,
  action: string
): boolean {
  return userInfo.permissions.some(
    (p) => p.resource === resource && p.action === action
  );
}
