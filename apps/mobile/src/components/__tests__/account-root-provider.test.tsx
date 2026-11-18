import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { PrivateRecordProvider } from '@/account/root-provider';
import { recordContext } from '@/account/record-context';
import { usePhotoAccess } from '@/photo-access/provider';
import { AccountMediaError } from '@/account/media-cache';

// Metro enables React Compiler, whereas the default Jest transform does not.
// Exercise the real root module under that transform: a numeric subscription
// cannot make separately read mutable repository getters reactive to the compiler.
jest.mock('@/account/root-provider',()=>{
 const fs=jest.requireActual('node:fs') as typeof import('node:fs');
 const babel=jest.requireActual('@babel/core') as typeof import('@babel/core');
 const filename=require.resolve('@/account/root-provider');
 const caller={name:'metro',platform:'android',supportsStaticESM:false,isDev:true};
 const code=babel.transformSync(fs.readFileSync(filename,'utf8'),{filename,babelrc:false,configFile:false,presets:[['babel-preset-expo',{reactCompiler:false}]],plugins:[['babel-plugin-react-compiler',{target:'19'}]],caller})!.code!;
 if(!code.includes('react.memo_cache_sentinel'))throw new Error('Root regression requires React Compiler output.');
 const compiled={exports:{}};
 // Run only this repository module with Jest's mocked dependencies.
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const moduleRequire=(name:string)=>require(name.startsWith('./')?`@/account/${name.slice(2)}`:name);
 new Function('require','module','exports',code)(moduleRequire,compiled,compiled.exports);
 return compiled.exports;
});

let mockOwner:string|null='owner-a';
const mockAccountListeners=new Set<()=>void>();
const mockDispose=jest.fn();
const mockAdapter={inspect:async()=>null,request:async()=>null,readPage:async()=>0,readMetadataPage:async()=>[],readSelectedMetadata:async()=>[],manageLimited:async()=>{},select:async()=>({canceled:true})};
const mockLocalPreviews=jest.fn(async()=>[]);
const mockAccountPreviews=jest.fn(async()=>[]);
const mockNativeAdapter={...mockAdapter,resolveOwnerPreviews:mockLocalPreviews};
const mockAccountAdapter={...mockAdapter,accountAuthorized:jest.fn(async()=>true),resolveOwnerPreviews:mockAccountPreviews};
const mockLocalManifest=jest.fn(async()=>({snapshotToken:1,privacyRevision:0,groups:[],memories:[],previewSourceRefs:[]}));
const mockAccountManifest=jest.fn(async()=>({snapshotToken:9,privacyRevision:2,groups:[],memories:[],previewSourceRefs:[]}));
const mockLocalAreas=jest.fn(async()=>[{id:'local-home',label:'Synthetic local home',origin:'observed-area',effectiveStartDay:null,effectiveEndDay:null,radiusMeters:100}]);
const mockAccountAreas=jest.fn(async()=>[{id:'account-home',label:'Synthetic account home',origin:'observed-area',effectiveStartDay:null,effectiveEndDay:null,radiusMeters:100}]);
const mockRepository=(areas:typeof mockLocalAreas)=>({getCheckpoint:async()=>null,loadCoverage:async()=>null,commitPage:async()=>{},getPrivateRecordLifecycle:async()=>({state:'connected'}),connectPrivateRecord:async()=>{},disconnectPrivateRecord:async()=>{},deleteLocalHistory:async()=>{},saveCorrectionOverlay:async()=>{},loadConfiguredHomeAreas:areas});

jest.mock('@/account/service',()=>({getAccountService:()=>({getLocalOwner:()=>mockOwner,getSnapshot:()=>({signedIn:mockOwner!==null}),subscribe:(listener:()=>void)=>{mockAccountListeners.add(listener);return()=>mockAccountListeners.delete(listener);}})}));
jest.mock('@/account/history-service',()=>({historyService:{lock:jest.fn(),catchUp:jest.fn()}}));
jest.mock('@/account/private-media-service',()=>({privateMediaService:{checkOwner:jest.fn()}}));
jest.mock('@/account/history-sync-native',()=>({accountSyncEnabled:false}));
jest.mock('@/account/history-store',()=>({loadReplica:async()=>({database_name:'travel-life-account-synthetic.db',snapshot_id:'synthetic-snapshot'}),replicaBlocked:async()=>false,saveAtlasAccountPreference:async()=>{}}));
jest.mock('@/account/media-native',()=>({createNativeAccountMedia:()=>({adapter:mockAccountAdapter,dispose:mockDispose})}));
jest.mock('@/photo-access/native-adapter',()=>({get nativePhotoAccess(){return mockNativeAdapter;}}));
jest.mock('@/import-record/repository',()=>({createNativeImportRepository:(options?:{databaseName:string})=>mockRepository(options?mockAccountAreas:mockLocalAreas)}));
jest.mock('@/reconstruction/repository',()=>({...jest.requireActual('@/reconstruction/repository'),createNativeReconstructionRepository:(options?:{databaseName:string})=>({loadReplayManifestInput:options?mockAccountManifest:mockLocalManifest,loadDurableReveal:async()=>({journeys:[]}),loadJourneyDetail:async()=>({detail:null,previewSourceRefs:[],snapshotToken:1}),loadJourneyMediaPage:async()=>({items:[],previewSourceRefs:[],hasMore:false}),loadUncertainMemories:async()=>({memories:[],hasMore:false}),rebuild:async()=>({}),reconcileQueued:async()=>({})})}));

let access:ReturnType<typeof usePhotoAccess>;
function Consumer(){const value=usePhotoAccess();useEffect(()=>{access=value;},[value]);return <Text>{value.homeBases.map(area=>area.label).join(',')}</Text>;}

afterEach(()=>{recordContext.local();mockAccountListeners.clear();mockOwner='owner-a';jest.clearAllMocks();});
it('classifies an inconsistent root binding snapshot without serializing private fields',async()=>{
 const snapshot={...recordContext.getSnapshot(),account:true,correlationId:'runtime-inconsistent-binding'};
 const read=jest.spyOn(recordContext,'getSnapshot').mockReturnValue(snapshot);
 const log=jest.spyOn(console,'info').mockImplementation(()=>{});
 try{
  await render(<PrivateRecordProvider><Consumer/></PrivateRecordProvider>);
  expect(log.mock.calls.map(([,event])=>event)).toEqual(expect.arrayContaining([
   {operation:'HISTORY_TRANSFER',stage:'HISTORY_PROVIDER_BIND',reasonCode:'HISTORY_SCHEMA',retryable:false,durableOutcome:'blocked',correlationId:'runtime-inconsistent-binding'},
  ]));
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/owner-a|travel-life-account-synthetic|synthetic-snapshot/);
 }finally{read.mockRestore();log.mockRestore();}
});
it('correlates selected repository handoff with actual mounted account media capability and Replay reads',async()=>{
 const log=jest.spyOn(console,'info').mockImplementation(()=>{});
 try{
  const screen=await render(<PrivateRecordProvider><Consumer/></PrivateRecordProvider>);
  await waitFor(()=>expect(screen.getByText('Synthetic local home')).toBeTruthy());
  await act(async()=>{await recordContext.openAccount();});
  await waitFor(()=>expect(screen.getByText('Synthetic account home')).toBeTruthy());
  await expect(access.loadReplayManifestInput('runtime-replay-source')).resolves.toMatchObject({snapshotToken:9});
  expect(mockAccountManifest).toHaveBeenCalled();expect(mockAccountPreviews).toHaveBeenCalled();
  expect(mockLocalManifest).not.toHaveBeenCalled();expect(mockLocalPreviews).not.toHaveBeenCalled();
  const events=log.mock.calls.map(([,event])=>event);
  const open=events.find(event=>event.stage==='HISTORY_OPEN_BIND'&&event.reasonCode==='COMPLETE');
  expect(events).toEqual(expect.arrayContaining([
   expect.objectContaining({stage:'HISTORY_PROVIDER_ACCOUNT',reasonCode:'COMPLETE',correlationId:open.correlationId}),
   expect.objectContaining({stage:'HISTORY_CONSUMER_ACCOUNT',reasonCode:'COMPLETE',correlationId:open.correlationId}),
   expect.objectContaining({stage:'REPLAY_ACCOUNT',correlationId:'runtime-replay-source'}),
  ]));
  expect(JSON.stringify(events)).not.toMatch(/owner-a|travel-life-account-synthetic|synthetic-snapshot/);
 }finally{log.mockRestore();}
});
it('keeps account source explicit on media denial and restores local source only after deliberate local selection',async()=>{
 const log=jest.spyOn(console,'info').mockImplementation(()=>{});
 try{
  const screen=await render(<PrivateRecordProvider><Consumer/></PrivateRecordProvider>);
  await waitFor(()=>expect(screen.getByText('Synthetic local home')).toBeTruthy());
  await act(async()=>{await recordContext.openAccount();});
  await waitFor(()=>expect(screen.getByText('Synthetic account home')).toBeTruthy());
  mockAccountPreviews.mockRejectedValueOnce(new AccountMediaError('MEDIA_CONSENT'));
  await expect(access.preparePrivateReplay(undefined,undefined,undefined,undefined,undefined,'runtime-denied-account')).rejects.toMatchObject({diagnosticRecorded:true});
  expect(recordContext.isAccount()).toBe(true);
  expect(mockAccountManifest).toHaveBeenCalled();expect(mockAccountPreviews).toHaveBeenCalled();
  expect(mockLocalManifest).not.toHaveBeenCalled();expect(mockLocalPreviews).not.toHaveBeenCalled();
  const events=log.mock.calls.map(([,event])=>event);
  expect(events.filter(event=>event.correlationId==='runtime-denied-account'&&event.reasonCode!=='START')).toEqual([
   expect.objectContaining({operation:'REPLAY_RENDER',stage:'REPLAY_PREVIEWS',reasonCode:'MEDIA_CONSENT',durableOutcome:'blocked',retryable:false}),
  ]);
  await act(async()=>{recordContext.local();});
  await waitFor(()=>expect(screen.getByText('Synthetic local home')).toBeTruthy());
  await expect(access.loadReplayManifestInput('runtime-explicit-local')).resolves.toMatchObject({snapshotToken:1});
  expect(mockLocalManifest).toHaveBeenCalled();expect(mockLocalPreviews).toHaveBeenCalled();
  expect(log.mock.calls.map(([,event])=>event)).toEqual(expect.arrayContaining([
   expect.objectContaining({stage:'HISTORY_CONTEXT_USER_LOCAL',reasonCode:'SKIPPED'}),
   expect.objectContaining({stage:'HISTORY_CONSUMER_UNMOUNT',reasonCode:'SKIPPED'}),
   expect.objectContaining({stage:'REPLAY_LOCAL',correlationId:'runtime-explicit-local'}),
  ]));
 }finally{log.mockRestore();}
});
it('remounts captured repositories and removes former account content on the real account subscription',async()=>{
 const screen=await render(<PrivateRecordProvider><Consumer/></PrivateRecordProvider>);
 await waitFor(()=>expect(screen.getByText('Synthetic local home')).toBeTruthy());
 await act(async()=>{await recordContext.openAccount();});
 await waitFor(()=>expect(screen.getByText('Synthetic account home')).toBeTruthy());
 expect(screen.queryByText('Synthetic local home')).toBeNull();
 const accountReads=mockAccountAreas.mock.calls.length;const localReads=mockLocalAreas.mock.calls.length;
 await act(async()=>{mockOwner=null;for(const listener of mockAccountListeners)listener();});
 await waitFor(()=>expect(screen.getByText('Synthetic local home')).toBeTruthy());
 expect(screen.queryByText('Synthetic account home')).toBeNull();
 expect(mockLocalAreas.mock.calls.length).toBeGreaterThan(localReads);expect(mockAccountAreas).toHaveBeenCalledTimes(accountReads);
 expect(mockDispose).toHaveBeenCalledTimes(1);
});
