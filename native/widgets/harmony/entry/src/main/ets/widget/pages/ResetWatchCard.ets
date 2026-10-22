let storage: LocalStorage = new LocalStorage();
@Entry(storage)
@Component
struct ResetWatchCard {
  @LocalStorageProp('title') title: string = 'ResetWatch';
  @LocalStorageProp('state') state: string = '尚未读取';
  @LocalStorageProp('window') window: string = '重置最晚时间未知';
  @LocalStorageProp('checked') checked: string = '暂无可核验快照';
  build() {
    Column({ space: 8 }) {
      Text('ResetWatch').fontSize(12).fontColor('#14624D').fontWeight(FontWeight.Bold)
      Text(this.title).fontSize(18).fontWeight(FontWeight.Bold).maxLines(2).fontColor('#182D29')
      Text(this.state).fontSize(14).fontColor('#182D29')
      Text(this.window).fontSize(12).maxLines(3).fontColor('#182D29')
      Text(this.checked).fontSize(10).fontColor('#576D66')
      Text('系统调度刷新 · 个人到账未知').fontSize(10).fontColor('#576D66')
      Text('刷新摘要').fontSize(12).fontColor('#14624D')
        .onClick(() => { postCardAction(this, { action: 'message', params: { command: 'refresh' } }); })
    }.width('100%').height('100%').padding(16)
      .alignItems(HorizontalAlign.Start).backgroundColor('#E9F3EE').borderRadius(16)
  }
}
