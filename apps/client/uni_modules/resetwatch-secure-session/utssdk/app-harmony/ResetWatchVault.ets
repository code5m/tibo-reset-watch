import { asset } from '@kit.AssetStoreKit';
import { util } from '@kit.ArkTS';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { BusinessError } from '@kit.BasicServicesKit';

export class ResetWatchVault {
  private static queue: Promise<void> = Promise.resolve();
  static invoke(operation: string, origin: string, value: string, callback: (result: string) => void): void {
    ResetWatchVault.queue = ResetWatchVault.queue.then(async (): Promise<void> => {
      try { callback(await ResetWatchVault.perform(operation, origin, value)); }
      catch (error) {
        const code = (error as BusinessError).code;
        callback(JSON.stringify({ ok: false, code: code === 24000005 ? 'locked' : 'unreadable' }));
      }
    });
  }
  private static async perform(operation: string, origin: string, value: string): Promise<string> {
    if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?$/.test(origin) || origin.length > 280) {
      return JSON.stringify({ ok: false, code: 'invalid_origin' });
    }
    const encoder = new util.TextEncoder();
    const md = cryptoFramework.createMd('SHA256');
    await md.update({ data: encoder.encodeInto(origin) });
    const digest = await md.digest();
    let hex = '';
    digest.data.forEach((byte: number) => { hex += byte.toString(16).padStart(2, '0'); });
    // Alias contains only a namespace and origin hash; never put credentials in attributes.
    const alias = encoder.encodeInto('resetwatch.session.v1.' + hex);
    const query: asset.AssetMap = new Map();
    query.set(asset.Tag.ALIAS, alias);
    if (operation === 'remove') {
      try { await asset.remove(query); }
      catch (error) { if ((error as BusinessError).code !== 24000002) throw error; }
      return JSON.stringify({ ok: true, value: '' });
    }
    if (operation === 'read') {
      query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
      let records: Array<asset.AssetMap> = [];
      try { records = await asset.query(query); }
      catch (error) { if ((error as BusinessError).code !== 24000002) throw error; }
      if (records.length === 0) return JSON.stringify({ ok: true, value: '' });
      const bytes = records[0].get(asset.Tag.SECRET) as Uint8Array;
      if (!bytes || bytes.length > 256) return JSON.stringify({ ok: false, code: 'unreadable' });
      const token = util.TextDecoder.create('utf-8').decodeWithStream(bytes);
      bytes.fill(0);
      if (!/^rw_[a-f0-9]{64}$/.test(token)) return JSON.stringify({ ok: false, code: 'unreadable' });
      return JSON.stringify({ ok: true, value: token });
    }
    if (operation !== 'write' || !/^rw_[a-f0-9]{64}$/.test(value)) {
      return JSON.stringify({ ok: false, code: 'invalid_token' });
    }
    const attributes: asset.AssetMap = new Map();
    attributes.set(asset.Tag.ALIAS, alias);
    attributes.set(asset.Tag.SECRET, encoder.encodeInto(value));
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_UNLOCKED);
    attributes.set(asset.Tag.SYNC_TYPE, asset.SyncType.NEVER);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    // Do NOT request IS_PERSISTENT: uninstall retention is not enabled.
    await asset.add(attributes);
    return JSON.stringify({ ok: true, value: '' });
  }
}
