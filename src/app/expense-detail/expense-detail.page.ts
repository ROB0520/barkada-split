import { Component, inject, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ActionSheetController,
  AlertController,
  ModalController,
} from '@ionic/angular';

import { formatDate } from '../models/date-util';
import type { Expense } from '../models/expense';
import type { Member } from '../models/member';
import { ExpenseService, orderMemberIds } from '../services/expense.service';
import { MemberService } from '../services/member.service';
import { formatAmount } from '../services/money';
import { ReceiptService } from '../services/receipt.service';
import { ReceiptPhotoComponent } from '../shared/components/receipt-photo/receipt-photo.component';
import { ReceiptViewerComponent } from '../shared/components/receipt-viewer/receipt-viewer.component';

@Component({
  selector: 'app-expense-detail',
  templateUrl: './expense-detail.page.html',
  styleUrls: ['./expense-detail.page.scss'],
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
    ReceiptPhotoComponent,
    RouterLink,
  ],
})
export class ExpenseDetailPage {
  private readonly expenses = inject(ExpenseService);
  private readonly members = inject(MemberService);
  private readonly receipts = inject(ReceiptService);
  private readonly modals = inject(ModalController);
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);

  @Input() id?: string;
  @Input() expenseId?: string;

  readonly formatAmount = formatAmount;
  readonly formatDate = formatDate;

  readonly receiptSrc = signal<string | null>(null);

  async ionViewWillEnter(): Promise<void> {
    if (this.id === undefined) {
      return;
    }
    try {
      await this.members.loadGroup(this.id);
      await this.expenses.loadGroup(this.id);
    } catch {
      // Load errors surface through the not-found fallback below.
    }
    await this.resolveReceipt();
  }

  // url is rebuilt on each load, never saved.
  private async resolveReceipt(): Promise<void> {
    const path = this.expense()?.receiptPath;
    if (path === undefined) {
      this.receiptSrc.set(null);
      return;
    }
    try {
      this.receiptSrc.set(await this.receipts.receiptUrl(path));
    } catch {
      this.receiptSrc.set(null);
    }
  }

  backHref(): string {
    return this.id === undefined ? '/tabs/groups' : `/tabs/groups/${this.id}`;
  }

  async openViewer(): Promise<void> {
    const path = this.expense()?.receiptPath;
    if (path === undefined) {
      return;
    }
    const viewer = await this.modals.create({
      component: ReceiptViewerComponent,
      componentProps: { receiptPath: path },
    });
    await viewer.present();
  }

  async replaceReceipt(): Promise<void> {
    const sheet = await this.sheets.create({
      header: 'Add receipt',
      buttons: [
        { text: 'Take photo', handler: (): Promise<void> => this.runReplace('camera') },
        { text: 'Choose from gallery', handler: (): Promise<void> => this.runReplace('gallery') },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  // save the new file first, then swap the record, then delete the old one.
  private async runReplace(source: 'camera' | 'gallery'): Promise<void> {
    const found = this.expense();
    if (found === undefined) {
      return;
    }
    const oldPath = found.receiptPath;
    let rel: string | null;
    try {
      rel = source === 'camera' ? await this.receipts.captureViaCamera() : await this.receipts.pickFromGallery();
    } catch (error) {
      await this.presentCaptureErrorAlert(error, source);
      return;
    }
    if (rel === null) {
      return;
    }
    try {
      await this.expenses.update(found.id, { receiptPath: rel });
    } catch {
      try {
        await this.receipts.deleteFile(rel);
      } catch {
        // leftover file cleanup only.
      }
      await this.presentErrorAlert();
      return;
    }
    if (oldPath !== undefined) {
      try {
        await this.receipts.deleteFile(oldPath);
      } catch {
        // old file cleanup only.
      }
    }
    await this.resolveReceipt();
  }

  async confirmRemoveReceipt(): Promise<void> {
    const confirm = await this.alerts.create({
      header: 'Remove receipt?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Remove', handler: (): Promise<void> => this.performReceiptRemove() },
      ],
    });
    await confirm.present();
  }

  private async performReceiptRemove(): Promise<void> {
    const found = this.expense();
    if (found === undefined || found.receiptPath === undefined) {
      return;
    }
    const oldPath = found.receiptPath;
    try {
      await this.expenses.update(found.id, { receiptPath: null });
    } catch {
      await this.presentErrorAlert();
      return;
    }
    try {
      await this.receipts.deleteFile(oldPath);
    } catch {
      // old file cleanup only.
    }
    await this.resolveReceipt();
  }

  private async presentCaptureErrorAlert(error: unknown, source: 'camera' | 'gallery'): Promise<void> {
    if (ReceiptService.isCaptureCancel(error)) {
      return;
    }
    if (ReceiptService.isPermissionDenial(error) && source === 'camera') {
      const offer = await this.alerts.create({
        header: 'Camera blocked',
        message: 'Camera access was blocked. You can choose from the gallery instead.',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          { text: 'Use gallery', handler: (): Promise<void> => this.runReplace('gallery') },
        ],
      });
      await offer.present();
      return;
    }
    if (ReceiptService.isPermissionDenial(error)) {
      const blocked = await this.alerts.create({
        header: 'Gallery blocked',
        message: 'Gallery access was blocked. Nothing was changed.',
        buttons: ['OK'],
      });
      await blocked.present();
      return;
    }
    const unavailable = await this.alerts.create({
      header: 'Camera unavailable',
      message: 'The camera is unavailable. You can continue without a photo.',
      buttons: ['OK'],
    });
    await unavailable.present();
  }

  // generic message on purpose, raw errors can hold user input.
  private async presentErrorAlert(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Something went wrong',
      message: 'Please try again.',
      buttons: ['OK'],
    });
    await alert.present();
  }

  expense(): Expense | undefined {
    if (this.id === undefined || this.expenseId === undefined) {
      return undefined;
    }
    return this.expenses.expensesForGroup(this.id).find((expense: Expense) => expense.id === this.expenseId);
  }

  payerName(): string {
    const found = this.expense();
    if (found === undefined || this.id === undefined) {
      return '';
    }
    return (
      this.members.membersForGroup(this.id).find((member: Member) => member.id === found.payerId)?.name ??
      'Unknown member'
    );
  }

  // split comes from the saved snapshot.
  splitRows(): { id: string; name: string; share: number }[] {
    const found = this.expense();
    if (found === undefined || this.id === undefined) {
      return [];
    }
    const byId = new Map(this.members.membersForGroup(this.id).map((member: Member) => [member.id, member]));
    const rows: { id: string; name: string; share: number }[] = [];
    for (const memberId of orderMemberIds([...byId.values()])) {
      if (Object.prototype.hasOwnProperty.call(found.shares, memberId)) {
        rows.push({
          id: memberId,
          name: byId.get(memberId)?.name ?? 'Unknown member',
          share: found.shares[memberId],
        });
      }
    }
    for (const memberId of Object.keys(found.shares)) {
      if (!byId.has(memberId)) {
        rows.push({ id: memberId, name: 'Unknown member', share: found.shares[memberId] });
      }
    }
    return rows;
  }

  sharesTotal(): number {
    const found = this.expense();
    if (found === undefined) {
      return 0;
    }
    return Object.values(found.shares).reduce((sum: number, share: number) => sum + share, 0);
  }

  sharesDiffer(): boolean {
    const found = this.expense();
    if (found === undefined) {
      return false;
    }
    const values: number[] = Object.values(found.shares);
    return values.some((value: number) => value !== values[0]);
  }
}
