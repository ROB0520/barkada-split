import { Component, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular';

import type { Expense } from '../../../models/expense';
import { ExpenseService } from '../../../services/expense.service';
import { GroupService } from '../../../services/group.service';
import { formatAmount } from '../../../services/money';

@Component({
  selector: 'app-recent-activity',
  templateUrl: './recent-activity.component.html',
  styleUrls: ['./recent-activity.component.scss'],
  imports: [IonItem, IonLabel, IonList, IonNote],
})
export class RecentActivityComponent {
  private readonly expenses = inject(ExpenseService);
  private readonly groups = inject(GroupService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);

  @Input() limit = 5;

  readonly formatAmount = formatAmount;

  activity(): Expense[] {
    return this.expenses.expensesNewestFirst().slice(0, this.limit);
  }

  groupName(expense: Expense): string {
    return this.groups.getById(expense.groupId)?.name ?? 'Unknown group';
  }

  async openExpense(expense: Expense): Promise<void> {
    try {
      await this.router.navigate(['/tabs/groups', expense.groupId, 'expenses', expense.id]);
    } catch {
      await this.presentErrorAlert();
    }
  }

  // keep message fixed so user text never shows in alerts
  private async presentErrorAlert(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Something went wrong',
      message: 'Please try again.',
      buttons: ['OK'],
    });
    await alert.present();
  }
}
