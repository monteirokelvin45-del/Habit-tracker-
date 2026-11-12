# Auditoria — MY PRIME vs. briefing

Verificação item por item do que foi pedido contra o que existe no repositório.
Legenda: ✅ feito e verificado · 🟡 feito com desvio justificado · ❌ não feito (motivo).

**Versão auditada: 1.6.1 (`versionCode` 11).** Suítes desta rodada: **734** de lógica, **62** de store,
**42** de render e **166** de tela — todas verdes; `tsc` limpo com e sem `--noUnusedLocals`.

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

### Defeito 8 — o CI publicava APK sem testar render nem telas

O passo "Checagem rápida" do workflow rodava `tsc` + lógica + store. `test:render` e `test:screens`
(que é onde os crashes de tela aparecem) ficavam só na máquina: uma tela quebrada virava APK assinado.

Agora o CI roda os quatro, e depois do prebuild:

1. compara `versionName`/`versionCode` do `android/app/build.gradle` com `app.json`;
2. abre o APK com `aapt2 dump badging` e **falha o build** se a versão dentro do arquivo não é a da config;
3. grava versão verificada + `sha256` no sumário do run (o log do runner não é acessível do sandbox);

E a release passou a publicar dois nomes: `my-prime-latest.apk` (link estável) e
`my-prime-v<versão>-<commit>.apk` (build identificado) — o nome fixo sozinho fazia duas builds
diferentes parecerem o mesmo arquivo.

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

## Finanças — Bento Grid "Dark Neon Blue"

Redesenho do módulo financeiro inspirado no dashboard de referência enviado, adaptado ao que o app
**é** (React Native, não web) e ao que o app **sabe** (dado local, sem número de exemplo).

### O que mudou na cara

| Referência (web) | No app (React Native) |
|---|---|
| Tailwind + Lucide | estilos inline + `react-native-svg` (já era dependência; **nenhuma lib nova**) |
| `bg-[#08090E]` | tema `neonBlue` (`bgPrimary #08090E`, `bgCard #121522`, acento `#3B82F6`/`#2563EB`) |
| `rounded-3xl` | `borderRadius: 24` |
| `drop-shadow-[0_0_15px_...]` | `shadowColor/Opacity/Radius` + halo em camadas (`<Glow>`) |
| gradiente do cartão | `<Svg><LinearGradient>` por baixo do conteúdo |

Tema novo entra no seletor do Perfil automaticamente (`Object.keys(THEMES)`), e `bgSubtle`/`bgInput`
são os "poços" (dia do calendário, barra vazia, pílula de busca).

### Componentes criados (`src/components/BentoFinance.tsx`)

`Bento` (card com borda fina + sombra), `Glow` (halo), `ThinBar`, `BalanceCard` (gradiente neon, cartão
mascarado **decorativo** — o app não guarda dado de cartão), `BalanceRings` (anéis concêntricos),
`WeekStrip` (seletor semanal com ponto = dia com lançamento), `IncomeOutcomeChart` (multi-linha com
tooltip ao toque), `IncomeBars` (12 barras finas com destaque), `ActivityRow`.

### Adaptações obrigatórias (não são enfeite)

1. **Nada de valor inventado.** A referência mostra `$5,226.99`, `+22%`, `R$ 3.420`, `25 Unread Messages`.
   Nada disso entra: saldo do mês vem dos lançamentos; sem lançamento → "Sem dado". A variação
   percentual só aparece com os dois meses preenchidos. Não existe "inbox" no app — o card virou
   **Impulso (7 dias)**, que é dado real.
2. **Mês sem dado não é zero.** `null` quebra a linha do gráfico e deixa a barra oca; zero seria mentira.
3. **`formatBRL` sem ICU.** `toLocaleString('pt-BR')` cai para en-US em Hermes/Android e imprime
   `R$ 1,234.50`. Formatação manual, testada: `1234.5 → R$ 1.234,50`.

### Defeitos que o redesenho expôs (e foram corrigidos)

- **`applyTheme` deixava lixo**: `Object.assign` não remove chaves ausentes, então o `neon` do tema novo
  sobrevivia ao voltar para o Emerald (o Emerald ficava com acento azul). Agora limpa antes de aplicar.
- **`variant="micro"` forçava CAIXA ALTA** em todo texto pequeno: mês saía "OUT", dia saía "QUI", e
  `5000` virava `8900`… não — a sigla virava palavra errada. `Txt` ganhou `upper={false}` para rótulo
  que é conteúdo, e a tela parou de chamar `.toUpperCase()` no dia da semana.
- **Contraste**: branco sobre `#3B82F6` dá 3.68:1 (reprova AA). Texto da pílula neon agora é `#08090E`
  sobre o azul → 5.41:1.
- **Veredito do dia de pagamento** imprimia `R$ 1240` cru (sem milhar). Passou a usar `formatBRL`.

### Segunda passada: fidelidade à referência enviada

A primeira versão ficou "azul e escura", mas comparando lado a lado com a imagem de referência faltavam
quatro coisas concretas — todas corrigidas:

| Referência | Antes | Agora |
|---|---|---|
| Anéis finos e bem separados, com "rabo" de cometa e centro vazio | 3 anéis grossos, legenda embaixo | 3 anéis de 3.5px com halo (`opacity 0.13`), raio 17px entre eles, centro com `%` da renda e legenda ao lado |
| Cartão de crédito: valor em cima (gradiente) e faixa escura embaixo com `•••• 1209` | um bloco só, número decorativo `0000` | metade gradiente + faixa escura com chip, máscara e botões |
| Barras finas de alturas bem diferentes | barras de 10px | 7px, mês vazio vira traço de 2px no chão |
| Busca no rodapé | busca no topo | rodapé, como na referência |

E uma decisão de produto: o número do cartão virou **dado real opcional**. `Settings.cardLast4` guarda
**só 4 dígitos**, no próprio aparelho; a tela tem sheet para informar/trocar/apagar e botão de
compartilhar. Nada de número completo, validade ou CVV — nem no tipo, nem no storage (o sanitizador
descarta qualquer coisa que não seja exatamente 4 dígitos: `'12'`, `'12ab'`, 16 dígitos e `1209` numérico
são recusados, não truncados).

O que ficou de fora da referência, e por quê: **Inbox/"25 Unread Messages"** (não existe inbox no app),
**Followers/22°/John Doe/modo Dark** (não são finanças) e os **números de exemplo** (`$5,226.99`, `+22%`).

### Verificação

- 503 lógica (tema, contraste, `formatBRL`, 4 dígitos do cartão, config), 62 store, 42 renders, **94 telas**
  (21 telas × 4 cenários: histórico, primeiro uso, tema neon e dado corrompido, + 7 checagens
  específicas de Finanças: vazio não inventa valor, Real formatado, sem receita → "sem renda
  registrada", valor ilegível avisado e não somado).
- Preview fiel em `docs/design/financas-preview.html` (`PREVIEW_FINANCES=1 npm run test:screens`):
  é o DOM do react-native-web com os estilos reais, para conferir a composição sem emulador.

## Treino — "FITPULSE" (Bento, preto + verde lima)

O módulo de Treino virou um dashboard de fitness na referência FITPULSE. Entrou o tema
**`fitPulse`** ("FITPULSE Dark Lime", em Perfil → Aparência) com o verde lima `#A3E635`, e as
peças ficam em `src/components/FitPulse.tsx`. Como a Home, este módulo **segue o tema ativo**.

### Mapeamento referência → dado real

| Referência | No app |
|---|---|
| Total Workouts 128 (+12%) | sessões registradas em 28 dias + minutos da última (`sessionMinutes`) |
| Calories 12,450 kcal | **não existe**: o app não calcula gasto calórico. Calorias só aparecem se a pessoa digitar (relógio/esteira), e sempre marcadas "(informado)" |
| Streak 18 dias (Best 24) | `trainingStreak` real: hoje sem treino não zera a sequência, e o recorde vem do histórico |
| Active Minutes 845 min | soma do cronômetro das sessões (28 d), com "Sem dado" quando não há sessão |
| Volume semanal (Strength × Cardio) | barras de carga × reps e minutos de cardio; **dia sem treino é coluna oca (`null`)** |
| 78% Goal Reached | sessões da semana ÷ meta (3/4/5x, escolhida na hora) |
| Start Workout | botão liga o cronômetro real; marcar a última série dispara o descanso prescrito do exercício (45–120 s) |
| Today's Workout (Leg Day) | nome, séries, reps e carga **digitados por sessão** — o template antigo vinha com 30 kg fixos, que parecia dado do usuário |
| Ilustração de músculos | `MuscleMap` acende só os grupos reconhecidos nos exercícios; grupo desconhecido apaga, não chuta |
| Water 1.8L/3L | copos de 250 ml reais do diário (mesmo contador da Dieta) |
| Nutrição (proteína/carbo/gordura) | soma dos gramas **escritos** nas refeições ("120g proteína"); sem gramas no texto, diz "—". Não há meta de macro cadastrada, então não há barra contra alvo inventado |
| Body Stats (78kg/42%/16%/22.4) | peso e IMC reais; **gordura e massa muscular ficam "—"** porque o app não mede composição corporal. IMC exige altura cadastrada (novo campo em Settings) |
| PRs (Squat +5kg…) | `personalRecords` sobre o histórico: primeira sessão é `delta: null` (sem "+5kg") |
| Sono 7h32 + gráfico | horas e qualidade do diário de sono; sem registro, "—" |
| Recent Workouts (com foto) | capas **desenhadas** (`WorkoutCover`): foto de banco de imagens não é registro do usuário |

### Dois defeitos encontrados pelos testes nesta rodada

1. **Reabrir a tela de Treino perdia as séries já marcadas** — só o cronômetro voltava, porque a
   sessão salva era ignorada no estado inicial. Agora o `useState` hidrata da sessão do dia (e
   `toSession` normaliza backup antigo: `sets` ausente não derruba a tela).
2. **Cardio não contava como sessão** — `isRecorded` exigia série feita, o que apagava todo treino
   de cardio. Agora conta série feita **ou** minutos de cardio.

### Verificação

- 21 checagens novas de treino: sequência (hoje sem treino não zera), PR sem delta na 1ª sessão,
  volume reps×carga, dia sem treino `null`, cardio separado de força, minutos pelo cronômetro,
  grupos musculares (e `null` quando não reconhece), IMC com e sem altura, macro somando gramas,
  volume 1160 kg de 10×60+8×70, e nenhum número da vitrine (128, 12.450, 78%, 22,4).
- Tema `fitPulse`: fundo `#0D0E12`, card `#13151A`, contraste medido — **branco sobre o lima dá
  1.6:1**, por isso `onNeon` é escuro.
- **166 telas** (21 × 4 cenários + Estudos + Finanças + Home + Treino + Copilot + auditoria de número),
  **734 lógica**, 62 store, 42 renders. Preview: `docs/design/treino-preview.html`
  (`PREVIEW_TREINO=1 npm run test:screens`).

## Home — "Soft Light Glass" (Management / Coders)

A Tela Principal foi redesenhada na referência clara e translúcida. Diferente de Estudos
(paleta fixa própria), a Home **segue o tema ativo** — e para isso entrou o tema
**`softGlass`** ("Soft Light Glass", em Perfil → Aparência). Os outros temas continuam
funcionando: a Home lê `useTheme()`, só a composição é nova (`src/components/SoftHome.tsx`).

### Mapeamento referência → dado real

| Referência | No app |
|---|---|
| Header com pílulas (＋, busca, sino, avatar) | ＋ abre as ações rápidas; ⌕ filtra metas/registros do dia; ◔ leva aos alertas reais; avatar abre o Perfil |
| Filtros Dia/Semana/Mês/Ano | filtram a janela do gráfico e a média de conclusão (1, 7, 30, 365 dias) |
| Timeline 9 AM → 6 PM com blocos | blocos **sugeridos** por área (mesmo `buildSchedule` do cronograma), 05h–23h, status real feito/aberto |
| "Ongoing Habits 68.5%" + micro-gráfico | conclusão real: feitas ÷ checklist do dia, com tendência de 7 dias (linha quebra em dia sem registro) |
| "File Preview" (card preto) | **próxima pendência real** do checklist (prioridade alta primeiro), com anel da área, mínimo e streak. Sem pendência, o card diz o que fazer |
| "All Files" (registros do dia) | os 6 campos do diário que a pessoa escreveu (prometido/feito/evitado/travado/correção/vitória) |
| "Team" (card preto inferior) | progresso por área do dia, com barra, meta em destaque e streak por área + anel da média do mês |

### Duas decisões que mudaram o design system

1. **`black` deixou de ser "preto"** — ele é a cor de texto *sobre* o acento, e num tema
   claro isso precisa ser branco. O tema `softGlass` define `black: '#FFFFFF'` e
   `onAccent()` já era o caminho correto: `PrimaryButton` passou a usá-lo (antes era
   `colors.black` fixo, que apagaria o rótulo em fundo claro).
2. **Status bar segue o tema**: `app/_layout.tsx` escolhe `dark`/`light` pela luminância do
   fundo. Sem isso, no tema claro o relógio do sistema sumia no fundo branco.

### O que ficou de fora (e por quê)

Sidebar de navegação, busca global com atalho de teclado, painel de notificações e o
gráfico "Sales Volume" (que na referência é de vendas). Os números da referência — 68.5%,
43 tarefas, 28 projetos, 120%, "Anm Kowalski" — não existem em lugar nenhum da tela.

### Verificação

- Tema: fundo `#EBECEC`, card `rgba(255,255,255,0.80)`, contraste de texto ≥ 4.5:1 medido,
  `onAccent()` branco, e volta para Emerald sem sobra de campo opcional.
- Home: 9 checagens (vazio não afirma percentual, 2/3 feitas → 66%, nenhum número da
  referência, painel de áreas, timeline, sem NaN, sem texto preto sobre botão escuro).
- **116 telas** (21 × 4 cenários + 11 de Estudos + 7 de Finanças + 9 de Home), 513 lógica,
  62 store, 42 renders. Preview: `docs/design/home-preview.html` (`PREVIEW_HOME=1 npm run test:screens`).

## Estudos — "iDraft Soft UI" (monocromático)

Segundo redesenho por referência. Diferente de Finanças, este módulo ganhou **paleta própria e fixa**
(cinza fumê `#F3F4F6`, branco, grafite `#141416`) — ele **não segue** o tema ativo, e o teste de tema
sabe disso. Componentes em `src/components/SoftStudy.tsx`: `SoftCard` (branco/preto/tracejado),
`SoftButton` (pílula), `SoftRing`, `SoftWeekLine` (linha suavizada Catmull-Rom), `SoftCheck`,
`SoftNote` (post-it com menu ⋯) e `SoftStat`.

### Mapeamento referência → dado real

| Referência | No app |
|---|---|
| "Overall Information" (43 tarefas, 28 projetos…) | horas estudadas hoje, tópicos do edital, dias com estudo em 7d, pomodoro, revisados |
| Progresso semanal (linha suave) | minutos por dia, segunda→domingo, do `diary.study` — **dia futuro/sem registro é `null`** (a linha quebra) |
| Meta mensal 120% + "Baixar Relatório" | horas do mês ÷ meta derivada do "ideal" das metas de Estudo; o botão gera o **PDF real** (`exportPdf`) |
| Metas do mês (Ler 2 livros…) | metas reais da área **Estudo** com `toggleTask` (bloqueado se o dia está fechado) |
| Post-its "Em andamento" | os **blocos de estudo**; ⋯ abre Fixar / Editar / Excluir (excluir desabilitado no último) |
| "+ Adicionar tarefa" tracejado | cria bloco e abre o cadastro |
| Cursos ativos com anel | minutos por matéria (14 dias) com anel proporcional ao topo |

### Regra 4 é o ponto sensível aqui

"Desempenho" era o card que a referência mostra como número sempre presente. No app ele **só aparece
com ≥ 3 dias com estudo e minutos previstos**; com 2 dias a tela escreve: *"Sem dado suficiente: precisa
de 3+ dias com estudo… Não vou afirmar desempenho com 2 dia(s)."* Há teste para os dois lados (2 dias e
5 dias). A meta mensal sem alvo cadastrado diz "Sem meta", nunca 0%.

### O que ficou de fora

Sidebar de navegação, "Hi, Dilan!", busca global e notificações do topo (o app tem abas), e os números
da referência. O card de clima/perfil/"Priorities" não são estudos.

### Verificação

- 11 checagens novas de tela só para Estudos: vazio não afirma desempenho, sem NaN, 2 dias → "Sem dado
  suficiente", 5 dias → 100% real, meta sem alvo ≠ 0%, checklist só com metas da área Estudo.
- 105 telas (21 × 4 cenários + 7 de Finanças + 11 de Estudos), 503 lógica, 62 store, 42 renders.
- Preview fiel: `docs/design/estudo-preview.html` (`PREVIEW_ESTUDO=1 npm run test:screens`).

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

- `npm run test:store` — **62 asserções de ação** (dia fechado, reabrir, pomodoro, metas, fechar o dia,
  dado antigo). Compila o store real com stub de persistência; é o teste que pega estado errado.
- `npm run test:logic` — **622 asserções** (inclui as do diário de emoções, as de boot hostil, as de
  contraste dos 7 temas e as da varredura de dados degradados).
- `npm run test:store` — **62 asserções de ação** (dia fechado, reabrir, pomodoro, metas, fechar o dia,
  dado antigo). Compila o store real com stub de persistência; é o teste que pega estado errado.
- `npm run test:render` — **42 montagens** dos gráficos com e sem dado.
- `npm run test:screens` — **154 montagens de tela** com store trocado por cenário, mais as telas que
  ficavam fora da lista (`importar`, `onboarding`, splash), agora descobertas no disco: pega crash em
  runtime, tela vazia e `NaN`/`undefined` visível.

## Auditoria v1.6.1 — todos os dashboards, número por número

Método desta rodada: **ler o que a tela afirma**, não só se ela abre. Os 166 renders passavam com
números errados, porque número errado não quebra o HTML. Então:

1. `DUMP_DASH=1 npm run test:screens` imprime o texto **visível** de cada dashboard (cheio e vazio);
2. cada número do dump foi cruzado com o dado que o alimenta;
3. achado o defeito, a correção veio com uma asserção que **falharia** antes dela.

| # | Defeito | O que a tela afirmava | Correção |
|---|---|---|---|
| 42 | Duas réguas de "dia cumprido" | Home/Constância usavam `score ≥ 6`; Recorde e sequência em Gráficos/Revisões usavam `> 5` — **a mesma base dava "recorde 5d" numa tela e "recorde 8" noutra** | `DAY_FULFILLED_SCORE` + `isFulfilledDay()` em `score.ts`; todos os dashboards importam |
| 43 | Média de 7 dias por posição no array | `slice(-7)` pegava os 7 últimos **registros**: com 6 dias fechados em julho, a "média 7d" de novembro mostrava 9,7 | `scoreSummary(days, end)` filtra por data; Home usa |
| 44 | Foco médio idem | "média 25min" era média dos 7 últimos registros de pomodoro, possivelmente de outro mês | `averageFocusMinutes(days, window, end)` por data |
| 45 | Minutos por matéria no Estudo | `slice(-14)` em 14 **registros**, não 14 dias | janela por data + bloco inválido ignorado |
| 46 | Dia sem registro contado como "pulado" | gráfico empilhado afirmava dezenas de "pulos" onde havia **ausência de dado**; a legenda ainda dizia "pulado (sem registro de falha)" | `noData` no `StackDay` + legenda "dia sem registro" |
| 47 | `waffle` com dias futuros | `lastNDays(100)` inclui datas futuras; a lenda dizia "o resto sem registro", mas o futuro era desenhado como falta | legenda separa futuro de sem registro |
| 48 | Cartão "Renda {ano}" somava despesa | receita 1.000 com despesa 400 aparecia como **1.400** | `incomeOf`/`expenseOf` em `lib/finance.ts` (testados); o card usa só receita |
| 49 | Leitura inventava livro | fallback criava `totalPages: 350` — "pág. 0 de 350" e **0%** para quem nunca cadastrou livro | usa o livro real da biblioteca; sem total, "total não informado" |
| 50 | `bookPercent` devolvia 0 | livro sem total de páginas aparecia como **0% lido** (afirmação falsa) | devolve `null` → "Sem dado" |
| 51 | Água fixa em 8 copos na Dieta e no Treino | o Copilot se recusava a chutar a meta, mas **Dieta dizia 3/8 e Treino "meta de 8"** | `waterGoalCups(settings)` único; sem meta declarada: "meta não definida" |
| 52 | Correlação de sono com sinal perdido | frase fixa "score **cai** X pts" com `Math.abs` — quando dormir pouco rendia mais, a tela dizia o contrário | direção pelo sinal; `diff` 0 tem frase própria |
| 53 | "Média 14 noites" com 3 noites | rótulo fixo | rótulo com a contagem real |
| 54 | Projeção do mês sem ritmo | "Projeção de fechamento: **0/30**" num mês sem nenhum dia na meta (resultado que ainda não aconteceu) | `projection: null` → "Sem projeção: nenhum dia na meta ainda" |
| 55 | "Áreas que caem juntas" com n=2 | "quando Treino falha, Leitura falha **100% das vezes**" com 2 dias — coincidência vendida como padrão | `MIN_SAMPLES_FOR_CORRELATION = 4` + aviso de amostra pequena (n < 7) |
| 56 | "21 gráficos ›" | a Central de gráficos tem **19** | contagem corrigida (e o teste de cobertura impede a volta) |
| 57 | Semana dizia "0/7 dias" | dias futuros da semana atual contavam como não encerrados | rótulo `N/7` só com dias já passados; futuro explícito |

### Como isso passa a ser vigiado

- **7 blocos de asserção** novos no `test:screens` (Janela, Água, Dieta sem/com meta, semana) e **11 blocos** no
  `test:logic` cobrindo cada linha da tabela. Todos comparam **valor esperado × valor exibido**, não só
  "não quebrou".
- **`DUMP_DASH`** fica no repositório: é a ferramenta que permite ler os 166 renders. `DUMP_DASH=Dieta`
  imprime só a Dieta, em app cheio e vazio.
- A régua de "dia cumprido" e a fonte da meta de água têm nome e teste de **igualdade entre telas** — as
  duas classes de erro que mais apareceram aqui (mesma palavra, número diferente; mesmo número, regra
  diferente) agora falham o build.

## AI Copilot / LIX AI — a tela central de assistência

Tela nova (`app/(tabs)/copilot.tsx`), acessível pela barra de abas e pelo botão ✦ da Home.
Desenho tirado da referência: coluna de navegação à esquerda, orbe no topo, saudação → título →
subtítulo, caixa de entrada com Importar arquivo / Ferramentas / enviar, e três cards de ação rápida.

### O que o assistente faz — e onde ele termina

| Capacidade pedida | Como está implementado | Limite declarado na própria tela |
|---|---|---|
| Ler texto bruto e extrair hábitos, horários e metas | `parseRoutine` + `parseHour`/`parseMinutes` (`lib/copilot.ts`) | item **sem horário não é agendado**: aparece em "sem horário, não dá para colocar na timeline" |
| Agendar na timeline do dia | horário entra como `scheduleOverrides` (ajuste de sugestão) | a timeline nunca é apresentada como registro de execução |
| Sugestões diárias por desempenho/streak | `dailySuggestions` + `areaStreaks` (sequência **por área**, a partir das tarefas) | sem histórico suficiente a sugestão é "fechar o dia", não um elogio |
| Ficha de treino (séries, reps, carga) | `buildWorkout` com biblioteca de exercícios + carga da última sessão | sem histórico a carga fica `null` e a tela escreve "carga a definir" |
| Metas de água, calorias e macros | `waterCupsFor`/`macroSplit` leem o que a pessoa **declarou** no Perfil | sem declaração: `null` → pergunta o dado. **Kcal nunca é calculada** |
| Cronograma de estudo por matéria | `buildStudyPlan` + leitura do edital (`topicsPerDayNeeded`, `nextTopic`) | sem data de prova, pede a data em vez de calcular tópicos/dia |
| Categorizar gastos e recomendar economia | `buildFinancePlan` + `categorize` (categorias reais do app) | item sem valor fica `null` e é perguntado; nada é lançado sem número |
| Upload de arquivo → dados | botão "Importar arquivo" leva ao `importar.tsx` existente (JSON/plano/backup) | PDF continua não sendo lido — o app diz isso em vez de fingir extração |
| Conversa e comandos rápidos | `respond()` roteia por módulo (rotina, treino, estudo, finanças, dieta, resumo) | respostas usam só `AppData` + o texto colado |

### Decisões de honestidade (as que dão trabalho)

1. **Nada sai do aparelho.** Não existe API de IA no app e o motor é 100% local. Mandar os registros da
   pessoa para um servidor sem ela pedir seria o oposto da promessa do MY PRIME — então o "copilot" é
   um motor de regras + parser, e a tela diz "Roda no aparelho · seus dados não saem daqui".
2. **Plano ≠ registro.** O assistente monta o plano e ele aparece em cartão com botão **Aplicar**. Só
   depois a pessoa confirma é que `applyCopilot` chama as ações do store (que já barram dia fechado).
3. **Quando falta dado, ele pergunta.** `gaps` é parte do contrato da resposta: sem meta de água, sem
   macros, sem data de prova, sem exercício com histórico — cada um vira uma pergunta em âmbar na tela.
4. **Meta de água declarada pelo plano é anunciada.** Se a pessoa aplica "8 copos" e ainda não tinha meta,
   o app grava a meta **e avisa** ("você declarou; ajuste no Perfil"), em vez de mudar configuração em silêncio.
5. **Nada da vitrine entra.** Um teste varre as respostas e reprova `Hendricks`, `Dilan`, `12.450`, `78%`,
   `22.4`, `5kg`.

### Verificação

- **63 asserções novas** do Copilot: horário em 5 formatos (+ `null` quando não há e hora inválida 25h),
  duração ("30 min", "1h30", "45 minutos"), roteamento de módulo, área, rotina com e sem horário, streak
  por área (3 vs 1), ficha com e sem histórico (carga `null` vs 62 kg da sessão), finanças (categoriza
  mercado/uber, item sem valor perguntado), estudo sem data de prova, recusas do "Aplicar" (meta
  duplicada, dia fechado, gasto sem valor), limite de 40 copos e não-vazamento da vitrine.
- **Contraste medido da identidade própria**: `Lix.tsx` é lido pelo teste, e 6 pares são medidos —
  `ink` 17:1, `body` 11:1, `muted` 6,1:1 e `accent` 8,6:1 sobre o card sólido `#111926`; `faint` (rodapé)
  3,5:1; branco sobre o fundo 18:1. O card começou como `rgba(...)` e foi trocado por cor sólida porque
  alfa compõe com a luz ambiente e o contraste deixa de ser previsível.
- **Tema novo `copilot`** ("LIX Ambient") em Perfil → Aparência: os 7 temas anteriores não mudaram de
  valor, e o teste de contraste dos temas passa nos 8.
- Preview: `docs/design/copilot-preview.html` (`PREVIEW_COPILOT=1 npm run test:screens`).

## Auditoria v1.5.1 — dado degradado, boot e acessibilidade

Segunda varredura, feita com o app já em 1.5.0. Método igual: primeiro o defeito é **reproduzido**
(test falhando ou boot quebrando de verdade), depois corrigido, depois guardado por teste.

| # | Defeito encontrado | Efeito real | Correção |
|---|---|---|---|
| 30 | `loadAll` devolvia o backup **cru** (só os dias passavam por limpeza) | backup antigo com `settings.middayTime` numérico quebrava a Home; meta sem `active` derrubava o badge | `normalize.ts` novo + `loadAll` devolve `normalizeData(...)` (usuário, settings, metas, emoções, badges, diário) |
| 31 | `sanitizeDay(null)` estourava | um `null` na lista de dias impedia o app de chegar em `ready` (tela em branco no boot) | `null` vira dia vazio de hoje |
| 32 | Cronômetro do Treino sem proteção | `formatClock(NaN)` e `elapsed` com texto mostravam `NaN:NaN` na tela | `Number.isFinite` em ambos; `elapsed` nunca negativo |
| 33 | `sessionVolume`/`topWeight`/`loadSeries` liam `session.exercises.map` direto | sessão de backup antigo sem `exercises` **derrubava** a tela de Treino | `exercisesOf()` tolerante, usado por todas as contas de treino |
| 34 | Água somava a partir do valor da renderização | dois toques rápidos em "+1 copo" contavam como um (Dieta e Treino) | o toque lê o valor atual de `useStore.getState()` |
| 35 | Busca da Home era texto decorativo | digitar não filtrava nada e não havia como limpar | `TextInput` real, filtra metas e diário, botão de limpar |
| 36 | Tarefa sem `text` no diário | `.trim()` em número vindo de backup antigo derrubava o card de registros | `String(...)` na leitura dos campos do diário |
| 37 | `Sheet` de água morto no Treino | estado `waterOpen` sem nenhum caminho que o abrisse (código morto) | removido |
| 38 | Import duplicado no splash | `themeColors` e `colors` para a mesma coisa | usa só `colors` |
| 39 | Categorias de Finanças com chave repetida | aviso de "unique key" do React e item instável na lista | `.filter(Boolean)` na lista |
| 40 | Escala do heatmap no tema claro | tom baixo era quase igual ao card branco: dia sem registro sumia | escala do `softGlass` refeita; teste mede o degrau |
| 41 | 3 telas fora de qualquer teste (`importar`, `onboarding`, splash) | quebra passaria batido | o smoke **descobre** as telas no disco em vez de usar lista manual |

### O erro que mais importava: normalização apagando registro

A normalização criada no item 30 reconstruía cada tarefa do zero (`goalId`, `done`, `note`, `doneAt`).
Isso **apagava em silêncio** o motivo da falha (`excuse`), o `cost` e o `recoveryPlan` — exatamente a
cobrança que o app faz questão de guardar — além de `failAt`, `honestyFlags`, `scheduleOverrides`,
`closedAt`, `middayCheckin` e `pomodoros`. Um happy path de teste não pegaria isso: só um teste que
monta um dia completo e compara campo por campo. Agora existe (9 asserções) e a tarefa preserva o resto
com `...t` antes de aplicar o crivo.

### Acessibilidade medida, não suposta

Teste novo percorre os **7 temas** e mede contraste WCAG do par que a pessoa realmente lê:

- texto principal sobre o fundo e sobre o card (translúcido é achatado sobre o fundo antes de medir);
- texto secundário sobre o card;
- texto do botão primário sobre a cor em que ele é pintado (`colors.green` + `onAccent()`), não sobre um
  acento genérico — medir o par errado dava número bonito e falso;
- degrau do heatmap (o tom do meio tem de ser visível sobre o card).

Todos passam com ≥ 4,5:1 (texto) e ≥ 1,35:1 (degrau do heatmap).

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

- `npx tsc --noEmit` → limpo (e com `--noUnusedLocals --noUnusedParameters`)
- `node scripts/run-logic-tests.mjs` → **734/734** (modos, score, streaks, cobrança, gate de 7 dias,
  zona de perigo, recompensas, badges, parser, importador, mural de constância, gráficos, widget
  principal e widget do mural — incluindo render estrutural dos dois widgets)
- `node scripts/audited-store.mjs` → **62/62** (ações do store: dia fechado, reabrir, pomodoro, metas,
  fechar o dia, dia vindo de backup antigo)
- `node scripts/render-charts-smoke.mjs` → **42/42** (21 gráficos + tela, com dado e sem dado)
- `node scripts/render-screens-smoke.mjs` → **166/166** (telas × cenários: com histórico, primeiro uso,
  tema alternativo e **dados corrompidos** — `null`/`NaN`/texto de backup antigo, passando pelo boot real
  do store) + 3 telas descobertas no disco
- `npx expo export --platform web` → bundle OK; preview respondendo 200
- `npx expo prebuild -p android` → `Prime.java` + `Constancia.java`,
  `widgetprovider_prime.xml` + `widgetprovider_constancia.xml`, dois `<receiver>` no manifest
- `npx expo config` → plugins aplicados (splash, notifications, image-picker, widget)
