// Runtime stays in the generated native-free bundle; these imports are type-only.
export {collectAccountIdentityKeys,mergeAccountHistory,prepareAccountHistory,mergePreparedAccountHistory,translateLegacyOwnerChanges} from '../../../apps/mobile/src/account/history-merge.ts';
export {historyRowsJson,applyOwnerChanges} from '../../../apps/mobile/src/account/correction-journal.ts';
export {decodeHistoryRows,encodeHistoryRows,historyWireBytes} from '../../../apps/mobile/src/account/history-wire.ts';
export const historyDomainSourceDigest:string;
