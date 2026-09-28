// Security & Biometric (WebAuthn) Authentication Utilities

export interface SecurityConfig {
  pinEnabled: boolean;
  pinHash: string; // SHA-256 hash of PIN/password
  biometricsEnabled: boolean;
  biometricCredentialId?: string;
  autoLockMinutes: number; // 0 = immediately on background, or 1, 5, 15, 30
}

const STORAGE_KEYS = {
  SECURITY_CONFIG: 'retrofin_security_config_v1',
  LAST_UNLOCKED: 'retrofin_last_unlocked_ts',
};

// Simple SHA-256 hash using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Load security config from localStorage
export function loadSecurityConfig(): SecurityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SECURITY_CONFIG);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pinEnabled: !!parsed.pinEnabled,
        pinHash: parsed.pinHash || '',
        biometricsEnabled: !!parsed.biometricsEnabled,
        biometricCredentialId: parsed.biometricCredentialId,
        autoLockMinutes: typeof parsed.autoLockMinutes === 'number' ? parsed.autoLockMinutes : 0,
      };
    }
  } catch (e) {
    console.error('Failed to load security config', e);
  }
  return {
    pinEnabled: false,
    pinHash: '',
    biometricsEnabled: false,
    autoLockMinutes: 0,
  };
}

// Save security config
export function saveSecurityConfig(config: SecurityConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SECURITY_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save security config', e);
  }
}

// Check if biometrics (Touch ID, Face ID, Android Biometrics, Windows Hello) are supported
export async function isBiometricsSupported(): Promise<boolean> {
  if (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  ) {
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    } catch {
      return false;
    }
  }
  return false;
}

// Register a biometric credential using WebAuthn
export async function registerBiometrics(username = 'usuario@retrofin'): Promise<string | null> {
  if (!(await isBiometricsSupported())) {
    throw new Error('Biometria não suportada neste dispositivo/navegador.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  const createOptions: CredentialCreationOptions = {
    publicKey: {
      challenge,
      rp: {
        name: 'RetroFin - Gestão Financeira',
        id: window.location.hostname,
      },
      user: {
        id: userId,
        name: username,
        displayName: 'Usuário RetroFin',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Platform = Biometrics (Face ID / Touch ID / Fingerprint)
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    },
  };

  try {
    const credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential | null;
    if (credential && credential.id) {
      return credential.id;
    }
    return null;
  } catch (err: any) {
    console.error('WebAuthn register error:', err);
    throw new Error(err.message || 'Falha ao registrar biometria.');
  }
}

// Authenticate via Biometrics using WebAuthn
export async function authenticateWithBiometrics(credentialId?: string): Promise<boolean> {
  if (!(await isBiometricsSupported())) {
    throw new Error('Biometria não disponível.');
  }

  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge,
      userVerification: 'required',
      timeout: 60000,
      rpId: window.location.hostname,
      ...(credentialId
        ? {
            allowCredentials: [
              {
                type: 'public-key',
                id: Uint8Array.from(atob(credentialId.replace(/_/g, '/').replace(/-/g, '+')), (c) =>
                  c.charCodeAt(0)
                ),
                transports: ['internal'],
              },
            ],
          }
        : {}),
    },
  };

  try {
    const assertion = await navigator.credentials.get(getOptions);
    return !!assertion;
  } catch (err: any) {
    // If specific credential failed, try open prompt (device-level verification)
    if (credentialId) {
      try {
        const fallbackOptions: CredentialRequestOptions = {
          publicKey: {
            challenge,
            userVerification: 'required',
            timeout: 60000,
            rpId: window.location.hostname,
          },
        };
        const assertion = await navigator.credentials.get(fallbackOptions);
        return !!assertion;
      } catch (err2: any) {
        console.warn('Fallback biometric prompt failed:', err2);
      }
    }
    console.error('WebAuthn auth error:', err);
    throw new Error(err.name === 'NotAllowedError' ? 'Biometria cancelada pelo usuário.' : 'Falha na validação biométrica.');
  }
}

// Session Lock State helpers
export function recordUnlock(): void {
  try {
    sessionStorage.setItem('retrofin_session_unlocked', 'true');
    localStorage.setItem(STORAGE_KEYS.LAST_UNLOCKED, Date.now().toString());
  } catch (e) {
    console.error(e);
  }
}

export function isSessionUnlocked(config: SecurityConfig): boolean {
  if (!config.pinEnabled) return true; // Security not enabled

  try {
    const sessionVal = sessionStorage.getItem('retrofin_session_unlocked');
    if (sessionVal !== 'true') return false;

    // Check autoLock timeout
    if (config.autoLockMinutes > 0) {
      const last = localStorage.getItem(STORAGE_KEYS.LAST_UNLOCKED);
      if (last) {
        const diffMinutes = (Date.now() - parseInt(last, 10)) / (1000 * 60);
        if (diffMinutes > config.autoLockMinutes) {
          sessionStorage.removeItem('retrofin_session_unlocked');
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function lockAppSession(): void {
  try {
    sessionStorage.removeItem('retrofin_session_unlocked');
  } catch (e) {
    console.error(e);
  }
}
