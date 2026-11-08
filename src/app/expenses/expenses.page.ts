import { Component, inject } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar, ToastController } from '@ionic/angular';

import { ExpenseService } from '../services/expense.service';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';
import { RecentActivityComponent } from '../shared/components/recent-activity/recent-activity.component';

// cross-group expense list, newest first.
@Component({
  selector: 'app-expenses',
  templateUrl: './expenses.page.html',
  styleUrls: ['./expenses.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, RecentActivityComponent],
})
export class ExpensesPage {
  readonly expenses = inject(ExpenseService);
  private readonly groups = inject(GroupService);
  private readonly members = inject(MemberService);
  private readonly toasts = inject(ToastController);

  async ionViewWillEnter(): Promise<void> {
    try {
      await this.groups.load();
      await this.members.loadAll();
      await this.expenses.loadAll();
    } catch {
      await this.presentErrorToast();
    }
  }

  private async presentErrorToast(): Promise<void> {
    const toast = await this.toasts.create({ message: 'Something went wrong. Please try again.', duration: 2000 });
    await toast.present();
  }
}
