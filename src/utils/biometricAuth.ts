export interface PasskeyCredential {
  id: string;
  rawId: ArrayBuffer;
  type: 'public-key';
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse;
}

export interface BiometricAuthOptions {
  email: string;
  displayName: string;
  userId: string;
}

class BiometricAuth {
  private static instance: BiometricAuth;
  private isSupported = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.isSupported = !!(
        window.PublicKeyCredential &&
        typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      );
    }
  }

  static getInstance(): BiometricAuth {
    if (!BiometricAuth.instance) {
      BiometricAuth.instance = new BiometricAuth();
    }
    return BiometricAuth.instance;
  }

  async isBiometricAvailable(): Promise<boolean> {
    if (!this.isSupported) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async registerPasskey(options: BiometricAuthOptions): Promise<PasskeyCredential | null> {
    if (!this.isSupported) {
      throw new Error('Biometric authentication not supported in this browser');
    }

    const available = await this.isBiometricAvailable();
    if (!available) {
      throw new Error('No biometric authenticator available');
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Omix Community',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(options.userId),
            name: options.email,
            displayName: options.displayName,
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 }, // ES256
            { type: 'public-key', alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            requireResidentKey: true,
          },
          timeout: 60000,
          attestation: 'direct',
        },
      });

      if (!credential) throw new Error('No credential created');

      const pkCredential = credential as PublicKeyCredential;
      const response = pkCredential.response as AuthenticatorAttestationResponse;
      const credentialId = this.arrayBufferToBase64Url(pkCredential.rawId);

      // Store credential ID locally for future reference
      localStorage.setItem(`passkey_${options.email}`, credentialId);

      return {
        id: credentialId,
        rawId: pkCredential.rawId,
        type: 'public-key' as const,
        response,
      };
    } catch (err) {
      console.error('Passkey registration failed:', err);
      throw err;
    }
  }

  async authenticateWithPasskey(email: string): Promise<PasskeyCredential | null> {
    if (!this.isSupported) {
      throw new Error('Biometric authentication not supported in this browser');
    }

    const storedCredentialId = localStorage.getItem(`passkey_${email}`);
    if (!storedCredentialId) {
      throw new Error('No passkey registered for this email');
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              type: 'public-key',
              id: this.base64UrlToArrayBuffer(storedCredentialId),
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (!credential) throw new Error('Authentication failed');

      const pkCredential = credential as PublicKeyCredential;
      const response = pkCredential.response as AuthenticatorAssertionResponse;
      return {
        id: this.arrayBufferToBase64Url(pkCredential.rawId),
        rawId: pkCredential.rawId,
        type: 'public-key' as const,
        response,
      };
    } catch (err) {
      console.error('Passkey authentication failed:', err);
      throw err;
    }
  }

  async deletePasskey(email: string): Promise<void> {
    localStorage.removeItem(`passkey_${email}`);
  }

  hasRegisteredPasskey(email: string): boolean {
    return !!localStorage.getItem(`passkey_${email}`);
  }

  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const str = atob(padded);
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const biometricAuth = BiometricAuth.getInstance();