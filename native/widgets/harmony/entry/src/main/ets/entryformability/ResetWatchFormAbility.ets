import { FormExtensionAbility, formBindingData, formProvider, formInfo } from '@kit.FormKit';
import { Want } from '@kit.AbilityKit';
import { http } from '@kit.NetworkKit';

// Replace only with an operator-approved HTTPS origin in the host build.
const API_ORIGIN: string = '';
interface Snapshot {
  available: boolean;
  title?: string;
  statusLabel?: string;
  deadlineAt?: string;
  confirmedAt?: string;
  serverTime?: string;
}
function stamp(value?: string): string {
  if (!value) { return '未知'; }
  const ms: number = Date.parse(value);
  if (!Number.isFinite(ms)) { return '未知'; }
  return new Date(ms + 8 * 3600000).toISOString().slice(5, 16).replace('T', ' ');
}
function unavailable(): Record<string, string> {
  return {
    title: 'ResetWatch',
    state: '尚未核验',
    window: '重置最晚时间未知',
    checked: '请打开工作台读取新状态'
  };
}
export default class ResetWatchFormAbility extends FormExtensionAbility {
  onAddForm(want: Want): formBindingData.FormBindingData {
    const formId: string = want.parameters?.[formInfo.FormParam.IDENTITY_KEY] as string;
    if (formId) { this.refresh(formId); }
    return formBindingData.createFormBindingData(unavailable());
  }
  onUpdateForm(formId: string): void { this.refresh(formId); }
  onFormEvent(formId: string, message: string): void {
    // A local form refresh only. Never send an external notification from a card.
    this.refresh(formId);
  }
  private async refresh(formId: string): Promise<void> {
    let data: Record<string, string> = unavailable();
    if (!/^https:\/\/[a-zA-Z0-9.-]+(:\d+)?$/.test(API_ORIGIN) || API_ORIGIN.includes('.example')) {
      data.state = '服务地址未配置';
      await formProvider.updateForm(formId, formBindingData.createFormBindingData(data)).catch(() => {});
      return;
    }
    const request: http.HttpRequest = http.createHttp();
    try {
      const response: http.HttpResponse = await request.request(API_ORIGIN + '/api/v1/product?view=widget', {
        method: http.RequestMethod.GET,
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 3000, readTimeout: 4000,
        header: { 'Accept': 'application/json' }
      });
      if (response.responseCode !== 200 || typeof response.result !== 'string' || response.result.length > 32768) {
        throw new Error('invalid_response');
      }
      const snapshot: Snapshot = JSON.parse(response.result) as Snapshot;
      if (snapshot.available !== true) { throw new Error('unavailable'); }
      data = {
        title: (snapshot.title || 'ResetWatch').slice(0, 200),
        state: snapshot.statusLabel || '状态未知',
        window: snapshot.confirmedAt ? '官方确认：北京时间 ' + stamp(snapshot.confirmedAt) :
          '参考最晚：北京时间 ' + stamp(snapshot.deadlineAt) + '，可能提前',
        checked: '数据快照：' + stamp(snapshot.serverTime) + '（北京）'
      };
    } catch {
      data.state = '读取失败，状态未知';
    } finally {
      request.destroy();
    }
    await formProvider.updateForm(formId, formBindingData.createFormBindingData(data)).catch(() => {});
  }
}
