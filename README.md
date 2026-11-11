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
npm run test:logic # 177 testes de lógica pura (score, modos, insights, parser, importador, mural, widgets)
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

## Gráficos

Todos são desenhados em `react-native-svg` (`src/components/charts.tsx`) — sem `react-native-chart-kit`.
O motivo está na auditoria: chart-kit não cobre heatmap, radar com sobreposição, linha multi-série com meta
nem barras agrupadas com rótulo de valor; usar a lib só para parte dos gráficos deixaria dois estilos
diferentes na mesma tela.

| Componente | O que faz | Onde aparece |
|---|---|---|
| `Heatmap` | grade de dias com score (escala do mural) | Leitura (14 dias) |
| `BarChart` | barras com valor no topo, cor por faixa | Revisões › score por dia · Sono (horas por noite) |
| `LineChart` | 1+ séries, buracos reais (`null`) sem interpolar, linha de meta, eixo Y com escala e unidade | Revisões (mês, áreas), Inteligência (14 dias), Peso (kg + média móvel 7d) |
| `RadarChart` | 4 eixos com sobreposição da semana anterior | Ayanokoji, Inteligência (equilíbrio entre áreas) |
| `DonutChart` | composição com % por categoria e total | Finanças (despesas por categoria) |
| `GroupedBars` | duas séries por mês (receita × despesa) | Finanças |
| `ConstancyHeatmap` / `MiniHeatmap` | mural de constância (toque no dia abre o detalhe) | Constância, Hoje (6 semanas), Revisões (12 semanas) |

Regras aplicadas em todos:

- **Sem dado ≠ zero.** Ponto sem registro é `null`: a linha quebra, a barra fica em cinza e o texto diz
  "Sem dado". Nada é interpolado.
- **Gráfico a partir de 3 pontos.** Cada tela checa `>= 3` antes de desenhar e mostra "Gráficos a partir de
  3 pontos de dado" quando não há base.
- **Gráficos só em Revisões (semanal+), Inteligência e módulos.** O dashboard do dia não tem gráfico de
  tendência — só o mini mural de constância.
- **Escala explícita.** Score sempre 0–10; horas de sono 0–12; peso usa `max(peso, meta) + 2` para a linha
  de meta não sair do quadro.

## Assets

`assets/icon.png` (mipmap adaptativo) e `assets/splash.png` (splash nativa via `expo-splash-screen`)
são gerados e referenciados no `app.json`. `assets/lottie/confetti.json` é o confetti local
(60 peças, 2s, sem loop) usado ao fechar 100% do checklist.

## Widget de tela inicial (Android)

Implementado com `react-native-android-widget` (o caminho suportado pelo Expo, via config plugin).
São **dois** widgets: `Prime` (streak + próxima tarefa) e `Constancia` (mural de constância).

O widget `Prime` mostra:

- 🔥 streak geral (dias com score > 5)
- modo do dia (🟢 normal / 🟡 mínimo / 🟣 ataque / 🔴 recuperação)
- progresso do checklist (`3/7` + barra)
- próxima tarefa em aberto (com área e alvo do modo)
- botão **✓ Feito** que conclui a próxima tarefa direto da home screen e grava o horário

O widget `Constancia` mostra:

- o mural de constância em miniatura (7 linhas × N semanas, segunda→domingo)
- cor por score do dia, exatamente a mesma escala do mural do app
  (`#1F1F1F` sem registro · `#B32B2B` < 4 · `#A87300` 4–5,9 · `#00A85A` 6–7,9 · `#39FF14` ≥ 8)
- dia de hoje com borda branca; dias futuros em preto (não inventam nível)
- 🔥 streak e total de dias cumpridos no período visível
- número de semanas calculado pela largura real do widget (`muralColumnsForWidth`, 6 a 53)

Arquivos:

```
app.config.ts               config plugin (nome, tamanhos, resizeMode, updatePeriodMillis 3h, preview)
index.ts                    entry point próprio: expo-router/entry + registerWidgetTaskHandler
src/widget/PrimeWidget.tsx  UI do widget principal (FlexWidget/TextWidget, dark only)
src/widget/ConstancyWidget.tsx  UI do widget do mural (grade de quadrados + legenda)
src/widget/data.ts          leitura PURA do AppData (testada) — sem dado => "Sem dado"
                            + muralData()/muralColumnsForWidth()/MURAL_COLORS
src/widget/handler.tsx      WIDGET_ADDED/UPDATE/RESIZED/CLICK, lê AsyncStorage, recalcula score
src/widget/sync.tsx         sincroniza o widget após check-in (useWidgetSync no dashboard)
app/modulo/widget.tsx       Perfil → Widget: prévia, "adicionar à tela inicial", "atualizar agora"
assets/widget-preview/prime.png
assets/widget-preview/constancia.png
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
Para o mural: `android/app/src/main/java/com/myprime/app/widget/Constancia.java`,
`res/xml/widgetprovider_constancia.xml` (250×150dp, 4×3 células, resize horizontal|vertical) e
o receiver `MY PRIME · Mural`. Os dois aparecem no seletor de widgets do launcher.

Como fixar: Perfil → Widget → **Fixar widget do mural** (usa `requestPinWidget`; se o launcher
não suportar, adicionar manualmente pelo seletor). O widget do mural é atualizado junto com o
principal depois de cada check-in (`useWidgetSync`) e a cada 3h pelo launcher.

## Mural de constância (estilo GitHub contributions)

`Hoje → Constância` (mini, 6 semanas) e `Perfil → Constância` / revisão semanal (completo).

- Cada quadrado é **um dia**; a cor é o **score** do dia, não uma métrica inventada:
  `sem registro` · `score < 4` · `4–5,9` · `6–7,9` · `≥ 8` (verde neon)
- Semana começa na **segunda**, rótulos de mês no topo, legenda "Menos → Mais"
- **Toque em qualquer dia** → abre o registro daquele dia (score, 5 fatores, tarefas feitas com horário,
  falhas com tipo/legitimidade/custo, vitória pequena e correção)
- Três escopos na tela dedicada: **último ano (53 semanas)**, **últimos 5 meses** lado a lado, e **por área**
  (aí o dia acende considerando só as metas daquela área)
- Estatísticas: streak atual (score ≥ 6), melhor sequência, dias cumpridos, dias em nível máximo
- Dia sem registro fica **apagado** — nada é interpolado (regra 1)

Lógica em `src/lib/heatmap.ts` (pura, testada), UI em `src/components/Heatmap.tsx`.

## Importar plano completo (metas, protocolo, dados)

`Perfil → Enviar meus planos e dados` (ou o botão "Já tenho um plano" na splash) abre `app/importar.tsx`.

**Aceita:** `.md` / `.txt` (plano em texto), `.json` (plano estruturado) e **backup do próprio app** (JSON).

**O que ele organiza automaticamente**

| No arquivo | Vira |
|---|---|
| `## Treino` + bullets | metas daquela área |
| `Treinar 5x \| mín 3x \| ideal 5x \| excelente 6x \| prioridade` | meta com 3 níveis + prioridade alta |
| `SE … → ENTÃO … PORQUE …` | regra SE-ENTÃO rastreada |
| `Delivery → 7 dias seguidos com score ≥ 7` | recompensa com critério e alvo |
| `Sapiens — Harari — 443 páginas — até página 120` | livro com progresso |
| `Quem sou:` / `Não aceito mais:` / `Nome:` | identidade |
| `Lembrete matinal 07:00`, `Meta de sono 7h30` | configurações |
| seção `Finanças` / `Peso` | lançamentos / pesagens |
| seção `Ayanokoji`, `24 semanas` | protocolo |
| backup JSON | restaura tudo, inclusive histórico de dias |

**O que ele devolve — e é o ponto principal:** uma lista **tintim por tintim** do que só a pessoa pode
escrever, cada item com *porquê*, *onde fazer* e *exemplo*:

- identidade (“Quem sou”, “Não aceito mais”) — não dá para inferir de um arquivo de metas
- mín/ideal/excelente e prioridade de cada meta que veio sem isso
- pelo menos 1 regra SE-ENTÃO
- recompensa com critério verificável
- livro atual + página
- lançamentos reais de finanças, horas de sono, notas semanais do Ayanokoji
- **check-in de hoje** (energia + modo) — o arquivo nunca sabe sua energia de agora
- itens que já existiam e por isso **não** foram duplicados
- seções do arquivo que não foram reconhecidas

Arquivo-modelo pronto: `assets/my-prime-plano-modelo.md` (também baixável/compartilhável pelo app,
e editável direto).

**Segurança:** nada é salvo antes da confirmação; plano soma sem duplicar metas; backup substitui tudo
(e a tela avisa em vermelho). Metas importadas **não se perdem** se o onboarding abrir depois.

## Limites honestos

- O widget exige um **dev build/APK** (não roda no Expo Go, que não tem o módulo nativo).
  Para testar: `npm run build:apk` ou `npx expo prebuild -p android && ./gradlew assembleRelease`.
- A lib de widget exige Expo ≥ 54; por isso o projeto foi migrado de SDK 53 para **SDK 54**
  (RN 0.81, Router 6, Reanimated 4) e o `expo-file-system` passou para a API `File`/`Paths`.
- PDF aceito no seletor de upload não é lido (é binário); o app avisa em vez de fingir importação.
- Notificações exigem permissão do usuário e não funcionam na web (apenas no APK).
- Relatórios anuais com menos de 6 meses mostram o aviso e o maior período disponível.
- PDF no seletor de importação não é lido (é binário) — converta para .txt/.md.
- Desmarcar uma tarefa sempre exige o registro de falha (tipo + legitimidade). Sem isso, não há dado para
  a análise — é uma escolha de produto, não uma limitação técnica.
