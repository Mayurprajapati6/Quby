import { MinimalUserInfo } from './auth.types';

export function toMinimalUser(data: {
  id:          string;
  email:       string;
  name:        string;
  role:        MinimalUserInfo['role'];
  businessId?: string;
}): MinimalUserInfo {
  return {
    id:          data.id,
    email:       data.email,
    name:        data.name,
    role:        data.role,
    businessId:  data.businessId,
  };
}