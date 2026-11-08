import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular';

import { ExpenseService } from '../services/expense.service';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';
import { PaymentService } from '../services/payment.service';
import { ReceiptService } from '../services/receipt.service';
import { StorageService } from '../services/storage.service';

import { APP_NAME, APP_VERSION } from './settings.config';

// settings page: about info plus the data wipe.
@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    CommonModule,
    FormsModule,
  ],
})
export class SettingsPage {
  private readonly storage = inject(StorageService);
  private readonly receipts = inject(ReceiptService);
  private readonly groups = inject(GroupService);
  private readonly members = inject(MemberService);
  private readonly expenses = inject(ExpenseService);
  private readonly payments = inject(PaymentService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);

  readonly appName = APP_NAME;
  readonly appVersion = APP_VERSION;
  readonly wiping = signal(false);

  async confirmWipe(): Promise<void> {
    const confirm = await this.alerts.create({
      header: 'Clear all data?',
      message: 'Every group, member, expense, and receipt photo on this device is removed. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: (): Promise<void> => this.performWipe(),
        },
      ],
    });
    await confirm.present();
  }

  // records first, then receipt files. stays on this page after.
  private async performWipe(): Promise<void> {
    if (this.wiping()) {
      return;
    }
    this.wiping.set(true);
    try {
      await this.storage.clearAllRecords();
      await this.receipts.clearAllFiles();
    } catch (error) {
      this.wiping.set(false);
      await this.presentWipeErrorAlert(error);
      return;
    }
    // only reset the lists when everything was deleted.
    this.groups.clearAll();
    this.members.clearAll();
    this.expenses.clearAll();
    this.payments.clearAll();
    this.wiping.set(false);
    const toast = await this.toasts.create({ message: 'All data cleared', duration: 2000 });
    await toast.present();
  }

  async confirmSampleData(): Promise<void> {
    const confirm = await this.alerts.create({
      header: 'Load sample data?',
      message: 'Your current groups and expenses will be replaced with sample data.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Load',
          handler: (): Promise<void> => this.performSampleData(),
        },
      ],
    });
    await confirm.present();
  }

  private async performSampleData(): Promise<void> {
    if (this.wiping()) {
      return;
    }
    this.wiping.set(true);
    try {
      await this.storage.clearAllRecords();
      await this.receipts.clearAllFiles();
    } catch (error) {
      this.wiping.set(false);
      await this.presentWipeErrorAlert(error);
      return;
    }
    this.groups.clearAll();
    this.members.clearAll();
    this.expenses.clearAll();
    this.payments.clearAll();
    try {
      await this.seedSampleData();
    } catch {
      this.wiping.set(false);
      const alert = await this.alerts.create({
        header: 'Something went wrong',
        message: 'Please try again.',
        buttons: ['OK'],
      });
      await alert.present();
      return;
    }
    this.wiping.set(false);
    const toast = await this.toasts.create({ message: 'Sample data loaded', duration: 2000 });
    await toast.present();
  }

  // two small groups so every screen has something to show.
  private async seedSampleData(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const beach = await this.groups.create('Beach Trip', 'La Union weekend');
    const ana = await this.members.create(beach.id, 'Ana');
    const ben = await this.members.create(beach.id, 'Ben');
    const cara = await this.members.create(beach.id, 'Cara');
    await this.expenses.create({
      groupId: beach.id,
      description: 'Resort downpayment',
      amount: 3000,
      payerId: ana.id,
      date: today,
    });
    await this.expenses.create({
      groupId: beach.id,
      description: 'Seafood dinner',
      amount: 2500,
      payerId: cara.id,
      date: today,
    });
    await this.payments.create({ groupId: beach.id, fromMemberId: ben.id, toMemberId: ana.id, amount: 500 });
    const lunch = await this.groups.create('Lunch Barkada', 'Office lunches');
    const jose = await this.members.create(lunch.id, 'Jose');
    const maria = await this.members.create(lunch.id, 'Maria');
    await this.expenses.create({
      groupId: lunch.id,
      description: 'Jollibee run',
      amount: 450,
      payerId: jose.id,
      date: today,
    });
    await this.expenses.create({
      groupId: lunch.id,
      description: 'Milk tea',
      amount: 300,
      payerId: maria.id,
      date: today,
    });
  }

  private async presentWipeErrorAlert(error: unknown): Promise<void> {
    const remaining = error instanceof Error ? error.message : 'Some data could not be removed.';
    const alert = await this.alerts.create({
      header: 'Could not clear everything',
      message: `${remaining} You can try again.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Retry',
          handler: (): Promise<void> => this.performWipe(),
        },
      ],
    });
    await alert.present();
  }
}
