/**
 * Endereço do servidor do RetroFin (rotas /api de IA).
 * Na web é a própria origem. No APK não existe servidor local: usa o endereço salvo nos ajustes
 * (vazio = recursos de IA caem no motor de regras local, que funciona offline).
 */
const CHAVE = 'retrofin_api_base_v1';

export function getApiBase(): string {
  try {
    return (localStorage.getItem(CHAVE) || '').trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function setApiBase(url: string) {
  try {
    const v = url.trim().replace(/\/+$/, '');
    if (v) localStorage.setItem(CHAVE, v);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
}
