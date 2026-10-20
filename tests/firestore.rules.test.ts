/**
 * Security-rules tests for the social features, run against the Firestore emulator:
 *   java -jar cloud-firestore-emulator.jar --host=127.0.0.1 --port=8085   (or firebase emulators:start)
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx tsx tests/firestore.rules.test.ts
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');

let passed = 0;
let failed = 0;
async function check(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    passed++;
  } catch (e: any) {
    failed++;
    console.error(`FAIL ${name}:`, e?.message || e);
  }
}

const google = (uid: string): any => ({ firebase: { sign_in_provider: 'google.com' }, email: `${uid}@example.com` });
const password = (uid: string): any => ({ firebase: { sign_in_provider: 'password' }, email: `${uid}@example.com` });

async function main() {
  const env: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'demo-chesskys',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
  await env.clearFirestore();

  const alice = env.authenticatedContext('alice', google('alice')).firestore();
  const bob = env.authenticatedContext('bob', google('bob')).firestore();
  const carol = env.authenticatedContext('carol', google('carol')).firestore();
  const newEmailUser = env.authenticatedContext('dave', password('dave')).firestore();
  const profile = (uid: string) => ({ uid, displayName: uid, elo: 800, respectPoints: 100, gamesPlayed: 0, wins: 0 });

  // Sign-up: only Google accounts can create a player profile.
  await check('google user creates profile', () => assertSucceeds(setDoc(doc(alice, 'users/alice'), profile('alice'))));
  await check('bob creates profile', () => assertSucceeds(setDoc(doc(bob, 'users/bob'), profile('bob'))));
  await check('carol creates profile', () => assertSucceeds(setDoc(doc(carol, 'users/carol'), profile('carol'))));
  await check('email sign-up cannot create profile', () => assertFails(setDoc(doc(newEmailUser, 'users/dave'), profile('dave'))));

  // Presence heartbeat on your own profile.
  await check('presence update', () => assertSucceeds(updateDoc(doc(alice, 'users/alice'), { presence: { status: 'online', lastSeen: new Date().toISOString() } })));

  // No friendship without an accepted request.
  await check('cannot add self to friends without request', () => assertFails(setDoc(doc(carol, 'users/alice/friends/carol'), { friendUid: 'carol' })));
  await check('cannot add friend to own list without request', () => assertFails(setDoc(doc(carol, 'users/carol/friends/alice'), { friendUid: 'alice' })));

  // Friend requests.
  const req = { fromUserId: 'alice', toUserId: 'bob', status: 'pending', fromUserName: 'alice', createdAt: new Date().toISOString() };
  await check('wrong request id rejected', () => assertFails(setDoc(doc(alice, 'friend_requests/random'), req)));
  await check('request on behalf of someone else rejected', () => assertFails(setDoc(doc(carol, 'friend_requests/alice_bob'), req)));
  await check('request to a non-player rejected', () => assertFails(setDoc(doc(alice, 'friend_requests/alice_ghost'), { ...req, toUserId: 'ghost' })));
  await check('checking a missing request is allowed', () => assertSucceeds(getDoc(doc(alice, 'friend_requests/bob_alice'))));
  await check('alice sends request to bob', () => assertSucceeds(setDoc(doc(alice, 'friend_requests/alice_bob'), req)));
  await check('sender cannot accept own request', () => assertFails(updateDoc(doc(alice, 'friend_requests/alice_bob'), { status: 'accepted' })));
  await check('outsider cannot read request', () => assertFails(getDoc(doc(carol, 'friend_requests/alice_bob'))));
  await check('chat blocked before friendship', () =>
    assertFails(setDoc(doc(alice, 'direct_messages/alice_bob/messages/m0'), { senderId: 'alice', text: 'hi' })));
  await check('bob accepts', () => assertSucceeds(updateDoc(doc(bob, 'friend_requests/alice_bob'), { status: 'accepted' })));
  await check('bob writes his side', () => assertSucceeds(setDoc(doc(bob, 'users/bob/friends/alice'), { friendUid: 'alice' })));
  await check('bob writes alice side', () => assertSucceeds(setDoc(doc(bob, 'users/alice/friends/bob'), { friendUid: 'bob' })));
  await check('outsider still cannot join', () => assertFails(setDoc(doc(carol, 'users/alice/friends/carol'), { friendUid: 'carol' })));

  // Blocking stops new requests.
  await check('carol blocks alice', () => assertSucceeds(setDoc(doc(carol, 'users/carol/blocked/alice'), { uid: 'alice' })));
  await check('blocked user cannot send request', () =>
    assertFails(setDoc(doc(alice, 'friend_requests/alice_carol'), { ...req, toUserId: 'carol' })));

  // Private chat between friends: text, quick chat and voice.
  const chat = 'alice_bob';
  await check('chat meta', () => assertSucceeds(setDoc(doc(alice, `direct_messages/${chat}`), { lastMessage: 'hi', lastMessageTime: 't', senderId: 'alice' }, { merge: true })));
  await check('text message', () => assertSucceeds(setDoc(doc(alice, `direct_messages/${chat}/messages/m1`), { senderId: 'alice', senderName: 'alice', text: 'hello', type: 'text', createdAt: 't' })));
  await check('quick chat', () => assertSucceeds(setDoc(doc(bob, `direct_messages/${chat}/messages/m2`), { senderId: 'bob', senderName: 'bob', text: 'Good game!', type: 'quick', createdAt: 't' })));
  await check('voice message', () => assertSucceeds(setDoc(doc(bob, `direct_messages/${chat}/messages/m3`), { senderId: 'bob', senderName: 'bob', text: '', type: 'voice', audio: 'data:audio/webm;base64,AAAA', audioMs: 1200, createdAt: 't' })));
  await check('oversized voice rejected', () => assertFails(setDoc(doc(bob, `direct_messages/${chat}/messages/m4`), { senderId: 'bob', text: '', type: 'voice', audio: 'x'.repeat(400001), createdAt: 't' })));
  await check('cannot send as someone else', () => assertFails(setDoc(doc(alice, `direct_messages/${chat}/messages/m5`), { senderId: 'bob', text: 'fake', createdAt: 't' })));
  await check('unknown fields rejected', () => assertFails(setDoc(doc(alice, `direct_messages/${chat}/messages/m6`), { senderId: 'alice', text: 'x', isAdmin: true })));
  await check('friend reads chat', () => assertSucceeds(getDocs(collection(bob, `direct_messages/${chat}/messages`))));
  await check('outsider cannot read chat', () => assertFails(getDocs(collection(carol, `direct_messages/${chat}/messages`))));
  await check('outsider cannot post', () => assertFails(setDoc(doc(carol, `direct_messages/${chat}/messages/m7`), { senderId: 'carol', text: 'spam' })));
  await check('typing indicator', () => assertSucceeds(setDoc(doc(bob, `direct_messages/${chat}/typing/bob`), { at: 't' })));
  await check('cannot fake typing for friend', () => assertFails(setDoc(doc(bob, `direct_messages/${chat}/typing/alice`), { at: 't' })));
  await check('read receipt', () => assertSucceeds(setDoc(doc(bob, `direct_messages/${chat}`), { lastRead_bob: 't' }, { merge: true })));
  await check('cannot edit message text', () => assertFails(updateDoc(doc(bob, `direct_messages/${chat}/messages/m1`), { text: 'changed' })));

  // Unfriending: requests first, then both sides; afterwards chat is closed again.
  await check('remove request', () => assertSucceeds(deleteDoc(doc(alice, 'friend_requests/alice_bob'))));
  await check('remove alice side', () => assertSucceeds(deleteDoc(doc(alice, 'users/alice/friends/bob'))));
  await check('remove bob side', () => assertSucceeds(deleteDoc(doc(alice, 'users/bob/friends/alice'))));
  await check('cannot re-add without new request', () => assertFails(setDoc(doc(bob, 'users/bob/friends/alice'), { friendUid: 'alice' })));
  await check('chat closed after unfriend', () => assertFails(setDoc(doc(alice, `direct_messages/${chat}/messages/m8`), { senderId: 'alice', text: 'still there?' })));

  await env.cleanup();
  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
