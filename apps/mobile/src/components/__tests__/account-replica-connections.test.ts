import { closeReplicaConnections, selectReplicaConnection, trackReplicaConnection } from '@/account/replica-connections';
const name=(id:number)=>`travel-life-account-00000000-0000-4000-8000-${String(id).padStart(12,'0')}.db`;
afterEach(()=>selectReplicaConnection(null));
it('never closes the selected replica, a pending read, or an unsettled transaction',async()=>{
 const closeAsync=jest.fn(async()=>{});let release!:()=>void;
 const raw={closeAsync,execAsync:async(_sql:string)=>{},getAllAsync:()=>new Promise<void>(resolve=>{release=resolve;})};
 const db=trackReplicaConnection(name(61),raw);selectReplicaConnection(name(61));
 expect(await closeReplicaConnections(name(61))).toBe(false);selectReplicaConnection(null);
 const reading=db.getAllAsync();expect(await closeReplicaConnections(name(61))).toBe(false);release();await reading;
 await db.execAsync('BEGIN IMMEDIATE TRANSACTION');expect(await closeReplicaConnections(name(61))).toBe(false);
 await db.execAsync('ROLLBACK');expect(await closeReplicaConnections(name(61))).toBe(true);expect(closeAsync).toHaveBeenCalledTimes(1);
 await expect(db.getAllAsync()).rejects.toMatchObject({reason:'HISTORY_FENCED'});
});
it('refuses the primary local database and retains cleanup failure for retry',async()=>{
 expect(await closeReplicaConnections('travel-life-import-v1.db')).toBe(false);
 const closeAsync=jest.fn().mockRejectedValueOnce(new Error('PRIVATE_NATIVE')).mockResolvedValue(undefined);
 trackReplicaConnection(name(62),{closeAsync});
 await expect(closeReplicaConnections(name(62))).rejects.toMatchObject({reason:'HISTORY_STORAGE'});
 expect(await closeReplicaConnections(name(62))).toBe(true);expect(closeAsync).toHaveBeenCalledTimes(2);
});
