# ASTRA Health — módulos FUTURE (prévia da plataforma)

> 🇺🇸 [English version](README.md) · 🧪 [Relatório de testes](TEST_REPORT.pt-BR.md)

O MVP submetido demonstra **MEDIR → ENTENDER → AGIR → COMUNICAR** com três cenários testados. Os módulos FUTURE mostram como o ASTRA Health pode evoluir para um **sistema autônomo de apoio à decisão em saúde espacial** que é:

- **offline-first** — todo módulo roda com dados locais e guarda seus registros no dispositivo; relatórios para a Terra aguardam numa fila;
- **baseado em evidências** — o contexto científico vem apenas de fontes oficiais do NASA Human Research Program armazenadas a bordo;
- **com humano no circuito** — regras e protocolos *propõem*; o oficial médico da tripulação ou o comandante *decide*;
- **rastreável** — toda decisão, evidência exibida e ação é gravada numa trilha de auditoria encadeada por checksum.

No app, abra **Platform preview** no menu (`/future`).

> ⚠️ **Conteúdo demonstrativo.** Todos os conjuntos de regras, checklists e protocolos abaixo foram escritos pela Equipe ANGARIS para o protótipo, estão marcados como **PROVISIONAL**, **não** são procedimentos da NASA e **não** são clinicamente validados. Todos os dados de tripulação são simulados (seed de demonstração) ou digitados durante a demo. Nada nomeia doença, medicamento ou tratamento.

---

## Limites com a demonstração testada

| | Demo testada (submissão) | Módulos FUTURE |
|---|---|---|
| Rotas | `/`, `/analysis`, `/response`, `/comms`, `/science` | `/future`, `/future/journal`, `/future/assess`, `/future/profile`, `/future/eva`, `/future/readiness` |
| Estado | `src/lib/mission` + `MissionProvider` (relógio de simulação em segundos) | `src/features/*` + `FutureProvider` (relógio por dia de missão, reducer próprio) |
| Armazenamento | nenhum (memória) | `localStorage` no dispositivo, uma chave versionada por módulo |
| Ligação entre eles | — | o FUTURE 03 **lê** os últimos sinais vitais simulados do Tripulante A; nada é escrito de volta |

A única mudança no código testado é uma entrada extra no menu ("Platform preview") e uma pasta `--out` opcional no teste de navegador dos cenários. Os 77 testes originais e as 14 verificações de navegador dos cenários são executados novamente a cada mudança ([seção de regressão do relatório](TEST_REPORT.pt-BR.md#regressão-da-demonstração-testada)).

A versão congelada da submissão é o commit `4381231` (tag local `v1.0.0-spaceapps`).

---

## Arquitetura

```
src/features/
├── platform/            núcleo compartilhado
│   ├── types.ts         MissionTime, AuditEntry, OutboxItem, ModuleResult
│   ├── time.ts          relógio por dia de missão (dia + minuto)
│   ├── checksum.ts      checksum determinístico de 64 bits, JSON estável
│   ├── audit.ts         trilha de auditoria somente-acréscimo, encadeada por checksum + verificação
│   ├── earth-link.ts    fila store-and-forward: ordem de prioridade, atraso, confirmação
│   ├── references.ts    riscos NASA HRR (trechos verificados / somente referência)
│   ├── store.ts         um reducer puro: encaminha ações aos módulos, acrescenta auditoria + fila, sincroniza o link
│   ├── storage.ts       persistência versionada no dispositivo, com validação e retorno ao seed
│   └── FutureProvider.tsx
├── journal/   F01       config (tripulação, sintomas, rotinas, regras) · logic (rotinas, alertas, tendências) · reducer
├── assess/    F02       engine (regras, evidências, incerteza) · reducer (revisão, relatório)
├── profile/   F03       config (9 domínios, 28 métricas) · logic (perfil, registros)
├── eva/       F04       logic (checklists, proposta GO/HOLD, alternativas) · reducer (planejar → decidir → eventos → encerrar)
└── readiness/ F05       prontidão da tripulação · verificação do sistema · registro de conjuntos de regras
```

Cada reducer de módulo é puro e devolve `{ state, audit[], outbox[] }`. O store da plataforma carimba cada entrada de auditoria com a hora da missão e o checksum da entrada anterior, transforma rascunhos em itens na fila e sincroniza a fila com o link simulado com a Terra (3–22 min por sentido, a mesma faixa do módulo Earth Link testado).

---

## F01 · Diário de saúde e check diário (`/future/journal`)

- Check-in diário por tripulante: horas de sono, qualidade do sono, humor, fadiga, hidratação percebida (escalas 1–5 com o significado exibido), ingestão de líquidos opcional, sintomas autorrelatados, notas. Um check-in por dia (um novo substitui o de hoje).
- Rotinas (cronograma demonstrativo): check-in diário, massa corporal e pressão arterial a cada 7 dias, autoavaliação de acuidade visual a cada 14 dias — atrasada / para hoje / próxima / feita hoje. Concluir uma rotina só registra que a tarefa foi feita; os valores vão para o F03.
- Tendências de 14 dias por métrica, com lacunas visíveis nos dias sem registro; histórico completo; visão da tripulação.
- Alertas de atenção de **ASTRA-JOURNAL@0.1.0-demo**: sono curto (< 6 h, 3 dias), fadiga alta (≥ 4, 3 dias), humor baixo (≤ 2, 3 dias), hidratação percebida baixa (≤ 2, 2 dias), sintoma relatado (últimos 2 dias), check-in ausente (últimos 3 dias). Sequências só contam se terminam hoje ou ontem. Os alertas sugerem um acompanhamento humano; não são diagnóstico.
- Um resumo do diário pode ser enviado à fila para a Terra (prioridade rotina).

## F02 · Avaliação de sintomas e motor de evidências (`/future/assess`)

- Perguntas estruturadas: sintoma principal, intensidade segundo o próprio tripulante, início, evolução, duração, capacidade de cumprir as tarefas, sinais de alerta presentes agora (lista demonstrativa usada só para sugerir contato imediato com o suporte médico).
- **Saída operacional apenas do conjunto de regras versionado** `ASTRA-SYM@0.1.0-demo` (`src/data/future/symptom-ruleset.json`): nível de atenção (Monitorar → Informar o oficial médico → Suporte médico recomendado → Suporte médico agora), próximos passos ordenados, prioridade do relatório. As regras são JSON declarativo para poderem ser revisadas, comparadas e versionadas.
- **Evidências**: fatos do diário (quantas vezes o sintoma foi relatado, check-in de hoje) e riscos oficiais NASA HRR associados ao sintoma. *Trechos verificados* são citados palavra por palavra da biblioteca de evidências de Science & Limits; entradas *somente referência* mostram apenas título e link oficiais.
- **A incerteza é sempre declarada** (respostas faltando, sem check-in hoje, sem referência específica para o sintoma, evidência somente-referência) e nunca é "baixa", porque as regras não são validadas.
- **Humano no circuito**: o oficial médico aceita ou sobrepõe a proposta (sobrepor exige nota). O relatório para a Terra é enfileirado por uma pessoa.
- Cada execução registra os ids das regras acionadas, os ids das evidências e um checksum das entradas.
- Nenhum modelo de linguagem é usado. Uma futura camada de explicação poderia resumir a ciência, mas nunca alteraria os passos propostos.

## F03 · Métricas ampliadas — Perfil de Saúde Espacial (`/future/profile`)

Nove domínios — neuro-ocular, cardiovascular, renal, radiação, ósseo, vascular, imunológico, emocional e comportamental, sono — 28 métricas. Cada métrica mostra **valor, unidade, horário, origem, qualidade, tendência e status de validação**, ou diz claramente que não há dado.

| Método | Fonte | Validação exibida |
|---|---|---|
| self-report | diário do F01 | autorrelatado (subjetivo) |
| sim-telemetry | último valor da simulação Monitoring testada (só Tripulante A) | simulado |
| crew-device | digitado pela tripulação a partir de um equipamento de bordo (só checagem de digitação) | registrado pela tripulação (não validado) / seed demo (simulado) |
| unavailable | exige exame ou equipamento indisponível na demo | **sem dado** + exame necessário + último resultado "nenhum registrado" |

O ASTRA Health **nunca simula nem estima** pressão intracraniana, imagem de retina/nervo óptico, densidade mineral óssea, imagem renal, análise de urina, fluxo da veia jugular, ECG, hemograma, dosimetria biológica, questionários comportamentais validados ou actigrafia. A disponibilidade de equipamentos é uma premissa da demonstração, não uma afirmação sobre um veículo real. Cada domínio aponta para seu risco oficial NASA HRR (associação escolhida pela equipe).

## F04 · EVA e resposta autônoma (`/future/eva`)

- Protocolo **ASTRA-EVA@0.1.0-demo**: checklists pré, durante e pós-EVA; quatro eventos durante a EVA (tripulante se sente mal, telemetria do traje perdida, circuito de voz perdido, link com a Terra perdido).
- **Passos condicionados a equipamentos**: quando telemetria do traje, circuito de voz, oxímetro de pulso ou leitura de pressão do traje é marcado como indisponível, os passos dependentes passam para o texto alternativo, e a troca é registrada.
- **Portão pré-EVA**: verificações automáticas usam outros módulos — todos os tripulantes da EVA fizeram check-in hoje (F01), nenhuma avaliação segurando a participação em EVA (F02), status do link registrado. O sistema propõe GO / HOLD (proposta procedimental, não liberação médica); o comandante decide; decidir contra a proposta exige motivo.
- **Eventos**: o protocolo é aplicado, um relatório entra na fila com a prioridade do evento (urgente / prioritário / rotina), o sistema propõe continuar ou encerrar a EVA e o comandante decide (sobrepor exige motivo). "Link com a Terra perdido" desliga o link da plataforma; tudo continua funcionando e sincroniza depois.
- Histórico de todas as decisões do portão e dos eventos; log da EVA enviado à fila; encerrar com itens pós-EVA abertos exige motivo.

## F05 · Verificação e prontidão da missão (`/future/readiness`)

- **Prontidão de dados e procedimentos** por tripulante: check-in de hoje, rotinas atrasadas, alertas do diário, avaliações aguardando revisão ou sugerindo suporte, cobertura do perfil (e quantas métricas exigem equipamento indisponível), bloqueios de EVA. Explicitamente *não* é liberação médica nem decisão de aptidão.
- **Verificação do sistema**: integridade da trilha de auditoria, conjuntos de regras versionados com checksum, nada apresentado como validado, toda referência de evidência / passo resolve offline, propostas aguardando um humano, situação da fila offline, armazenamento no dispositivo.
- **Rastreabilidade**: trilha de auditoria filtrável (módulo, tipo, conjunto de regras, regras, evidências, registro, checksum das entradas, checksum da entrada), teste de adulteração numa cópia e exportação JSON de todo o rastro.
- Os critérios de conclusão e como são verificados (`verification-matrix.json`).

---

## Earth Link (store-and-forward)

Os itens são sempre criados localmente. Com o link perdido, aguardam. Com o link disponível, saem por ordem de prioridade — **urgente → prioritário → rotina**, depois do mais antigo — chegam à Terra após o atraso de ida e são confirmados após a ida e volta (a confirmação precisa do link). Toda transição fica na trilha de auditoria. Use **Simulate link loss / Restore link** e **+15 min / +1 h / Next day** na barra da plataforma.

## Referências científicas

15 riscos oficiais do NASA Human Research Roadmap (`src/data/future/hrr-risk-references.json`), títulos e links conferidos com o índice oficial em 2026-11-15:

```bash
NODE_USE_ENV_PROXY=1 npm run future:check-refs      # conferência ao vivo em humanresearchroadmap.nasa.gov
npm run future:check-refs -- --write-snapshot        # atualiza o snapshot offline usado pelos testes
```

Três deles (cardiovascular, hipóxia, condições médicas em missão) são cobertos pelos relatórios de evidência verificados da biblioteca de Science & Limits e aparecem com citações literais. Os demais são somente referência. Qual risco aparece para um sintoma, domínio ou protocolo de EVA foi escolhido pela Equipe ANGARIS; não é uma afirmação da NASA.

## Testes

```bash
npm run test:future            # 107 testes unitários, de integração e de interface (tests/future)
npm run build
npm run test:e2e:future        # 17 verificações no navegador: F01–F05, rede cortada, recarga, exportação
npm run test:regression        # os 77 testes originais
npm run test:e2e:regression    # as 14 verificações de navegador dos três cenários
npm run test:report:future     # gera docs/future/TEST_REPORT(.pt-BR).md
```

Veja o [relatório de testes](TEST_REPORT.pt-BR.md) com resultados, capturas e a situação de cada critério de conclusão.

## Limites e próximos passos

- Regras, intervalos, checklists e premissas de equipamento: valores demonstrativos que precisam de revisão especializada.
- A operação offline é demonstrada depois que o app carregou; um sistema de voo rodaria num servidor de bordo ou com service worker.
- O checksum da auditoria detecta edições casuais; um sistema de voo assinaria as entradas e as replicaria para o solo.
- Próximos: papéis de usuário (oficial médico, comandante), regras revisadas por especialistas com controle de mudanças, interface bilíngue, adaptadores de equipamentos reais, console em solo.
