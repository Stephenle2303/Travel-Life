import { useEffect, useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Body, Eyebrow, InsetPanel, Screen, Title, palette } from './ui';
import { getAccountService } from '@/account/service';
import type { AccountController } from '@/account/controller';
import { AccountHistoryPanel } from './account-history-panel';
import { AccountDeletionPanel } from './account-deletion-panel';
import { AccountMediaPanel } from './account-media-panel';
import { AccountSyncPanel } from './account-sync-panel';

const messages: Record<string,string> = {
  ACCOUNT_INPUT: 'Check your email or enter the code from your email.',
  ACCOUNT_CODE: 'That code is invalid or has expired. Request a new code.',
  ACCOUNT_RATE_LIMIT: 'Please wait before trying again.',
  ACCOUNT_NETWORK: 'Could not reach your account. Check your connection and retry.',
  ACCOUNT_PROVIDER: 'Your account request could not finish. Try again.',
  ACCOUNT_SESSION: 'Your account session could not be verified. Sign in again.',
  ACCOUNT_STORAGE: 'Your account is locked on this phone because secure storage is unavailable. Try signing out again.',
};

export function AccountScreen({ controller = getAccountService() }: { controller?: AccountController }) {
  const router = useRouter();
  const state = useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const [email,setEmail] = useState(''); const [code,setCode] = useState('');
  const [details,setDetails] = useState(false);
  useEffect(() => { void controller.restore(); return () => controller.cancelPending(); },[controller]);
  const awaiting = state.status === 'awaiting-code' || state.status === 'verifying';
  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Screen>
      <Eyebrow>Your private account</Eyebrow>{!state.signedIn&&<Title>Bring your history together.</Title>}
      {state.status === 'disabled' ? <InsetPanel><Body>Account access is not configured in this build. Your local history is available.</Body></InsetPanel>
        : state.signedIn ? null
          : <InsetPanel>
            <Body>Use an email code to create or enter your account. You can keep using Travel Life locally without signing in.</Body>
            <TextInput accessibilityLabel="Account email" value={email} onChangeText={value => { if (awaiting) controller.cancelPending(); setEmail(value); setCode(''); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} placeholder="Email" placeholderTextColor={palette.sage} style={styles.input} editable={!state.busy} />
            {awaiting && <><Body>If this address can receive account emails, use the code sent to it.</Body><TextInput accessibilityLabel="Email verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={10} placeholder="Email code" placeholderTextColor={palette.sage} style={styles.input} editable={!state.busy} /></>}
          </InsetPanel>}
      {state.reason && messages[state.reason] && <Body>{messages[state.reason]}</Body>}
      {state.busy && <Body>{state.status === 'requesting' ? 'Requesting your code…' : state.status === 'verifying' ? 'Verifying your code…' : state.status === 'signing-out' ? 'Signing out…' : 'Checking your account…'}</Body>}
      {state.status !== 'disabled' && !state.signedIn && state.status !== 'blocked' && <ActionButton accessibilityLabel={awaiting ? 'Verify email code' : 'Send email code'} disabled={state.busy || !email.trim() || awaiting && code.length < 6} onPress={() => { if (awaiting) { void controller.verifyCode(email,code); setCode(''); } else void controller.requestCode(email); }}>{awaiting ? 'Verify code' : 'Send code'}</ActionButton>}
      {awaiting && <ActionButton accessibilityLabel="Resend email code" disabled={state.busy} onPress={() => void controller.requestCode(email)} variant="secondary">Send a new code</ActionButton>}
      {state.signedIn&&<>
        <AccountSyncPanel/>
        <ActionButton accessibilityLabel="Account sync details" variant="secondary" onPress={()=>setDetails(value=>!value)}>{details?'Hide details':'Details'}</ActionButton>
        {details&&<><AccountHistoryPanel/><AccountMediaPanel/><AccountDeletionPanel signedIn/></>}
      </>}
      {!state.signedIn&&<AccountDeletionPanel signedIn={false}/>}
      {(state.signedIn || state.status === 'blocked') && <ActionButton accessibilityLabel="Sign out of this phone" disabled={state.busy} onPress={() => { setEmail(''); setCode(''); void controller.signOut(); }} variant="secondary">Sign out of this phone</ActionButton>}
      <ActionButton accessibilityLabel="Return to private record controls" onPress={() => router.back()} variant="secondary">Back</ActionButton>
    </Screen>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({root:{flex:1},input:{color:palette.limestone,borderColor:palette.sage,borderWidth:1,borderRadius:12,padding:14,minHeight:54,fontSize:17}});
