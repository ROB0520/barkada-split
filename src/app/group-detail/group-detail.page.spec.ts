import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular';

import { GroupDetailPage } from './group-detail.page';

describe('GroupDetailPage', () => {
  let component: GroupDetailPage;
  let fixture: ComponentFixture<GroupDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ModalController, useValue: {} },
        { provide: AlertController, useValue: {} },
        { provide: ToastController, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
