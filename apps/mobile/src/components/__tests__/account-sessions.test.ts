import { accountSessionPage } from '@/account/session-contract';

const id='25000000-0000-4000-8000-000000000001';
const valid={status:'complete',page:0,pages:1,sessions:[{sessionId:id,createdAt:'2026-10-28T00:00:00Z',updatedAt:'2026-10-28T00:00:00Z',current:true}]};
it('validates bounded owner session inventory without accepting private provider fields',()=>{
 expect(accountSessionPage(valid,0).sessions[0].current).toBe(true);
 for(const value of [{...valid,page:1},{...valid,sessions:[...valid.sessions,...valid.sessions]},{...valid,sessions:[{...valid.sessions[0],ip:'PRIVATE_IP'}]},{...valid,sessions:[{...valid.sessions[0],createdAt:'PRIVATE_TOKEN'}]}]){
  expect(()=>accountSessionPage(value,0)).toThrow('Private history transfer did not finish.');
 }
});
