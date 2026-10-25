import { createBrowserRouter } from 'react-router';
import {
  GuestOnly,
  RequireAuth,
  RequireRole,
} from '@/features/auth/route-guards';
import { MainLayout } from '@/layouts/main-layout';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';

export const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      {
        path: '/login',
        lazy: () =>
          import('@/pages/login-page').then((m) => ({
            Component: m.LoginPage,
          })),
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              {
                path: 'usuarios',
                lazy: () =>
                  import('@/pages/users-page').then((m) => ({
                    Component: m.UsersPage,
                  })),
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
