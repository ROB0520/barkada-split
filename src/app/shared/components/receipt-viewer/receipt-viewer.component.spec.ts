import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController } from '@ionic/angular';

import { ReceiptViewerComponent } from './receipt-viewer.component';

describe('ReceiptViewerComponent', () => {
  let component: ReceiptViewerComponent;
  let fixture: ComponentFixture<ReceiptViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ModalController, useValue: {} }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReceiptViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
