import { Component, inject, Input } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, ModalController } from '@ionic/angular';

import { ReceiptPhotoComponent } from '../receipt-photo/receipt-photo.component';

@Component({
  selector: 'app-receipt-viewer',
  templateUrl: './receipt-viewer.component.html',
  styleUrls: ['./receipt-viewer.component.scss'],
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, ReceiptPhotoComponent],
})
export class ReceiptViewerComponent {
  private readonly modals = inject(ModalController);

  @Input() receiptPath: string | undefined;

  async close(): Promise<void> {
    await this.modals.dismiss(undefined, 'cancel');
  }
}
