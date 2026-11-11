# MY PRIME

**Sistema de autorregulação comportamental diário.** Não é um tracker de hábitos genérico — é um operador de loop:

```
intenção → execução → registro → análise → correção → recompensa
```

A disciplina vem do sistema, não do humor do usuário. Tudo é local (AsyncStorage): nenhum dado sai do dispositivo.

---

## Stack

React Native + Expo SDK 54 (managed) · TypeScript strict · Expo Router 6 · Zustand · AsyncStorage ·
react-native-svg (gráficos) · Lottie (confetti) · expo-notifications / haptics / image-picker /
document-picker / print / sharing / file-system · react-native-reanimated 4 · date-fns ·
**react-native-android-widget** (widget de tela inicial).

## Rodando

```bash
npm install
npm start          # Expo dev server (QR code no Expo Go)
npm run android    # emulador/dispositivo
npm run web        # preview rápido no navegador
npm run typecheck  # tsc --noEmit (strict)
npm run test:logic # 40 testes de lógica pura (score, modos, insights, parser, rewards, badges)
```

## Gerando o APK (Android)

O APK não é gerado dentro deste sandbox (sem Android SDK/Java aqui). Duas opções:

```bash
# 1) EAS Build — gera APK na nuvem, sem Android SDK local
npx eas-cli login
npm run build:apk        # profile "preview" => buildType: apk

# 2) Build local (precisa de JDK 17 + Android SDK)
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
# saída: android/app/build/outputs/apk/release/app-release.apk
```

`app.json` já traz `package: com.myprime.app`, tema dark (`userInterfaceStyle: dark`), permissões de
notificação/alarme e o plugin do expo-notifications.

---

## Arquitetura

```
app/
  _layout.tsx            Stack raiz + agendamento de lembretes
  index.tsx              Splash (2s) → onboarding ou dashboard
  onboarding.tsx         Wizard de 4 telas (identidade, áreas, metas, ajustes)
  (tabs)/
    index.tsx            HOJE: energia, modo, checklist, falhas, diário, score
    revisoes.tsx         Semanal / Mensal / Trimestral / Anual
    metas.tsx            CRUD de metas por área + acesso aos módulos
    inteligencia.tsx     Zona de perigo, padrões, honestidade, mapas, regras SE-ENTÃO
    perfil.tsx           Identidade, configurações, exportação, upload, reset
  modulo/
    leitura · financas · peso · sono · pomodoro · recompensas · conquistas · ayanokoji
src/
  theme.ts               Design system (dark-only, cores/tipografia/áreas)
  lib/
    types.ts             Modelo de dados (@myprime:*)
    storage.ts           Persistência AsyncStorage
    store.ts             Zustand: todo o loop em ações atômicas
    score.ts             Score 5 fatores + checklist por modo + streaks + zona de perigo
    insights.ts          Padrões, gatilhos, correlações, checagem de honestidade
    parser.ts            Extração de metas de .txt/.md/.json
    export.ts            Export JSON + relatório PDF
    badges.ts/rewards.ts Gamificação verificável
    notifications.ts     Lembretes locais (carregamento sob demanda)
    haptics.ts           Feedback tátil respeitando o toggle
  components/            ui.tsx (design system), charts.tsx (svg), sheets, cartões
```

## O loop, na prática

1. **Energia + modo** — 3 sliders definem a sugestão de modo (mínimo / normal / ataque / recuperação).
2. **Checklist gerado do modo** — mínimo esconde prioridade baixa, ataque usa o nível "excelente" + extras,
   recuperação só prioridade alta no mínimo + plano de retorno.
3. **Falha registrada em 2 eixos** — tipo (Falta Real, Má Gestão, Prazer Imediato, Preguiça, Prioridade Errada)
   × legitimidade (Legítima, Fraca, Fuga, Autoengano, Reorganização Real) + custo + plano.
4. **Diário** — 5 campos sempre obrigatórios (prometido, feito, evitado, atrapalhou, correção) + contexto.
5. **Score** — média ponderada: regularidade 30%, continuidade 20%, recuperação 15%, honestidade 15%,
   progresso real 20%. Nunca "% de tarefas" puro.
6. **Narrativa** — vitória específica do dia, cobrança só em prioridade alta, fechamento do loop.

## Regras absolutas implementadas (e testadas)

| # | Regra | Onde |
|---|-------|------|
| 1 | Nunca inventar dados — "Sem dado" em cinza | `ui.tsx › NoData`, todas as revisões |
| 2 | Nunca elogio vazio — recompensa cita algo do dia | `score.ts › victoryLine` |
| 3 | Nunca humilhação — cobrança sobre a escolha | `score.ts › chargeLines` |
| 4 | Nunca forçar padrão com < 7 dias | `insights.ts › MIN_DAYS_FOR_PATTERNS` |
| 5 | Foto é sempre opcional e pontual | `DiarySheet`, `modulo/peso` |
| 6 | Diário com 5 campos obrigatórios | `DiarySheet.tsx` |
| 7 | Desculpas em 2 eixos | `FailureSheet.tsx` |
| 8 | Score de 5 fatores com pesos | `score.ts › computeScore` |
| 9 | Modo altera o checklist | `score.ts › buildChecklist` |
| 10 | Alta = cobrança, normal = ajuste, baixa = registro | `chargeLines` |
| 11 | Questiona sem acusar | `inteligencia.tsx › honestidade` |
| 12 | Gráficos só em revisões (semanal+) | `revisoes.tsx`, `charts.tsx` |
| 13 | Alerta de saturação > 8 metas | `metas.tsx`, `revisoes.tsx` |
| 14 | Zona de perigo automática | `score.ts › detectDanger` |
| 15 | Regras SE-ENTÃO rastreadas | `store.ts › markRuleActivated` |

## Assets

`assets/icon.png` (mipmap adaptativo) e `assets/splash.png` (splash nativa via `expo-splash-screen`)
são gerados e referenciados no `app.json`. `assets/lottie/confetti.json` é o confetti local
(60 peças, 2s, sem loop) usado ao fechar 100% do checklist.

## Widget de tela inicial (Android)

Implementado com `react-native-android-widget` (o caminho suportado pelo Expo, via config plugin).
O widget `Prime` mostra:

- 🔥 streak geral (dias com score > 5)
- modo do dia (🟢 normal / 🟡 mínimo / 🟣 ataque / 🔴 recuperação)
- progresso do checklist (`3/7` + barra)
- próxima tarefa em aberto (com área e alvo do modo)
- botão **✓ Feito** que conclui a próxima tarefa direto da home screen e grava o horário

Arquivos:

```
app.config.ts               config plugin (nome, tamanhos, resizeMode, updatePeriodMillis 3h, preview)
index.ts                    entry point próprio: expo-router/entry + registerWidgetTaskHandler
src/widget/PrimeWidget.tsx  UI do widget (FlexWidget/TextWidget, dark only)
src/widget/data.ts          leitura PURA do AppData (testada) — sem dado => "Sem dado"
src/widget/handler.tsx      WIDGET_ADDED/UPDATE/RESIZED/CLICK, lê AsyncStorage, recalcula score
src/widget/sync.tsx         sincroniza o widget após check-in (useWidgetSync no dashboard)
app/modulo/widget.tsx       Perfil → Widget: prévia, "adicionar à tela inicial", "atualizar agora"
assets/widget-preview/prime.png
```

Detalhes de implementação:

- O `package.json` agora tem `"main": "index.ts"` (necessário para registrar o WidgetTaskHandler
  fora do contexto do Expo Router).
- O widget **não** usa estado em memória: o handler lê o AsyncStorage a cada evento, porque roda em
  um contexto separado do app.
- O widget nunca inventa número: sem metas/sem dia registrado mostra "Sem dado".
- A barra de progresso é desenhada em dp (widgets Android não aceitam `%`).
- No web/Expo Go o módulo nativo não existe: o import é sob demanda e a tela explica a limitação.

Validado localmente: `npx expo prebuild -p android` gera
`android/app/src/main/java/com/myprime/app/widget/Prime.java`,
`res/xml/widgetprovider_prime.xml` (250×110dp, 4×2 células, resize horizontal|vertical,
updatePeriodMillis 10800000) e o `<receiver>` no `AndroidManifest.xml`.

## Limites honestos

- O widget exige um **dev build/APK** (não roda no Expo Go, que não tem o módulo nativo).
  Para testar: `npm run build:apk` ou `npx expo prebuild -p android && ./gradlew assembleRelease`.
- A lib de widget exige Expo ≥ 54; por isso o projeto foi migrado de SDK 53 para **SDK 54**
  (RN 0.81, Router 6, Reanimated 4) e o `expo-file-system` passou para a API `File`/`Paths`.
- PDF aceito no seletor de upload não é lido (é binário); o app avisa em vez de fingir importação.
- Notificações exigem permissão do usuário e não funcionam na web (apenas no APK).
- Relatórios anuais com menos de 6 meses mostram o aviso e o maior período disponível.
- Desmarcar uma tarefa sempre exige o registro de falha (tipo + legitimidade). Sem isso, não há dado para
  a análise — é uma escolha de produto, não uma limitação técnica.
