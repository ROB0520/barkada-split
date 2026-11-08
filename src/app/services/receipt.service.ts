import { Injectable, signal } from '@angular/core';
import { App, type RestoredListenerEvent } from '@capacitor/app';
import { Camera, CameraErrorCode } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

// receipt photos live in the app data folder, only the short path is stored.
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  readonly restoredPendingPath = signal<string | null>(null);
  readonly restoreNotice = signal<string | null>(null);

  constructor() {
    // the os can restart the app mid-capture, this picks that photo up.
    void this.registerRestoreListener();
  }
  // camera photo, null when the user backs out.
  async captureViaCamera(): Promise<string | null> {
    try {
      // keeps files small but still readable.
      const result = await Camera.takePhoto({ quality: 80 });
      if (result.uri === undefined || !Capacitor.isNativePlatform()) {
        // on web there is no native file, so nothing to save.
        return null;
      }
      return await this.saveToPrivateDir(result.uri);
    } catch (error) {
      if (ReceiptService.isCancel(error)) {
        return null;
      }
      throw error;
    }
  }

  async pickFromGallery(): Promise<string | null> {
    try {
      const { results } = await Camera.chooseFromGallery({});
      const first = results[0];
      if (first?.uri === undefined || !Capacitor.isNativePlatform()) {
        return null;
      }
      return await this.saveToPrivateDir(first.uri);
    } catch (error) {
      if (ReceiptService.isCancel(error)) {
        return null;
      }
      throw error;
    }
  }

  // copies the photo into our folder and returns its short path.
  async saveToPrivateDir(sourceUri: string): Promise<string> {
    if (typeof sourceUri !== 'string' || sourceUri.trim() === '') {
      throw new Error('Receipt source must be a non-empty URI');
    }
    const { data } = await Filesystem.readFile({ path: sourceUri });
    const rel = `receipts/${crypto.randomUUID()}.jpeg`;
    await Filesystem.writeFile({
      path: rel,
      data: data as string,
      directory: Directory.Data,
      recursive: true,
    });
    return rel;
  }

  // builds a fresh view link each time, saved links break after restart.
  async receiptUrl(relativePath: string): Promise<string> {
    ReceiptService.assertRelativePath(relativePath);
    const { uri } = await Filesystem.getUri({ path: relativePath, directory: Directory.Data });
    return Capacitor.convertFileSrc(uri);
  }

  // wipes every receipt file, a missing folder just means clean.
  async clearAllFiles(): Promise<void> {
    let names: string[];
    try {
      const listing = await Filesystem.readdir({ path: 'receipts', directory: Directory.Data });
      names = listing.files.map((entry) => (typeof entry === 'string' ? entry : entry.name));
    } catch {
      console.warn('[receipt] receipts directory absent — already clean');
      return;
    }
    for (const name of names) {
      await this.deleteFile(`receipts/${name}`);
    }
    const proof = await Filesystem.readdir({ path: 'receipts', directory: Directory.Data });
    if (proof.files.length > 0) {
      throw new Error(`${proof.files.length} receipt file(s) could not be removed. Please try again.`);
    }
  }

  // missing files count as deleted.
  async deleteFile(relativePath: string): Promise<void> {
    ReceiptService.assertRelativePath(relativePath);
    try {
      await Filesystem.deleteFile({ path: relativePath, directory: Directory.Data });
    } catch {
      console.warn(`[receipt] file already gone: ${relativePath}`);
    }
  }

  // hands the recovered photo to the form and clears it.
  consumeRestoredPath(): string | null {
    const pending = this.restoredPendingPath();
    this.restoredPendingPath.set(null);
    this.restoreNotice.set(null);
    return pending;
  }

  // listens for a photo taken right before the os killed the app.
  private async registerRestoreListener(): Promise<void> {
    try {
      await App.addListener('appRestoredResult', (event: RestoredListenerEvent): void => {
        void this.handleRestoredResult(event);
      });
    } catch {
      console.warn('[receipt] restore listener unavailable; kill-path recovery degraded');
    }
  }

  // saves the recovered photo the same way as a fresh one.
  private async handleRestoredResult(event: RestoredListenerEvent): Promise<void> {
    if (event.pluginId !== 'Camera') {
      return;
    }
    if (!event.success) {
      this.restoreNotice.set('We could not recover your photo. You can try again.');
      return;
    }
    if (
      event.methodName !== 'takePhoto' &&
      event.methodName !== 'chooseFromGallery' &&
      event.methodName !== 'getPhoto'
    ) {
      return;
    }
    const data = event.data as { uri?: string; results?: { uri?: string }[] } | undefined;
    const uri = data?.uri ?? data?.results?.[0]?.uri;
    if (uri === undefined || uri.trim() === '') {
      this.restoreNotice.set('We could not recover your photo. You can try again.');
      return;
    }
    try {
      const rel = await this.saveToPrivateDir(uri);
      this.restoredPendingPath.set(rel);
      this.restoreNotice.set('We recovered your photo.');
    } catch {
      this.restoreNotice.set('We could not recover your photo. You can try again.');
    }
  }

  // backing out returns null, real errors still throw.
  private static isCancel(error: unknown): boolean {
    const code = (error as { code?: string } | null | undefined)?.code;
    return code === CameraErrorCode.TakePhotoCancelled || code === CameraErrorCode.ChooseMediaCancelled;
  }

  static isCaptureCancel(error: unknown): boolean {
    return ReceiptService.isCancel(error);
  }

  // true when the user said no to camera or gallery.
  static isPermissionDenial(error: unknown): boolean {
    const code = (error as { code?: string } | null | undefined)?.code;
    return code === CameraErrorCode.CameraPermissionDenied || code === CameraErrorCode.GalleryPermissionDenied;
  }

  // only short relative paths allowed, nothing absolute.
  private static assertRelativePath(path: string): void {
    if (
      typeof path !== 'string' ||
      path.trim() === '' ||
      path.startsWith('/') ||
      path.includes('..') ||
      path.includes('://') ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)
    ) {
      throw new Error('Receipt path must be a non-empty relative path');
    }
  }
}
