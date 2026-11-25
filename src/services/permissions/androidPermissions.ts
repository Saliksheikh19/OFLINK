export type PermissionStatus = 'GRANTED' | 'DENIED' | 'PROMPT';

export interface AndroidPermissionState {
  bluetoothScan: PermissionStatus;
  bluetoothConnect: PermissionStatus;
  nearbyDevices: PermissionStatus;
  fineLocation: PermissionStatus;
  coarseLocation: PermissionStatus;
}

const STORAGE_KEY = 'oflink_android_permissions_v1';

class AndroidPermissionsManager {
  private permissions: AndroidPermissionState = {
    bluetoothScan: 'GRANTED',
    bluetoothConnect: 'GRANTED',
    nearbyDevices: 'GRANTED',
    fineLocation: 'GRANTED',
    coarseLocation: 'GRANTED',
  };

  private listeners: Set<(state: AndroidPermissionState) => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.permissions = { ...this.permissions, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load permission state:', e);
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.permissions));
      this.notify();
    } catch (e) {
      console.warn('Failed to save permission state:', e);
    }
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.permissions);
      } catch (err) {
        console.error(err);
      }
    });
  }

  public subscribe(listener: (state: AndroidPermissionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.permissions);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getPermissions(): AndroidPermissionState {
    return { ...this.permissions };
  }

  public async requestAllPermissions(): Promise<boolean> {
    // 1. Request real browser geolocation if available
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              this.permissions.fineLocation = 'GRANTED';
              this.permissions.coarseLocation = 'GRANTED';
              resolve(true);
            },
            () => {
              this.permissions.fineLocation = 'DENIED';
              this.permissions.coarseLocation = 'DENIED';
              resolve(false);
            },
            { timeout: 5000 }
          );
        });
      } catch (e) {
        console.warn('Geolocation request failed:', e);
      }
    }

    // 2. BLE permissions granted by default in app runtime
    this.permissions.bluetoothScan = 'GRANTED';
    this.permissions.bluetoothConnect = 'GRANTED';
    this.permissions.nearbyDevices = 'GRANTED';

    this.saveState();
    return true;
  }

  public togglePermission(key: keyof AndroidPermissionState) {
    this.permissions[key] = this.permissions[key] === 'GRANTED' ? 'DENIED' : 'GRANTED';
    this.saveState();
  }
}

export const androidPermissionsManager = new AndroidPermissionsManager();
