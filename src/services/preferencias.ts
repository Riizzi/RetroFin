/** Preferências locais do RetroFin (ficam só no aparelho). */
const CHAVE_TITULAR = 'retrofin_titular_v1';
const CHAVE_API_KEY = 'retrofin_api_key_v1';

function ler(k: string): string {
  try {
    return (localStorage.getItem(k) || '').trim();
  } catch {
    return '';
  }
}

function gravar(k: string, v: string) {
  try {
    if (v.trim()) localStorage.setItem(k, v.trim());
    else localStorage.removeItem(k);
  } catch {
    /* sem armazenamento */
  }
}

/** Seu nome como aparece nos Pix entre as suas contas (detecta transferência interna). */
export const lerNomeTitular = () => ler(CHAVE_TITULAR);
export const gravarNomeTitular = (v: string) => gravar(CHAVE_TITULAR, v);

/** Chave do servidor de IA do RetroFin (variável RETROFIN_API_KEY no servidor). */
export const lerChaveServidor = () => ler(CHAVE_API_KEY);
export const gravarChaveServidor = (v: string) => gravar(CHAVE_API_KEY, v);
