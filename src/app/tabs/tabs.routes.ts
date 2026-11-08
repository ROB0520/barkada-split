import type { Routes } from '@angular/router';

import { TabsPage } from './tabs.page';

export const tabsRoutes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('../home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'groups',
        children: [
          {
            path: '',
            loadComponent: () => import('../groups/groups.page').then((m) => m.GroupsPage),
          },
          {
            path: ':id',
            loadComponent: () => import('../group-detail/group-detail.page').then((m) => m.GroupDetailPage),
          },
          {
            path: ':id/expenses/:expenseId',
            loadComponent: () => import('../expense-detail/expense-detail.page').then((m) => m.ExpenseDetailPage),
          },
        ],
      },
      {
        path: 'expenses',
        loadComponent: () => import('../expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('../settings/settings.page').then((m) => m.SettingsPage),
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
    ],
  },
];
