import { Injectable } from '@angular/core';
import type {
  LokKeyEventPayload,
  LokMouseEventPayload,
  LokOpenResult,
  LokTileRequest,
  LokTileResult,
} from '@unied/shared-types';
import { getUniedApi } from './tauri-backend';

@Injectable({ providedIn: 'root' })
export class LokService {
  open(filePath: string): Promise<LokOpenResult> {
    return getUniedApi().lok.open(filePath);
  }

  close(docId: number): Promise<void> {
    return getUniedApi().lok.close(docId);
  }

  renderTile(req: LokTileRequest): Promise<LokTileResult> {
    return getUniedApi().lok.renderTile(req);
  }

  postKey(payload: LokKeyEventPayload): Promise<void> {
    return getUniedApi().lok.postKey(payload);
  }

  postMouse(payload: LokMouseEventPayload): Promise<void> {
    return getUniedApi().lok.postMouse(payload);
  }

  docSize(docId: number): Promise<{ widthTwips: number; heightTwips: number }> {
    return getUniedApi().lok.docSize(docId);
  }
}
