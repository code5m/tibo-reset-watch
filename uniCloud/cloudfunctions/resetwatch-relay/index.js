'use strict';
const {createRelay,createSender}=require('./relay.cjs');
const collection=()=>uniCloud.database().collection('resetwatch_relay_ledger');
const store={
  async claim(id,hash,at) {
    try {await collection().add({_id:id,hash,createdAt:at,status:'processing'});return {fresh:true};}
    catch {
      const result=await collection().doc(id).get(),row=result.data?.[0];
      if(!row)throw Error('reservation_failed');
      return {fresh:false,hash:row.hash,result:row.result || null};
    }
  },
  async finish(id,result,at) {
    const r=await collection().doc(id).update({status:result.accepted===true?'accepted':result.accepted===false?'failed':'unknown',result,updatedAt:at});
    if(r.updated!==1)throw Error('ledger_update_failed');
  }
};
const sender=createSender({cloud:uniCloud,env:process.env});
exports.main=async event=>createRelay({store,send:sender,secret:process.env.PRODUCT_PUSH_RELAY_SECRET,
  enabled:process.env.RELAY_SEND_ENABLED==='true'})(event);
