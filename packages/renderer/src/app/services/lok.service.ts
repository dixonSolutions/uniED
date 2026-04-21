import { Injectable } from '@angular/core';
import type { LokOpenResult } from '@unied/shared-types';
import { getUniedApi } from './tauri-backend';

@Injectable({ providedIn: 'root' })
export class LokService {
  open(filePath: string): Promise<LokOpenResult> {
    return getUniedApi().lok.open(filePath);
  }

  close(docId: number): Promise<void> {
    return getUniedApi().lok.close(docId);
  }

  renderTile(
    docId: number,
    canvasW: number, canvasH: number,
    tileX: number,  tileY: number,
    tileW: number,  tileH: number,
  ): Promise<string> {
    return getUniedApi().lok.renderTile(docId, canvasW, canvasH, tileX, tileY, tileW, tileH);
  }

  postMouse(
    docId: number,
    eventType: number, x: number, y: number,
    count: number, buttons: number, modifier: number,
  ): Promise<void> {
    return getUniedApi().lok.postMouse(docId, eventType, x, y, count, buttons, modifier);
  }

  postKey(
    docId: number,
    eventType: number, charCode: number, keyCode: number,
  ): Promise<void> {
    return getUniedApi().lok.postKey(docId, eventType, charCode, keyCode);
  }
}
