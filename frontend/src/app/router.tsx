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
        // Recibo de pago: sin menú, para imprimir.
        path: '/reservas/:id/recibo/:paymentId',
        lazy: () =>
          import('@/pages/receipt-page').then((m) => ({
            Component: m.ReceiptPage,
          })),
      },
      {
        // Reporte de turno / corte de caja: sin menú, para imprimir.
        path: '/caja/turnos/:id',
        lazy: () =>
          import('@/pages/cash/shift-report-page').then((m) => ({
            Component: m.ShiftReportPage,
          })),
      },
      {
        // Tarjeta de registro: sin menú, para imprimir.
        path: '/reservas/:id/registro',
        lazy: () =>
          import('@/pages/registration-card-page').then((m) => ({
            Component: m.RegistrationCardPage,
          })),
      },
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: 'perfil',
            lazy: () =>
              import('@/pages/profile-page').then((m) => ({
                Component: m.ProfilePage,
              })),
          },
          {
            path: 'limpieza',
            lazy: () =>
              import('@/pages/cleaning-page').then((m) => ({
                Component: m.CleaningPage,
              })),
          },
          {
            path: 'reportes',
            lazy: () =>
              import('@/pages/reports-page').then((m) => ({
                Component: m.ReportsPage,
              })),
          },
          {
            path: 'habitaciones',
            lazy: () =>
              import('@/pages/rooms/rooms-layout').then((m) => ({
                Component: m.RoomsLayout,
              })),
            children: [
              {
                index: true,
                lazy: () =>
                  import('@/pages/rooms/rooms-board-page').then((m) => ({
                    Component: m.RoomsBoardPage,
                  })),
              },
              {
                path: 'tipos',
                lazy: () =>
                  import('@/pages/rooms/room-types-page').then((m) => ({
                    Component: m.RoomTypesPage,
                  })),
              },
            ],
          },
          {
            element: <RequireRole roles={['ADMIN', 'RECEPTION']} />,
            children: [
              {
                path: 'recepcion',
                lazy: () =>
                  import('@/pages/front-desk-page').then((m) => ({
                    Component: m.FrontDeskPage,
                  })),
              },
              {
                path: 'reservas',
                lazy: () =>
                  import('@/pages/reservations/reservations-layout').then(
                    (m) => ({
                      Component: m.ReservationsLayout,
                    }),
                  ),
                children: [
                  {
                    index: true,
                    lazy: () =>
                      import('@/pages/reservations/reservations-calendar-page').then(
                        (m) => ({ Component: m.ReservationsCalendarPage }),
                      ),
                  },
                  {
                    path: 'lista',
                    lazy: () =>
                      import('@/pages/reservations/reservations-list-page').then(
                        (m) => ({ Component: m.ReservationsListPage }),
                      ),
                  },
                ],
              },
              {
                path: 'caja',
                lazy: () =>
                  import('@/pages/cash/cash-page').then((m) => ({
                    Component: m.CashPage,
                  })),
              },
              {
                path: 'cuentas-por-cobrar',
                lazy: () =>
                  import('@/pages/receivables-page').then((m) => ({
                    Component: m.ReceivablesPage,
                  })),
              },
              {
                path: 'huespedes',
                lazy: () =>
                  import('@/pages/guests-page').then((m) => ({
                    Component: m.GuestsPage,
                  })),
              },
            ],
          },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              {
                path: 'configuracion',
                lazy: () =>
                  import('@/pages/settings-page').then((m) => ({
                    Component: m.SettingsPage,
                  })),
              },
              {
                path: 'caja/cortes',
                lazy: () =>
                  import('@/pages/cash/cash-history-page').then((m) => ({
                    Component: m.CashHistoryPage,
                  })),
              },
              {
                path: 'bitacora',
                lazy: () =>
                  import('@/pages/audit-page').then((m) => ({
                    Component: m.AuditPage,
                  })),
              },
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
