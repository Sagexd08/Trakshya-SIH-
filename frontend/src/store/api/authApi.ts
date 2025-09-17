/**
 * Authentication API using RTK Query
 * Handles user authentication, authorization, and profile management
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { config } from '@/config';
import type { User, UserRole, Permission } from '../slices/authSlice';

// Base query configuration
const baseQuery = fetchBaseQuery({
  baseUrl: '/api/auth',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as any).auth?.user?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

// Auth API definition
export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  tagTypes: ['User', 'Profile', 'Session', 'Permissions'],
  
  endpoints: (builder) => ({
    // Authentication
    login: builder.mutation<{
      user: User;
      token: string;
      refreshToken: string;
      expiresAt: string;
    }, {
      email: string;
      password: string;
      rememberMe?: boolean;
    }>({
      query: (credentials) => ({
        url: '/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User', 'Session'],
    }),
    
    logout: builder.mutation<{
      success: boolean;
    }, void>({
      query: () => ({
        url: '/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User', 'Session'],
    }),
    
    refreshToken: builder.mutation<{
      token: string;
      expiresAt: string;
    }, {
      refreshToken: string;
    }>({
      query: ({ refreshToken }) => ({
        url: '/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
    }),
    
    // Registration (if enabled)
    register: builder.mutation<{
      user: User;
      token: string;
    }, {
      email: string;
      password: string;
      name: string;
      department: string;
      role?: UserRole;
    }>({
      query: (userData) => ({
        url: '/register',
        method: 'POST',
        body: userData,
      }),
    }),
    
    // Password Management
    forgotPassword: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      email: string;
    }>({
      query: ({ email }) => ({
        url: '/forgot-password',
        method: 'POST',
        body: { email },
      }),
    }),
    
    resetPassword: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      token: string;
      password: string;
      confirmPassword: string;
    }>({
      query: (data) => ({
        url: '/reset-password',
        method: 'POST',
        body: data,
      }),
    }),
    
    changePassword: builder.mutation<{
      success: boolean;
      message: string;
    }, {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }>({
      query: (data) => ({
        url: '/change-password',
        method: 'POST',
        body: data,
      }),
    }),
    
    // Profile Management
    getProfile: builder.query<User, void>({
      query: () => '/profile',
      providesTags: ['Profile'],
    }),
    
    updateProfile: builder.mutation<User, Partial<User>>({
      query: (updates) => ({
        url: '/profile',
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: ['Profile', 'User'],
    }),
    
    updatePreferences: builder.mutation<User, Partial<User['preferences']>>({
      query: (preferences) => ({
        url: '/profile/preferences',
        method: 'PUT',
        body: { preferences },
      }),
      invalidatesTags: ['Profile'],
    }),
    
    uploadAvatar: builder.mutation<{
      avatarUrl: string;
    }, FormData>({
      query: (formData) => ({
        url: '/profile/avatar',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['Profile'],
    }),
    
    // Session Management
    getCurrentSession: builder.query<{
      user: User;
      sessionId: string;
      expiresAt: string;
      lastActivity: string;
    }, void>({
      query: () => '/session',
      providesTags: ['Session'],
    }),
    
    extendSession: builder.mutation<{
      expiresAt: string;
    }, void>({
      query: () => ({
        url: '/session/extend',
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),
    
    getActiveSessions: builder.query<Array<{
      id: string;
      deviceInfo: string;
      location: string;
      lastActivity: string;
      current: boolean;
    }>, void>({
      query: () => '/sessions',
    }),
    
    revokeSession: builder.mutation<{
      success: boolean;
    }, string>({
      query: (sessionId) => ({
        url: `/sessions/${sessionId}`,
        method: 'DELETE',
      }),
    }),
    
    // Permissions and Roles
    getUserPermissions: builder.query<{
      permissions: Permission[];
      role: UserRole;
    }, void>({
      query: () => '/permissions',
      providesTags: ['Permissions'],
    }),
    
    checkPermission: builder.query<{
      hasPermission: boolean;
    }, Permission>({
      query: (permission) => ({
        url: '/permissions/check',
        params: { permission },
      }),
    }),
    
    // User Management (Admin only)
    getUsers: builder.query<{
      users: User[];
      total: number;
    }, {
      page?: number;
      limit?: number;
      role?: UserRole;
      department?: string;
      search?: string;
    }>({
      query: (params = {}) => ({
        url: '/users',
        params: {
          page: 1,
          limit: 20,
          ...params,
        },
      }),
      providesTags: ['User'],
    }),
    
    getUser: builder.query<User, string>({
      query: (userId) => `/users/${userId}`,
      providesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    
    createUser: builder.mutation<User, {
      email: string;
      name: string;
      role: UserRole;
      department: string;
      permissions?: Permission[];
    }>({
      query: (userData) => ({
        url: '/users',
        method: 'POST',
        body: userData,
      }),
      invalidatesTags: ['User'],
    }),
    
    updateUser: builder.mutation<User, {
      userId: string;
      updates: Partial<User>;
    }>({
      query: ({ userId, updates }) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { userId }) => [
        { type: 'User', id: userId },
        'User',
      ],
    }),
    
    deleteUser: builder.mutation<{
      success: boolean;
    }, string>({
      query: (userId) => ({
        url: `/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['User'],
    }),
    
    // Audit Logs
    getAuditLogs: builder.query<{
      logs: Array<{
        id: string;
        userId: string;
        action: string;
        details: any;
        timestamp: string;
        ipAddress: string;
        userAgent: string;
      }>;
      total: number;
    }, {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
    }>({
      query: (params = {}) => ({
        url: '/audit-logs',
        params: {
          page: 1,
          limit: 50,
          ...params,
        },
      }),
    }),
    
    // Two-Factor Authentication
    enableTwoFactor: builder.mutation<{
      qrCode: string;
      backupCodes: string[];
    }, void>({
      query: () => ({
        url: '/2fa/enable',
        method: 'POST',
      }),
    }),
    
    verifyTwoFactor: builder.mutation<{
      success: boolean;
    }, {
      code: string;
    }>({
      query: ({ code }) => ({
        url: '/2fa/verify',
        method: 'POST',
        body: { code },
      }),
    }),
    
    disableTwoFactor: builder.mutation<{
      success: boolean;
    }, {
      password: string;
    }>({
      query: ({ password }) => ({
        url: '/2fa/disable',
        method: 'POST',
        body: { password },
      }),
    }),
  }),
});

// Export hooks
export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUpdatePreferencesMutation,
  useUploadAvatarMutation,
  useGetCurrentSessionQuery,
  useExtendSessionMutation,
  useGetActiveSessionsQuery,
  useRevokeSessionMutation,
  useGetUserPermissionsQuery,
  useCheckPermissionQuery,
  useGetUsersQuery,
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetAuditLogsQuery,
  useEnableTwoFactorMutation,
  useVerifyTwoFactorMutation,
  useDisableTwoFactorMutation,
} = authApi;

export default authApi;
