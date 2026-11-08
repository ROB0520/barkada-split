import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';

import { BalanceService } from '../services/balance.service';
import { ExpenseService } from '../services/expense.service';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';
import { formatAmount } from '../services/money';
import { PaymentService } from '../services/payment.service';
import { GroupModalComponent } from '../shared/components/group-modal/group-modal.component';
import { RecentActivityComponent } from '../shared/components/recent-activity/recent-activity.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    RecentActivityComponent,
  ],
})
export class HomePage {
  readonly groups = inject(GroupService);
  readonly expenses = inject(ExpenseService);
  private readonly members = inject(MemberService);
  private readonly balances = inject(BalanceService);
  private readonly payments = inject(PaymentService);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly router = inject(Router);

  readonly formatAmount = formatAmount;

  readonly showZeroGroupHint = signal(false);

  async ionViewWillEnter(): Promise<void> {
    this.showZeroGroupHint.set(false);
    try {
      await this.groups.load();
      await this.members.loadAll();
      await this.expenses.loadAll();
      await this.payments.loadAll();
    } catch {
      await this.presentErrorToast();
    }
  }

  headlineTotal(): number {
    return this.balances.totalAmount();
  }

  async createGroup(): Promise<void> {
    const modal = await this.modals.create({
      component: GroupModalComponent,
      componentProps: { group: null },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string; description: string }>();
    if (role !== 'confirm' || !data) {
      return;
    }
    try {
      const created = await this.groups.create(data.name, data.description);
      await this.router.navigate(['/tabs/groups', created.id]);
    } catch {
      await this.presentErrorToast();
    }
  }

  async recordExpense(): Promise<void> {
    if (this.groups.groupCount() === 0) {
      this.showZeroGroupHint.set(true);
      return;
    }
    try {
      await this.router.navigate(['/tabs/groups']);
    } catch {
      await this.presentErrorToast();
    }
  }

  private async presentErrorToast(): Promise<void> {
    const toast = await this.toasts.create({ message: 'Something went wrong. Please try again.', duration: 2000 });
    await toast.present();
  }
}
