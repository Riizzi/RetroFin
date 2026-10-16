<div align="center">

<img src="public/icon.svg" width="88" alt="Ícone do RetroFin" />

# RetroFin

[English](README.md) · **Português**

Controle de finanças pessoais que lança os gastos sozinho: importa extratos, lê as notificações do banco no celular e categoriza tudo com IA.

![React](https://img.shields.io/badge/React_19-292524?logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-292524?logo=typescript&logoColor=3178C6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_4-292524?logo=tailwindcss&logoColor=38BDF8)
![Firebase](https://img.shields.io/badge/Firebase-292524?logo=firebase&logoColor=FFCA28)
![Gemini](https://img.shields.io/badge/Gemini_API-292524?logo=googlegemini&logoColor=8E75B2)
![PWA](https://img.shields.io/badge/PWA-292524?logo=pwa&logoColor=white)

</div>

## Funcionalidades

- **Lançamento automático por notificação**: o app Android lê as notificações de compra e Pix dos apps de banco (Nubank, Inter, Itaú, C6 e outros) com um serviço nativo, extrai valor, estabelecimento e horário e cria a transação na conta certa, sem app de terceiros
- **App Android (APK)** gerado pelo GitHub Actions a cada push, além da versão web/PWA
- **Link com o CL4P-RZ**: envia um resumo dos lançamentos para o hub pessoal [CL4P-RZ](https://github.com/Riizzi/CL4P-RZ), que cruza gastos com lugares, despensa e lista de desejos
- **Importação de extratos** em OFX, CSV ou texto copiado do app do banco
- **Categorização em camadas**: o que você classificou nunca é sobrescrito; uma correção sua vale para todos os lançamentos do mesmo estabelecimento; estabelecimentos conhecidos vão por regra; só o resto vai para o Gemini, com as suas categorias e exemplos, resposta presa à lista de categorias e sem nomes de pessoas
- **Insights da IA** sobre os gastos do mês
- **Orçamento por categoria** com metas mensais
- **Gráficos** de gastos por categoria e por mês
- **Várias contas bancárias** (Nubank, Inter e outras), com finalidade de cada conta
- **Bloqueio do app** com PIN e biometria (WebAuthn) e bloqueio automático por inatividade
- **Sincronização na nuvem** com login Google (Firebase), ou uso 100% local sem conta
- **PWA instalável** com uso offline

## Stack

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, TypeScript, Tailwind CSS 4, Motion, Lucide |
| Servidor | Express (rotas `/api`) com Firebase Admin |
| Dados | Cloud Firestore (sincronização) ou `localStorage` (modo local) |
| Login | Firebase Authentication (Google ou anônimo) |
| IA | `@google/genai`, com saída em JSON estruturado |
| PWA | `vite-plugin-pwa` (Workbox) |
| Android | Capacitor 8 + `NotificationListenerService` em Java |

## Arquitetura

```
Android (Java)                                      App (React + Capacitor)
 BankNotificationListener ── filtra apps de banco ─┐
                             e textos com R$        ├─► NotifStore (fila) ──► bridge ──► bankNotifications.ts ──► transações
 RetroFinNativePlugin ────── status, fila, ack ────┘                                    (valor, loja, Pix/cartão, espelho
                                                                                          de transferência entre contas)
App
   ├── localStorage + Firestore ... contas, transações e metas (só grava o que mudou)
   ├── POST /api/categorize ....... categorização em lote com Gemini (opcional)
   ├── POST /api/ai-insights ...... análise dos gastos do mês (opcional)
   └── Link CL4P-RZ ............... resumo para o hub pessoal
```

A leitura das notificações acontece no aparelho. O serviço guarda as notificações numa fila mesmo com o app fechado; ao abrir, o app processa, lança e confirma. A lógica de interpretação é pura e tem testes (`tests/bankNotifications.test.ts`).

## Como rodar

Pré-requisitos: Node.js 22+ (ou Bun) e, opcionalmente, uma [chave da API do Gemini](https://aistudio.google.com/apikey).

```bash
bun install                 # ou npm install
cp .env.example .env        # e preencha GEMINI_API_KEY
bun run dev                 # http://localhost:3000
```

Para usar seu próprio projeto Firebase, troque os valores de `firebase-applet-config.json` pelos do seu app Web e publique `firestore.rules` no console do Firebase.

| Script | O que faz |
| --- | --- |
| `dev` | servidor Express + Vite com hot reload |
| `build` | build do app em `dist/` e do servidor em `server.js` |
| `start` | serve o build de produção |
| `lint` | checagem de tipos com `tsc` |

## App Android e leitura de notificações

1. Abra a aba **Actions**: o workflow **Build APK** roda a cada push na `main` (ou manualmente).
2. No celular, abra **Releases**, baixe **RetroFin.apk** e instale.
3. No app: **Análises → Importar & Celular → Notificações → Liberar acesso** e ative o RetroFin.
4. Se o Android mostrar *Configuração restrita* (padrão para apps instalados por APK no Android 13+): **Ajustes → Apps → RetroFin → ⋮ → Permitir configurações restritas** e repita o passo 3.
5. Em **Bateria**, deixe o RetroFin como **Sem restrições**.

A tela de notificações mostra as últimas lidas e o motivo quando uma é ignorada (propaganda, fatura, aviso de limite).

Para levar os dados da versão web: **Backup e vínculos → Exportar** na web e **Restaurar** no APK.

> **Assinatura do APK:** a chave fica só nos *Secrets* do GitHub (`ANDROID_KEYSTORE_BASE64` e `ANDROID_KEYSTORE_PASSWORD`), nunca no repositório. Sem eles, o workflow compila com uma chave temporária e não publica em Releases.

## Privacidade e servidor

- As rotas de webhook do MacroDroid foram removidas: elas gravavam no banco de qualquer usuário só com o id na URL.
- Em servidor público, defina `RETROFIN_API_KEY` e cole o mesmo valor em **Backup e vínculos → Categorização**. Sem a chave, quem descobrir a URL consegue usar a sua cota do Gemini.
- Para a IA vão só descrição do estabelecimento, valor, data e canal. Pix para pessoas vai como `Pix para [pessoa]`.
- O Firestore só deixa cada usuário ler e gravar os próprios dados (`firestore.rules`).

## Licença

[MIT](LICENSE)
