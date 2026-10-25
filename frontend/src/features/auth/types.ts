export type Role = 'ADMIN' | 'RECEPTION' | 'HOUSEKEEPING';

export interface User {
  id: string;
  hotelId: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
