import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, pencil, trash } from 'ionicons/icons';

import { formatDate } from '../models/date-util';
import type { Expense } from '../models/expense';
import type { Group } from '../models/group';
import type { Member } from '../models/member';
import { BalanceService, type MemberBalance, type Settlement } from '../services/balance.service';
import { ExpenseService, orderMemberIds } from '../services/expense.service';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';
import { formatAmount } from '../services/money';
import { PaymentService } from '../services/payment.service';
import { StorageService } from '../services/storage.service';
import { BalanceSummaryComponent } from '../shared/components/balance-summary/balance-summary.component';
import { ExpenseModalComponent } from '../shared/components/expense-modal/expense-modal.component';
import { GroupModalComponent } from '../shared/components/group-modal/group-modal.component';
import { MemberModalComponent } from '../shared/components/member-modal/member-modal.component';
import { SettleUpPlanComponent } from '../shared/components/settle-up-plan/settle-up-plan.component';

@Component({
  selector: 'app-group-detail',
  templateUrl: './group-detail.page.html',
  styleUrls: ['./group-detail.page.scss'],
  imports: [
    BalanceSummaryComponent,
    SettleUpPlanComponent,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    CommonModule,
    RouterLink,
  ],
})
export class GroupDetailPage {
  readonly groups = inject(GroupService);
  readonly members = inject(MemberService);
  private readonly expenses = inject(ExpenseService);
  private readonly payments = inject(PaymentService);
  private readonly balanceService = inject(BalanceService);
  private readonly storage = inject(StorageService);
  private readonly modals = inject(ModalController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly router = inject(Router);

  @Input() id?: string;

  constructor() {
    addIcons({ add, pencil, trash });
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.id === undefined) {
      return;
    }
    try {
      await this.groups.load();
      await this.members.loadGroup(this.id);
      await this.expenses.loadGroup(this.id);
      await this.payments.loadGroup(this.id);
    } catch {
      await this.presentErrorAlert();
    }
  }

  group(): Group | undefined {
    if (this.id === undefined) {
      return undefined;
    }
    return this.groups.getById(this.id);
  }

  roster(): Member[] {
    if (this.id === undefined) {
      return [];
    }
    const byId = new Map(this.members.membersForGroup(this.id).map((member: Member) => [member.id, member]));
    const ordered: Member[] = [];
    for (const memberId of orderMemberIds([...byId.values()])) {
      const member = byId.get(memberId);
      if (member !== undefined) {
        ordered.push(member);
      }
    }
    return ordered;
  }

  readonly formatAmount = formatAmount;
  readonly formatDate = formatDate;

  history(): Expense[] {
    if (this.id === undefined) {
      return [];
    }
    return this.expenses.expensesForGroup(this.id);
  }

  payerName(expense: Expense): string {
    return (
      this.members.membersForGroup(expense.groupId).find((member: Member) => member.id === expense.payerId)?.name ??
      'Unknown member'
    );
  }

  balances(): { member: Member; balance: MemberBalance }[] {
    if (this.id === undefined) {
      return [];
    }
    const byId = new Map(this.members.membersForGroup(this.id).map((member: Member) => [member.id, member]));
    return this.balanceService.balancesForGroup(this.id).flatMap((balance: MemberBalance) => {
      const member = byId.get(balance.memberId);
      return member ? [{ member, balance }] : [];
    });
  }

  settlePlan(): Settlement[] {
    if (this.id === undefined) {
      return [];
    }
    return this.balanceService.settlePlanForGroup(this.id);
  }

  memberName(memberId: string): string {
    if (this.id === undefined) {
      return 'Unknown member';
    }
    return (
      this.members.membersForGroup(this.id).find((member: Member) => member.id === memberId)?.name ?? 'Unknown member'
    );
  }

  async openExpense(expense: Expense): Promise<void> {
    if (this.id === undefined) {
      return;
    }
    try {
      await this.router.navigate(['/tabs/groups', this.id, 'expenses', expense.id]);
    } catch {
      await this.presentErrorAlert();
    }
  }

  async addExpense(): Promise<void> {
    if (this.id === undefined) {
      return;
    }
    const modal = await this.modals.create({
      component: ExpenseModalComponent,
      componentProps: { expense: null, groupId: this.id },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{
      description: string;
      amount: number;
      payerId: string;
      date: string;
      receiptPath: string | undefined;
    }>();
    if (role === 'confirm' && data) {
      try {
        await this.expenses.create({
          groupId: this.id,
          description: data.description,
          amount: data.amount,
          payerId: data.payerId,
          date: data.date,
          receiptPath: data.receiptPath,
        });
      } catch {
        await this.presentErrorAlert();
      }
    }
  }

  async editExpense(expense: Expense, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    if (this.id === undefined) {
      return;
    }
    const modal = await this.modals.create({
      component: ExpenseModalComponent,
      componentProps: { expense, groupId: this.id },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{
      description: string;
      amount: number;
      payerId: string;
      date: string;
      receiptPath: string | undefined;
    }>();
    if (role === 'confirm' && data) {
      try {
        await this.expenses.update(expense.id, {
          description: data.description,
          amount: data.amount,
          payerId: data.payerId,
          date: data.date,
          receiptPath: data.receiptPath,
        });
      } catch {
        await this.presentErrorAlert();
      }
    }
  }

  async deleteExpense(expense: Expense, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    const shortDescription =
      expense.description.length > 30 ? `${expense.description.slice(0, 30)}…` : expense.description;
    const confirm = await this.alerts.create({
      header: `Delete ${shortDescription}?`,
      message: formatAmount(expense.amount),
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: (): Promise<void> => this.performExpenseDelete(expense.id),
        },
      ],
    });
    await confirm.present();
  }

  private async performExpenseDelete(id: string): Promise<void> {
    try {
      await this.expenses.delete(id);
    } catch {
      await this.presentErrorAlert();
      return;
    }
    const toast = await this.toasts.create({ message: 'Expense deleted', duration: 2000 });
    await toast.present();
  }

  async editGroup(): Promise<void> {
    const current = this.group();
    if (current === undefined) {
      return;
    }
    const modal = await this.modals.create({
      component: GroupModalComponent,
      componentProps: { group: current },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string; description: string }>();
    if (role === 'confirm' && data) {
      try {
        await this.groups.rename(current.id, data.name, data.description);
      } catch {
        await this.presentErrorAlert();
      }
    }
  }

  async addMember(): Promise<void> {
    if (this.id === undefined) {
      return;
    }
    const modal = await this.modals.create({
      component: MemberModalComponent,
      componentProps: { member: null },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string }>();
    if (role === 'confirm' && data) {
      try {
        await this.members.create(this.id, data.name);
      } catch {
        await this.presentErrorAlert();
      }
    }
  }

  async renameMember(member: Member, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    const modal = await this.modals.create({
      component: MemberModalComponent,
      componentProps: { member },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string }>();
    if (role === 'confirm' && data) {
      try {
        await this.members.rename(member.id, data.name);
      } catch {
        await this.presentErrorAlert();
      }
    }
  }

  async removeMember(member: Member, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await this.confirmRemoveMember(member);
  }

  async confirmRemoveMember(member: Member): Promise<void> {
    let involvement;
    try {
      involvement = await this.expenses.countMemberInvolvement(member.groupId, member.id);
    } catch {
      await this.presentErrorAlert();
      return;
    }
    if (involvement.count > 0) {
      await this.showBlockedRemoval(member, involvement);
      return;
    }
    const groupName = this.group()?.name ?? 'this group';
    const confirm = await this.alerts.create({
      header: `Remove ${member.name} from ${groupName}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          handler: (): Promise<void> => this.deleteMemberConfirmed(member),
        },
      ],
    });
    await confirm.present();
  }

  private async deleteMemberConfirmed(member: Member): Promise<void> {
    try {
      await this.members.delete(member.id);
    } catch (error) {
      if (error instanceof Error && error.message.includes("can't be removed")) {
        const involvement = await this.expenses.countMemberInvolvement(member.groupId, member.id);
        await this.showBlockedRemoval(member, involvement);
        return;
      }
      await this.presentErrorAlert();
    }
  }

  // blocked members show a reason instead of being deleted.
  private async showBlockedRemoval(member: Member, involvement: { count: number; asPayer: boolean }): Promise<void> {
    const role = involvement.asPayer ? 'they are the payer' : 'in the split';
    const reason =
      involvement.count > 0
        ? `${member.name} can't be removed — ${role} of ${involvement.count} recorded expense(s).`
        : `${member.name} can't be removed.`;
    const blocked = await this.alerts.create({
      header: 'Cannot remove member',
      message: reason,
      buttons: ['OK'],
    });
    await blocked.present();
  }

  async deleteGroup(): Promise<void> {
    const current = this.group();
    if (current === undefined) {
      return;
    }
    let memberIds: string[];
    let expenseIds: string[];
    try {
      memberIds = await this.storage.readIds(this.storage.groupMembersKey(current.id));
      expenseIds = await this.storage.readIds(this.storage.groupExpensesKey(current.id));
    } catch {
      await this.presentErrorAlert();
      return;
    }
    const confirm = await this.alerts.create({
      header: `Delete ${current.name}?`,
      message: `Its ${memberIds.length} members and ${expenseIds.length} expenses will also be removed.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: (): Promise<void> => this.performGroupDelete(current.id),
        },
      ],
    });
    await confirm.present();
  }

  private async performGroupDelete(id: string): Promise<void> {
    try {
      await this.groups.delete(id);
    } catch {
      await this.presentErrorAlert();
      return;
    }
    await this.router.navigate(['/tabs/groups']);
    const toast = await this.toasts.create({ message: 'Group deleted', duration: 2000 });
    await toast.present();
  }

  // generic message on purpose, stays the same everywhere.
  private async presentErrorAlert(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Something went wrong',
      message: 'Please try again.',
      buttons: ['OK'],
    });
    await alert.present();
  }
}
