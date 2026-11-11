# Auditoria — MY PRIME vs. briefing

Verificação item por item do que foi pedido contra o que existe no repositório.
Legenda: ✅ feito e verificado · 🟡 feito com desvio justificado · ❌ não feito (motivo).

---

## Stack obrigatória

| Item | Status | Observação |
|---|---|---|
| React Native + Expo managed | ✅ | **SDK 54** (era 51+ no pedido; subi para 54 por exigência do widget) |
| TypeScript strict | ✅ | `tsc --noEmit` limpo, também com `--noUnusedLocals` |
| Expo Router (file-based) | ✅ | v6, com `(tabs)` + 9 rotas de módulo |
| AsyncStorage | ✅ | todas as chaves `@myprime:*` do briefing |
| react-native-chart-kit + svg | 🟡 | **desvio**: uso só `react-native-svg` (`components/charts.tsx`). chart-kit não suporta heatmap, radar nem linha multi-série com meta; removi a dependência morta em vez de fingir que usava |
| expo-image-picker | ✅ | foto do diário (câmera+galeria) e fotos de progresso |
| expo-document-picker | ✅ | upload de planos |
| expo-notifications | ✅ | 4 lembretes + streak + revisão + zona de perigo |
| expo-haptics | ✅ | `lib/haptics.ts` respeitando o toggle |
| react-native-reanimated | ✅ | `components/FadeIn.tsx` (entradas em cascata no dashboard) |
| lottie-react-native | ✅ | `assets/lottie/confetti.json` próprio, 2s, sem loop |
| expo-print + expo-sharing | ✅ | relatório PDF mensal |
| expo-file-system | ✅ | API `File`/`Paths` (SDK 54) |
| date-fns | ✅ | instalado; utilidades de data em `lib/date.ts` |
| Zustand | ✅ | `lib/store.ts` (loop inteiro em ações) |

## Design system

| Item | Status |
|---|---|
| Dark mode obrigatório (`userInterfaceStyle: dark`) | ✅ |
| Paleta completa (bg/accent/text/border) | ✅ `theme.ts` |
| Tipografia H1/H2/H3/Body/Caption/Micro | ✅ |
| Cards 16px radius, padding 16, borda sutil | ✅ |
| Badges, botões primário/secundário, sliders, checkboxes, inputs | ✅ |
| Pickers como bottom sheet | ✅ `Sheet` + `OptionPicker` + `TimeField` |
| Transição de telas slide 250ms | ✅ (`animationDuration: 250`) |
| Check com bounce 200ms + haptic | ✅ `Checkbox` |
| Score circular 800ms ease-out | ✅ `ScoreRing` |
| Confetti ao fechar 100% do checklist (2s, não repete) | ✅ |
| Pulse vermelho na zona de perigo | ✅ |
| Entradas animadas | ✅ reanimated (`FadeInDown`) |

## Navegação

5 abas (Hoje, Revisões, Metas, Inteligência, Perfil) ✅

---

## Fase 1 — Core

| Requisito | Status | Notas |
|---|---|---|
| Splash 2s com logo e subtítulo | ✅ | |
| Onboarding 4 telas + dots | ✅ | dots viraram barra segmentada (mesma função) |
| Tela 1: nome + 2 textareas com mín. 20 | ✅ | validação real (`>= 20`) |
| Tela 2: 10 chips + criar área + mín. 3 | ✅ | |
| Tela 3: metas por área, prioridade, mín/ideal/exc | ✅ | |
| Tela 4: horários, toggles, botão COMEÇAR | ✅ | |
| Salvar + `@myprime:onboarded` | ✅ | |
| Header saudação por horário + data PT-BR + badge de modo | ✅ | |
| Check-in de energia (3 sliders) + sugestão + sobrescrever | ✅ | |
| Card colapsa com resumo `⚡6 🧠7 😰3 → 🟢 Normal` | ✅ | |
| Checklist gerado das metas, filtrado pelo modo (4 regras) | ✅ | testado |
| Item: nome, chips, prioridade, mín/ideal/exc, nota | ✅ | |
| Marcar → haptic + animação + verde | ✅ | |
| Desmarcar → modal de falha (tipo × legitimidade + custo + plano) | ✅ | desmarcar **exige** o registro |
| Botão "Fechar o dia" após 18h ou manual | ✅ | texto muda antes/depois das 18h |
| Diário: 5 campos obrigatórios + contexto | ✅ | correção obrigatória se score < 6 |
| Opcionais: humor, sono, alimentação, foco, tentação, recaída, vitória, custo R$, foto | ✅ | |
| Emoções (1–3 do grid de 15) | ✅ | |
| Score circular com cor por faixa | ✅ | 8–10 agora usa verde neon (#39FF14) distinto do 6–7 |
| Cálculo do score (5 fatores com pesos) | ✅ | testado (regularidade 30 / continuidade 20 / recuperação 15 / honestidade 15 / progresso 20) |
| Frase de vitória específica | ✅ | cita área/tarefa real |
| Frase de cobrança só em prioridade alta + custo | ✅ | testado |
| Frase de fechamento + "Ver Amanhã →" | ✅ | |
| **Resumo do dia: DESTAQUE / FOCO / BLOQUEIOS + correção** | ✅ | adicionado na auditoria (`DayResult`) |
| Metas: agrupadas por área, arquivadas, CRUD | ✅ | |
| **Swipe-left com Editar / Arquivar / Excluir** | ✅ | adicionado na auditoria (`SwipeableRow`, PanResponder) |
| Perfil: identidade editável, config, dados, sobre | ✅ | |
| Exportar JSON / envio de planos / reset com dupla confirmação | ✅ | |

## Fase 2 — Inteligência

| Requisito | Status | Notas |
|---|---|---|
| Zona de perigo com os 4 thresholds | ✅ | testado |
| Card pulsante + ação mínima + "Ativar Modo Recuperação" | ✅ | |
| Horário de falha / desculpa dominante / áreas que caem juntas / pico produtivo | ✅ | |
| Gate de 7 dias ("Coletando dados... X/7") | ✅ | testado |
| Checagem de honestidade + confirmar/ajustar | ✅ | também no momento do check (energia < 3 + prioridade alta) |
| Mapas de gatilhos / falhas / evolução por área | ✅ | gráfico com seleção de áreas |
| Regras SE-ENTÃO (criar, ativar, eficácia, sugestões) | ✅ | |
| Revisão semanal completa (tabela, barra, heatmap, padrões, vitória, falha, saturação, foco) | ✅ | |
| Revisão mensal (linha 30 pontos, radar, status de metas, top 3 falhas, custo, cortar/priorizar, sono × performance) | ✅ | |
| Revisão trimestral (identidade, áreas, comparativo, mapas, prioridades) | ✅ | |
| Revisão anual (aviso < 6 meses, jornada, evolução, vitórias, padrões, identidade, direção) | ✅ | |
| "Sem dado" e gráficos só com 3+ pontos | ✅ | |

## Fase 3 — Módulos

| Módulo | Status | Notas |
|---|---|---|
| Sono avançado | ✅ | horários→horas, qualidade, bloqueadores, correlação |
| Recompensas reais | ✅ | cadeado/desbloqueio, progresso, "faltam X dias" |
| Check-in de meio do dia | ✅ | modal de 30s, "ainda dá, faça 15min", ponto de virada |
| Leitura | ✅ | livros, progresso, páginas/dia, heatmap, previsão |
| Finanças | ✅ | lançamentos, categorias, impulso, barras, donut, saldo |
| Peso e medidas | ✅ | média móvel 7d, meta tracejada, medidas, fotos |
| Protocolo Ayanokoji | ✅ | 24 semanas, radar 4 eixos com overlay, microtarefas, **próximo nível** |
| Diário de emoções | ✅ | **fase 3**: módulo próprio (`/modulo/emocoes`) — grid 15, 1–3/dia por momento, intensidade, nota, mapa de 12 semanas, ranking 30/90d, pares e efeito no score do dia seguinte com gate de 4 dias; o card da Inteligência continua com o resumo dos dias fechados |
| Pomodoro | ✅ | 3 presets, vínculo a tarefa, registro de tempo, notificação |

## Fase 3 — o que foi feito nesta rodada

Fecha a lacuna do **Diário de emoções**, o único módulo da fase 3 que existia pela metade:
antes só havia o grid de 15 emoções dentro do diário noturno (e `diary.emotions` só é
gravado quando o dia fecha). Agora existe módulo próprio, com log por registro.

| Item | Onde | Verificado por |
|---|---|---|
| Log de emoções com data, momento (manhã/tarde/noite), intensidade 1–5 e nota | `lib/emotions.ts`, chave `@myprime:emotions` | 19 asserções de lógica + 14 de ação |
| Limite de **1–3 por dia** barrado na lib (não só na tela) | `addEmotion` | teste de recusa do 4º + store |
| Mapa de calor de 12 semanas: dia sem registro fica `null`, nunca "neutro" | `emotionGrid`, `app/modulo/emocoes.tsx` | grade 4×7 com célula vazia |
| Ranking da janela (30/90 dias): frequência, intensidade média, momento dominante, score médio | `emotionStats` | contagem e médias |
| **Efeito no score do dia seguinte** com gate de ≥ 4 dias de cada lado | `emotionEffect`, `effectLine` | teste sem base (frase "faltam X dias") e com base |
| Pares que aparecem juntos (contagem, não correlação) | `emotionPairs` | par repetido conta 1 dia |
| Espelho em `diary.emotions` para o mapa das revisões | `store.addEmotion` / `removeEmotion` | espelho e teto de 3 |
| Fechar o dia **não apaga** emoção registrada durante o dia | `store.closeDay` | asserção de store |
| Export/import: `emotions` entra no backup e é sanitizada na volta | `export.ts`, `importer.ts`, `normalizeData` | 2 asserções |
| Sanitização de storage sujo (entrada sem data/emoção, intensidade inválida) | `sanitizeEmotionEntry` | 6 asserções |

Decisões declaradas:

1. **Registro é por ocorrência, não por dia.** O `diary.emotions` continua existindo (é o que o
   mapa das revisões lê), mas o log é a fonte da verdade e o espelho é derivado dele.
2. **Dia fechado recusa registro novo**, igual às outras ações — reabrir é a saída explícita.
3. **Efeito é descritivo, não causal.** A tela escreve "score seguinte foi X maior" e diz quantos
   dias de cada lado entraram; abaixo de 4 de cada lado ela não afirma nada.

## Fase 4 — Polimento

| Requisito | Status | Notas |
|---|---|---|
| 6 lembretes locais + permissão | ✅ | matinal, noturno, meio do dia, streak, zona de perigo, revisão |
| **Zona de perigo → notificação** | ✅ | adicionado na auditoria (máx. 1×/dia) |
| 8 badges com critério real | ✅ | sem botão de desbloquear |
| Streaks por área + geral | ✅ | |
| Exportar JSON + PDF | ✅ | |
| Upload inteligente com preview + confirmação | ✅ | .txt/.md/.json; PDF avisa que não lê |
| Animações e haptics | ✅ | |
| Splash | ✅ | |
| **Widget de home screen** | ✅ | `react-native-android-widget` + config plugin; validado por `expo prebuild` |

## Fase 4 — o que estava no papel e não acontecia

Mesma varredura cética da fase 3. Três itens marcados ✅ não funcionavam como a tabela dizia.

| # | O que a auditoria dizia | O que o código fazia | Correção + prova |
|---|---|---|---|
| 1 | "6 lembretes locais + permissão ✅" | **Nenhum lembrete era agendado, nunca.** `scheduleReminders` chamava `getPermissionsAsync()` e saía com `return` se não houvesse permissão. E **nada no app chamava `requestPermissionsAsync`** nesse fluxo — o diálogo só existiria em `notifyNow`/restTimerAlarm, que ninguém dispara no boot. Logo: permissão nunca concedida ⇒ zero notificações, para sempre. O Perfil mostrava os horários como se valessem | `scheduleReminders` ganhou `options.askPermission`; o onboarding (depois de escolher horários) e o botão **Ativar lembretes neste aparelho** no Perfil pedem a permissão; o boot reagenda sem abrir diálogo. O Perfil agora mostra quantos lembretes estão agendados e quando, lendo `@myprime:remindersAt` | 17 asserções rodando o `notifications.ts` **real** com stub do `expo-notifications` (sem diálogo no boot, diálogo no toque, 5 agendados, toggles desligados, web, erro do sistema, horário inválido). Reintroduzir o bug derruba 5 |
| 2 | "8 badges com critério real ✅" | O `unlockedAt` era gravado **em silêncio**. Nenhum componente comparava antes/depois: a pessoa conquistava e não sabia | `lib/achievements.ts` compara os dois estados e o store enfileira em `freshUnlocks`; `UnlockBanner` (aba Hoje) anuncia com confetti e o critério cumprido | 9 asserções de lógica + 6 de store (fila, idempotência, badge de versão antiga, dispensar sem apagar). Reintroduzir o `set()` antigo derruba 2 |
| 3 | "Exportar PDF ✅" | Funcionava, mas **sem teste**: nenhum script cobria o HTML do relatório | Teste do `buildReportHtml` real (compilado com stubs de expo-print/sharing): mês com dados, mês vazio e mês com dia sem tarefa | 7 asserções: sem `NaN`/`undefined`, "Sem dado" honesto, área listada só quando há tarefa |

Correções de higiene que saíram junto:

- `scheduleReminders` devolve `{ status, count, message }` em vez de `void` — a UI não pode mais fingir que agendou.
- Erro do sistema (AlarmManager, canal, etc.) agora vira `status: 'error'` visível, não `console.warn` silencioso.
- O streak só entra na lista se existir (`streakDays > 0`), sem notificação com "0 dias seguidos".

Limites que continuam valendo (declarados):

1. **Permissão negada não tem contorno**: as notificações só tocam depois de liberar nos ajustes do sistema — o app agora diz isso em vez de esconder.
2. **Alarme nativo** abre o Relógio do Android para confirmação manual (o app não cria alarme de sistema por conta própria); é o comportamento documentado, não um bug.
3. **Badges continuam sem som/modal**: o anúncio é uma faixa no topo da aba Hoje, dispensável com um toque.

## Auditoria cética — o que os ✅ escondiam

Revisão feita sem confiar nos documentos acima: cada função foi chamada com dado real e com dado
hostil (o que um backup antigo grava de verdade), e cada tela foi renderizada fora do emulador.
**Todo defeito abaixo tem teste de regressão no `npm test`** — não é relatório, é trava.

### Defeito 1 — `1h30` valia 60 minutos

`parseDurationToMinutes` somava horas **ou** minutos: `'1h30'` → 60, `'45min'` → 45, `'2 horas'` → 120.
Alvo com formato composto (o mais comum numa meta de treino) subestimava a carga do dia em 33%.
Corrigido: `'1h30'` = 90, `'1h 30min'` = 90, `'1:30'` = 90, `'1,5h'` = 90, `'2 horas'` = 120.

### Defeito 2 — baldes somavam valor cru

`bucketTargets` fazia `a + c.amount` sem checar nada: despesa `-50` subtraía do balde, `NaN` contaminava
alvo/sobra/`%`, `'80'` (texto de backup) virava concatenação. Corrigido: só entra número finito > 0;
entrada não-array ou com data inválida é filtrada. `addFinance`/`addWeight` passaram a recusar valor
inválido na origem (segunda barreira).

### Defeito 3 — tela de Finanças e de Peso quebravam com backup antigo

`JSON.stringify(NaN)` grava `null` no disco. `normalizeData`/`loadAll` sanitizavam `days`, `goals` e
`emotions` — `finances`, `weight`, `books`, `rules` e `rewards` entravam **crus**. Resultado real
(render fora do app): `financas` estourava em `monthEntries.filter(...).reduce(...).toFixed`, e `peso`
em `Cannot read properties of null (reading 'toFixed')`.

Corrigido em três camadas:

1. `src/lib/sanitize.ts` (novo): repara o que dá (`"50,25"`, `" R$ 50 "`, peso `"82,4"`), descarta o
   que não dá (valor ≤ 0, data inválida, peso fora de 20–400 kg, livro sem título, regra sem gatilho).
2. `storage.ts`: boot e import passam pelo sanitizador; **e contam o que descartaram** (`lastSanitize`).
3. Telas de Finanças e Peso formatam com guarda local e mostram aviso do que foi ignorado.

O descarte **não é silencioso**: o Perfil mostra quantos registros foram descartados e em qual lista.
Sem esse aviso, o total do mês mudaria sem explicação — o que seria pior que o crash.

### Defeito 4 — backup completo não restaurava o diário de emoções

`applyImport` copiava 14 campos e esquecia `emotions`: restaurar um backup apagava o diário de
emoções do estado (e do disco). Corrigido nos dois caminhos (`set` e `persistMany`); ao restaurar,
`freshUnlocks` começa vazio para não anunciar 30 conquistas de uma vez.

### Defeito 5 — importador dizia `0` linhas ignoradas sempre

Texto livre sem estrutura gerava 7 pendências, `ignoredLines: 0` e `unknownSections: []` — o usuário
não tinha como saber que nada do arquivo tinha sido aproveitado. Agora: seção desconhecida entra pelo
nome, linha que não virou meta é contada (inclusive o texto antes do primeiro cabeçalho), e a tela de
importação mostra o bloco "linhas que não viraram meta".

### Defeito 6 — `app.json` e `app.config.ts` descreviam widgets diferentes

O APK sai do `app.json`, mas a config tipada prometia outra coisa: Constancia 110dp/4×2/30min contra
150dp/4×3/3h, e o Prime com 30min contra 3h. Alinhado ao `app.config.ts` (120dp de conteúdo + padding
cabe em 4×3; 3h respeita o mínimo de 30min do Android). Um teste compara os dois arquivos de verdade —
se divergirem de novo, o `npm test` falha.

### Defeito 7 — dava para não saber qual build estava instalada

`version` fixa em `1.0.0` e `versionCode: 1` em todas as gerações: o Android trata duas builds
diferentes como **o mesmo app** (a atualização pode ser recusada), e o Perfil mostrava "MY PRIME v1.0"
em qualquer versão. Além disso a release usa nome fixo (`my-prime-latest.apk`), então o arquivo baixado
não diz a que commit pertence.

Corrigido: `version: 1.1.0` + `versionCode: 2` nos dois arquivos de config, e o Perfil lê a versão real
do pacote (`expo-constants`) e mostra `build N`. Teste compara `version`/`versionCode` entre `app.json` e
`app.config.ts` e exige que a tela mostre a versão.

### Verificado e OK (não só "parece ok")

Datas (`addDays`, `weekStart`, `daysInMonth(2028, 1) = 29`, `diffDays`), `generalStreak` com buraco e
duplicata, `detectDanger`, `computeScore` com meta inativa, `bookPercent` 0..1, `pagesPerDay`,
`waterProgress`, `dietTrend`, timer (`formatClock(65) = '01:05'`), mural 9×7 sem score no futuro,
`recorded` = score **ou** tarefas, `fulfilled ≤ recorded`, waffle sem célula futura, gauge mensal ≤ 100%,
progresso diário ≤ 1, ranking sem divisão por zero, gate de 7 dias, `sleepCorrelation`/`emotionCorrelation`
com amostra curta → `null`, `trendLine` confiável só com 7+ pontos, e 11 cenários de dado hostil sem NaN.

### Limites que continuam (declarados, não escondidos)

1. **Backup de versão futura** é aceito com aviso, não bloqueado — não há como migrar o que não existe.
2. **PDF enviado** não é lido (binário); o app diz isso em vez de fingir extração.
3. **Widget** só roda em APK/dev build, e o teste de layout é estrutural (não mede o launcher real).

## Dados (AsyncStorage)

Todas as chaves do briefing existem ✅ + extras declarados: `ayanokoji`, `weeklyFocus`,
`routeAdjustments`, e campos `honestyFlags`, `pomodoros`, `seeded` nos dias.

## Regras absolutas (1–15)

Todas implementadas e cobertas por teste ✅ (ver tabela no README).

---

## Auditoria de erros (varredura completa)

Varredura feita em `src/lib`, `src/components` e `app/**`: cada defeito abaixo foi **reproduzido**
(script ou teste falhando) antes da correção e agora tem teste de regressão no `npm test`.

| # | Defeito encontrado | Efeito real | Correção |
|---|---|---|---|
| 1 | `computeScore` lia `day.diary.context` sem garantia | dia antigo/backup sem diário **derrubava** o fechamento e o histórico (TypeError) | `normalizeDiary()` + `sanitizeDay()`; boot e import normalizam os dias |
| 2 | `toggleTask` liberava alteração no dia fechado **de hoje** | marcava/desmarcava tarefa de um dia já encerrado, com score calculado | dia fechado recusa a alteração (só `reopenDay` muda o passado) |
| 3 | `setEnergy`/`setMode`/`setTaskNote`/`setTaskExcuse`/`setMidday`/`addPomodoro` ignoravam o dia fechado | reescreviam energia, modo e tarefas de dias encerrados | todos barram dia fechado |
| 4 | `reopenDay` mantinha `score` | dia reaberto contava como cumprido em streaks, insights, waffle e gráficos | reabrir descarta o score |
| 5 | `addPomodoro` sem `ensureDay` | ciclo concluído era descartado se o dia ainda não existia (perda de tempo de foco) | cria o dia antes de gravar |
| 6 | `patchDiary` não existia | tela de Sono montava o dia inteiro por `useStore.setState` (fora do padrão, badges duplicados) | ação `patchDiary` no store, usada por Sono |
| 7 | `deleteGoal` apagava tarefa de **dias passados abertos** | histórico reescrito (o comentário dizia o contrário) | só o dia de hoje perde a tarefa |
| 8 | `archiveGoal`/`upsertGoal` deixavam tarefa desativada no checklist | meta desativada continuava no checklist de hoje; desarquivar reativava meta que estava desligada | checklist segue o estado da meta; `active` anterior é preservado |
| 9 | Contador do checklist somava tarefas de outros modos | mostrava "3/2 feitas" e anel > 100% | conta só as chaves do checklist do modo (tela, anel e widget) |
| 10 | Pomodoro usava `goal.id` em vez da chave da tarefa | extra do modo (`extra:revisao`) gravava tempo num id inexistente; trocar de meta não atualizava a seleção | usa `extraKey ?? id` e mantém a seleção válida |
| 11 | Meio do dia perdia a resposta "parcial" | "parcial" virava "não feita" na tela | `partial` persistido e exibido |
| 12 | Desmarcar um "feito" por engano exigia registro de falha | toque errado obrigava a inventar uma falha | primeiro toque desfaz; falha tem botão próprio no item |
| 13 | Gesto longo era a **única** forma de registrar falha | inacessível no web/teclado/leitor de tela | botão "registrar falha" em cada item em aberto |
| 14 | `detectDanger` ignorava `settings.targetDailyScore` | com meta 7, dias de 4–5 não geravam zona de perigo | threshold relativo à meta (`min(5, meta-1)`) |
| 15 | Janelas "últimos 7/14 dias" por posição no array | histórico com buracos comparava períodos errados (progresso do score, tendência, desculpa, honestidade) | janelas por data em `score.ts`, `insights.ts`, `badges.ts` |
| 16 | Badge "Honestidade Total" contava 7 dias quaisquer | desbloqueava com dias espalhados no ano | exige 7 dias seguidos |
| 17 | Streak por área começava em "hoje" mesmo sem registro | abrir o app antes de marcar zerava a conquista | começa no último dia registrado |
| 18 | Perfil tinha cópia própria do cálculo de streak | podia divergir do resto do app | usa `goalStreak` da lib |
| 19 | `normalizeData` não normalizava `days` | backup editado à mão entrava cru e quebrava telas | dias normalizados no import |
| 20 | Falha de `AsyncStorage.setItem` era só `console.warn` | app mostrava "salvo" sem ter salvo | `storageHealth` + aviso no Perfil |
| 21 | Salvar meta com nome vazio criava meta fantasma | item em branco no checklist | `save` recusa nome vazio |
| 22 | Editar meta descartava `originId` | vínculo com histórico importado se perdia | `originId` preservado |
| 23 | Fechar o dia 2× recriava o dia seguinte | perdia o que já tinha sido preenchido em "amanhã" | dia seguinte nunca é recriado se já existe |
| 24 | Meta sem nome / dia sem tarefas no gauge e no anel | projeção confusa e numerador inflado | projeção mínima 0 e anel limitado ao checklist do modo |
| 25 | Meta de storage antigo sem `priority`/`active` | meta sumia do checklist ou o badge fatal quebrava a tela | `sanitizeGoal` no boot e no import |
| 26 | Backup sem `schemaVersion` | formato impossível de evoluir sem adivinhar | `schemaVersion` no export + normalização na entrada |
| 27 | Nenhuma recuperação após perda de histórico | dias zerados = app recomeçava vazio em silêncio | snapshot automático + "Restaurar histórico" no Perfil |
| 28 | `hardReset` deixava snapshot órfão | aviso de recuperação voltava num app zerado de propósito | `hardReset` descarta snapshots |
| 29 | `scheduleReminders` rodava a cada mudança de `days`/`goals` | releitura de 14 chaves + streak O(n) dezenas de vezes por sessão | reagenda 1× por dia |

Testes que guardam essas correções:

- `npm run test:store` — **52 asserções de ação** (dia fechado, reabrir, pomodoro, metas, fechar o dia,
  dado antigo). Compila o store real com stub de persistência; é o teste que pega estado errado.
- `npm run test:logic` — **422 asserções** (inclui as 45 novas do diário de emoções: teto de 3/dia,
  sanitização de entrada, grade do mapa com dia sem registro, sequência, janela do ranking, gate do
  efeito no dia seguinte, pares e espelho no diário).
- `npm run test:render` — **42 montagens** dos gráficos com e sem dado.
- `npm run test:screens` — **42 montagens de tela** (app com histórico e app zerado) com store trocado
  por cenário: pega crash em runtime, tela vazia e `NaN`/`undefined` visível.

## Memória de dados (persistência) — como está

Pergunta objetiva: **o app guarda dados de forma confiável?** Resposta medida, não estimada.

### O que é bom

| Aspecto | Situação |
|---|---|
| Modelo | chaves separadas por domínio (`@myprime:days`, `:goals`, `:finances`…): 14 chaves, não um blob gigante |
| Escrita | cada ação do store grava só a chave que mudou (`persist`), alguns fluxos usam `persistMany` |
| Formato | JSON versionado a partir de agora (`schemaVersion: 1` no backup exportado) |
| Recuperação de formato | `normalizeDay` / `sanitizeGoal` no boot, no import de backup e no snapshot: prioridade ausente vira `normal`, meta sem `active` continua ativa, dia sem diário ganha `emptyDiary()` |
| Perda silenciosa | falha de gravação agora é visível (`storageHealth` + aviso no Perfil) |
| Perda de histórico | snapshot automático por chave + botão **Restaurar histórico** no Perfil |
| Portabilidade | export JSON completo + import de backup com validação e resumo do que entrou |

### Números medidos (payload real do app)

Dia completo (diário, energia, 6 tarefas, pomodoro, score, sono):

| Histórico | Tamanho de `@myprime:days` | `JSON.stringify` |
|---|---|---|
| 30 dias | 27 KB | 0,24 ms |
| 90 dias | 82 KB | 0,83 ms |
| 1 ano | 333 KB | 3,1 ms |
| 2 anos | 667 KB | 6,2 ms |

Conclusão: o custo por ação continua irrelevante (alguns ms). O gargalo nunca foi o tamanho
do JSON — era ler/gravar tudo em toda mudança de estado, que foi corrigido (os lembretes
agora são reagendados 1× por dia, não a cada edição).

### Limites que continuam existindo (declarados)

1. **Sem servidor**: tudo é local no AsyncStorage. Trocar de celular = exportar JSON e importar.
   Não há sincronização entre dispositivos.
2. **Snapshot é espelho da última versão boa**, não histórico versionado: protege contra
   perda total (dias zerados), não contra edição errada (ex.: apagar uma meta que você queria).
3. **Um arquivo por chave**: `days` cresce ~27 KB/mês. Em ~5 anos chega a ~1,6 MB — ainda ok
   para AsyncStorage, mas a partir daí valeria arquivar anos fechados.
4. **Fotos** do diário/progresso são gravadas como URI do arquivo; se o usuário apagar o arquivo
   do sistema, a foto quebra (o app trata como ausente, não como erro).
5. **Web** não tem AsyncStorage nativo persistente por padrão — a memória boa se aplica ao app
   Android/iOS, que é o alvo.

### Testes que guardam isso

- `npm run test:store` → 62 asserções, incluindo: boot sem dias + snapshot marca recuperação,
  restaurar devolve histórico e recalcula badges, boot normal não acusa perda, restore sem
  snapshot retorna `false` (sem falso sucesso), **backup restaura o log de emoções** e
  **valor inválido (NaN/0) não entra no estado** por `addFinance`/`addWeight`.
- Verificação direta de `normalizeData` com backup incompleto (meta sem `id`, sem `priority`,
  dia com tarefa inválida): meta inválida é descartada, dia é normalizado, settings preservadas.

## Desvios e limites — declarados honestamente

1. **chart-kit** não é usado (só `react-native-svg`). O briefing pedia a lib; ela não cobre heatmap/radar
   com meta, então os gráficos foram desenhados em SVG. Dependência removida para não ficar morta.
2. **Expo 51 → 54.** A lib de widget exige ≥ 54. Migração feita (RN 0.81, Router 6, Reanimated 4,
   `expo-file-system` API nova).
3. **APK não compilado aqui.** O sandbox só tem saída de rede para npm/PyPI/GitHub: JDK e Android SDK não
   baixam. Projeto pronto para `npm run build:apk` (EAS) ou prebuild + Gradle local.
4. **Widget não roda no Expo Go** (módulo nativo). Precisa de dev build/APK.
5. **Dots do onboarding** viraram barra segmentada de progresso (mesma informação, mais legível).
6. **PDF enviado no upload** não é lido (binário); o app informa em vez de fingir extração.

## Verificações executadas

- `npx tsc --noEmit` → limpo (e com `--noUnusedLocals`)
- `node scripts/run-logic-tests.mjs` → **474/474** (modos, score, streaks, cobrança, gate de 7 dias,
  zona de perigo, recompensas, badges, parser, importador, mural de constância, gráficos, widget
  principal e widget do mural — incluindo render estrutural dos dois widgets)
- `node scripts/audited-store.mjs` → **62/62** (ações do store: dia fechado, reabrir, pomodoro, metas,
  fechar o dia, dia vindo de backup antigo)
- `node scripts/render-charts-smoke.mjs` → **42/42** (21 gráficos + tela, com dado e sem dado)
- `node scripts/render-screens-smoke.mjs` → **63/63** (21 telas × 3 cenários: com histórico, primeiro uso
  e **dados corrompidos** — `null`/`NaN`/texto de backup antigo)
- `npx expo export --platform web` → bundle OK; preview respondendo 200
- `npx expo prebuild -p android` → `Prime.java` + `Constancia.java`,
  `widgetprovider_prime.xml` + `widgetprovider_constancia.xml`, dois `<receiver>` no manifest
- `npx expo config` → plugins aplicados (splash, notifications, image-picker, widget)
