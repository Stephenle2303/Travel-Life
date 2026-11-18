import {runAccountDeletion,type DeletionTicket} from '@/account/deletion';
it('persists the receipt before send and reconciles a lost acknowledgement without another deletion',async()=>{
 let saved:DeletionTicket|null=null;let lost=true;const create=jest.fn(()=>({owner:'owner',generation:1,mutationId:'operation',ticket:'a'.repeat(64)}));
 const options={current:()=>true,load:async()=>saved,create,save:async(value:DeletionTicket)=>{saved=value;},send:jest.fn(async()=>{expect(saved).not.toBeNull();if(lost){lost=false;throw new Error('PRIVATE_NETWORK');}return 'pending' as const;}),status:jest.fn(async()=>saved?'pending' as const:'unavailable' as const),accepted:jest.fn(async()=>{})};
 await runAccountDeletion(options);expect(options.accepted).toHaveBeenCalledTimes(1);expect(options.send).toHaveBeenCalledTimes(1);
 await runAccountDeletion(options);expect(options.send).toHaveBeenCalledTimes(1);expect(create).toHaveBeenCalledTimes(1);
});
it('does not send before protected receipt persistence or after owner loss',async()=>{
 const send=jest.fn();
 await expect(runAccountDeletion({current:()=>true,load:async()=>null,create:()=>({owner:'owner',generation:1,mutationId:'operation',ticket:'a'.repeat(64)}),save:async()=>{throw new Error('PRIVATE_STORAGE');},send,status:async()=> 'unavailable',accepted:async()=>{}})).rejects.toMatchObject({reason:'ACCOUNT_STORAGE'});
 expect(send).not.toHaveBeenCalled();
});
