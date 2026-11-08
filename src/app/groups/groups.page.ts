import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, chevronForward } from 'ionicons/icons';

import type { Group } from '../models/group';
import { GroupService } from '../services/group.service';
import { MemberService } from '../services/member.service';
import { GroupModalComponent } from '../shared/components/group-modal/group-modal.component';

// groups list. writes only happen when the modal closes with confirm.
@Component({
  selector: 'app-groups',
  templateUrl: './groups.page.html',
  styleUrls: ['./groups.page.scss'],
  imports: [
    IonButton,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    CommonModule,
    RouterLink,
  ],
})
export class GroupsPage {
  readonly groups = inject(GroupService);
  readonly members = inject(MemberService);
  private readonly modals = inject(ModalController);
  private readonly toasts = inject(ToastController);
  private readonly router = inject(Router);

  constructor() {
    addIcons({ add, chevronForward });
  }

  async ionViewWillEnter(): Promise<void> {
    try {
      await this.groups.load();
      for (const group of this.groups.groups()) {
        await this.members.loadGroup(group.id);
      }
    } catch {
      await this.presentErrorToast();
    }
  }

  memberCount(groupId: string): number {
    return this.members.membersForGroup(groupId).length;
  }

  async createGroup(): Promise<void> {
    await this.openGroupModal();
  }

  async openGroupModal(existing?: Group): Promise<void> {
    const modal = await this.modals.create({
      component: GroupModalComponent,
      componentProps: { group: existing ?? null },
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<{ name: string; description: string }>();
    if (role !== 'confirm' || !data) {
      return;
    }
    try {
      if (existing) {
        await this.groups.rename(existing.id, data.name, data.description);
        return;
      }
      const created = await this.groups.create(data.name, data.description);
      await this.router.navigate(['/tabs/groups', created.id]);
    } catch {
      await this.presentErrorToast();
    }
  }

  private async presentErrorToast(): Promise<void> {
    const toast = await this.toasts.create({ message: 'Something went wrong. Please try again.', duration: 2000 });
    await toast.present();
  }
}
