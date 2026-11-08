import { Component, inject, Input } from '@angular/core';
import { AlertController, IonButton, IonItem, IonLabel, IonList, ToastController } from '@ionic/angular';

import { formatDate, formatDateTime } from '../../../models/date-util';
import type { Payment } from '../../../models/payment';
import { BalanceService, type Settlement } from '../../../services/balance.service';
import { MemberService } from '../../../services/member.service';
import { formatAmount, parseAmount } from '../../../services/money';
import { PaymentService } from '../../../services/payment.service';

@Component({
  selector: 'app-settle-up-plan',
  templateUrl: './settle-up-plan.component.html',
  styleUrls: ['./settle-up-plan.component.scss'],
  imports: [IonButton, IonItem, IonLabel, IonList],
})
export class SettleUpPlanComponent {
  private readonly balances = inject(BalanceService);
  private readonly members = inject(MemberService);
  private readonly payments = inject(PaymentService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  @Input() groupId?: string;

  readonly formatAmount = formatAmount;

  plan(): Settlement[] {
    if (this.groupId === undefined) {
      return [];
    }
    return this.balances.settlePlanForGroup(this.groupId);
  }

  recorded(): Payment[] {
    if (this.groupId === undefined) {
      return [];
    }
    return [...this.payments.paymentsForGroup(this.groupId)].reverse();
  }

  memberName(memberId: string): string {
    if (this.groupId === undefined) {
      return 'Unknown member';
    }
    return this.members.membersForGroup(this.groupId).find((m) => m.id === memberId)?.name ?? 'Unknown member';
  }

  sentence(payment: Settlement): string {
    return `${this.memberName(payment.fromMemberId)} pays ${this.memberName(payment.toMemberId)} ${formatAmount(payment.amount)}`;
  }

  paymentSentence(payment: Payment): string {
    return `${this.memberName(payment.fromMemberId)} paid ${this.memberName(payment.toMemberId)} ${formatAmount(payment.amount)}`;
  }

  paymentWhen(payment: Payment): string {
    if (!isNaN(new Date(payment.createdAt).getTime())) {
      return formatDateTime(payment.createdAt);
    }
    return formatDate(payment.date);
  }

  // amount starts full but can be lowered for a partial payment
  async confirmPayment(payment: Settlement): Promise<void> {
    const confirm = await this.alerts.create({
      header: 'Record payment?',
      message: this.sentence(payment),
      inputs: [{ name: 'amount', type: 'text', label: 'Amount paid', value: `${payment.amount}` }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Record',
          handler: (data?: { amount?: string }): Promise<void> => this.recordPayment(payment, data?.amount),
        },
      ],
    });
    await confirm.present();
  }

  private async recordPayment(payment: Settlement, rawAmount?: string): Promise<void> {
    if (this.groupId === undefined) {
      return;
    }
    let amount = payment.amount;
    if (rawAmount !== undefined) {
      try {
        amount = parseAmount(rawAmount);
      } catch {
        const alert = await this.alerts.create({
          header: 'Invalid amount',
          message: 'Enter a positive peso amount.',
          buttons: ['OK'],
        });
        await alert.present();
        return;
      }
    }
    try {
      await this.payments.create({
        groupId: this.groupId,
        fromMemberId: payment.fromMemberId,
        toMemberId: payment.toMemberId,
        amount,
      });
    } catch {
      const alert = await this.alerts.create({
        header: 'Something went wrong',
        message: 'Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    const toast = await this.toasts.create({ message: 'Payment recorded', duration: 2000 });
    await toast.present();
  }

  async undoPayment(id: string): Promise<void> {
    try {
      await this.payments.delete(id);
    } catch {
      const alert = await this.alerts.create({
        header: 'Something went wrong',
        message: 'Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    const toast = await this.toasts.create({ message: 'Payment removed', duration: 2000 });
    await toast.present();
  }
}
