import { MinimalUserInfo } from "./auth.types";

export const toMinimalUser = (user: {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
}): MinimalUserInfo => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
});


function generateDefaultAvatar(name: string, email: string): string {
  // Option 1: UI Avatars (text-based)
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=200`;
  
  // Option 2: DiceBear (illustrated avatars)
  // return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
  
  // Option 3: Gravatar
  // const emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
  // return `https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=200`;
}