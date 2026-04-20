import { Injectable } from '@angular/core';
import type { AppConfig } from '@unied/shared-types';
import { getUniedApi } from './tauri-backend';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  get(): Promise<AppConfig> {
    return getUniedApi().config.get();
  }

  set(partial: Partial<AppConfig>): Promise<AppConfig> {
    return getUniedApi().config.set(partial);
  }
}
