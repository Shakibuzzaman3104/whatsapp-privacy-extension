/**
 * @author Shakib
 * @since 25/10/26
 *
 * The PIN is a deterrent, not real security: anyone at the computer can turn
 * the extension off. It is still never stored in plain text.
 */
const ITERATIONS = 150_000;

const toBase64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

export async function hashPin(pin: string, saltBase64?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltBase64 ? fromBase64(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    256,
  );
  return { hash: toBase64(bits), salt: toBase64(salt) };
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  return (await hashPin(pin, salt)).hash === hash;
}
