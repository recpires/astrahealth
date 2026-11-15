# Roteiro de demonstração — módulos FUTURE (≈ 4 minutos)

> 🇺🇸 [English version](DEMO_SCRIPT.md) · 🖼 [Capturas de cada passo](../screenshots/future/README.md) · Demo original dos três cenários: [docs/DEMO_SCRIPT.md](../DEMO_SCRIPT.md)

A interface está em inglês; as falas abaixo estão em português para quem apresentar em português. Os nomes dos botões aparecem como estão na tela.

**História.** Dia 15 da missão, quatro tripulantes simulados. O Tripulante B dorme mal há cinco dias, o Tripulante C está com dor de cabeça, há uma EVA planejada — e o link com a Terra cai no meio dela. Tudo é dado simulado de demonstração.

## Antes de apresentar

1. Use Chrome ou Edge, tela cheia, zoom 100 %. Abra **Platform preview** (`/future`) uma vez com internet e espere a barra mostrar **Available offline** — o app inteiro fica guardado no dispositivo.
2. Clique em **Reset demo data** → **Erase local records** para a história começar do seed de demonstração (dia 15, 08:00).
3. Deixe a demo testada em **Nominal** (não inicie incidente: o F03 lê os sinais vitais simulados dela).
4. Se algo der errado no palco: **Reset demo data** e recomece; nada se perde no servidor porque nada fica lá.

## 0. Abertura — Overview (20 s) · `/future` · [captura 1](../screenshots/future/01-overview.png)

> "O MVP que vocês viram mede, entende, age e comunica para um tripulante em três cenários testados. Aqui está o próximo passo: uma plataforma autônoma de apoio à decisão em saúde espacial. Quatro princípios: funciona **offline**, é **baseada em evidências**, **um humano sempre decide** e **tudo é rastreável**. A demo testada não foi alterada; estes módulos apenas leem os sinais vitais simulados dela."

Aponte os cinco cartões, o relógio do dia da missão e a caixa do link com a Terra.

## 1. F01 · Diário de saúde (40 s) · `/future/journal`

1. Clique em **Crew Member B** → [captura 2](../screenshots/future/02-journal-flags.png).
   > "Toda manhã cada tripulante faz um check-in de 30 segundos. Regras demonstrativas versionadas encontram padrões: o Tripulante B dormiu menos de seis horas cinco dias seguidos, com fadiga alta. É um alerta para um humano — não um diagnóstico."
2. Clique em **Crew Member C**, digite sono **6.8**, líquidos **1.3**, fadiga **3**, hidratação **2**, marque **Headache**, **Save check-in** → [captura 3](../screenshots/future/03-journal-checkin.png).
   > "Fica salvo no dispositivo, com o horário da missão. As rotinas mostram o que está atrasado — a pressão arterial do Tripulante C está cinco dias atrasada."

## 2. F02 · Avaliação de sintomas (60 s) · `/future/assess`

1. **Crew Member C** · Headache · **Moderate** · **Gradually** · **Worse** · **20** h · tarefas **Yes** → **Run assessment** → [captura 4](../screenshots/future/04-assessment-headache.png).
   > "A orientação operacional vem só de um conjunto de regras versionado — ASTRA-SYM 0.1.0-demo — e dá para ver quais regras foram acionadas. Depois as evidências: o diário registra dor de cabeça em três dos últimos sete dias, e os riscos oficiais da NASA usados como contexto. E a incerteza é declarada: alta, porque não há referência da NASA específica para esse sintoma a bordo. Nunca aparece como baixa, porque estas regras não são clinicamente validadas."
2. **Accept proposal** (revisão humana).
3. **Crew Member B** · Dizziness · Moderate · Suddenly · **1** h · marque **Fainted or nearly fainted** → **Run assessment** → **Accept proposal** → **Queue report to Earth** → [captura 5](../screenshots/future/05-assessment-warning-sign.png).
   > "Com um sinal de alerta, as regras pedem suporte médico agora, relatório urgente e bloqueio de EVA. O risco cardiovascular é citado palavra por palavra do relatório de evidência da NASA que verificamos; referências que não revisamos aparecem como *reference only*. Sem modelo de linguagem: nada aqui é gerado."

## 3. F03 · Perfil de Saúde Espacial (25 s) · `/future/profile` · [captura 6](../screenshots/future/06-health-profile.png)

Clique em **Crew Member A**.
> "Nove domínios, do neuro-ocular ao sono. Cada número diz quando, de onde veio, a qualidade, a tendência e se é validado. E aqui a honestidade importa mais: pressão intracraniana, imagem de retina, densidade óssea exigem equipamento que não temos — então o app mostra **No data** e o exame necessário. Ele nunca inventa esses valores."

## 4. F04 · EVA e resposta autônoma (60 s) · `/future/eva`

1. Desmarque Crew Member C, marque **Crew Member B**, **Plan EVA**; confirme **PRE-03 … PRE-06** → [captura 7](../screenshots/future/07-eva-gate-hold.png).
   > "O checklist pré-EVA usa os outros módulos: o Tripulante B não fez check-in hoje e está bloqueado pela avaliação urgente. O sistema propõe **HOLD**. É uma proposta procedimental, não liberação médica — quem decide é o comandante."
2. Escreva um motivo (ex.: *Ground-cleared training EVA*) → **Decide GO (override)**.
   > "Contrariar a proposta é permitido, mas só com motivo escrito — e fica registrado."
3. Clique em **Earth link lost during EVA** → **Continue EVA** nesse cartão. Desmarque **Suit biomedical telemetry**. Clique em **EVA crew member reports feeling unwell** → [captura 8](../screenshots/future/08-eva-event.png).
   > "Sem link, sem telemetria. O protocolo se adapta: os passos que dependem do equipamento ausente passam para as alternativas. Um relatório urgente é criado — e aguarda na fila. O sistema propõe encerrar a EVA; o comandante decide."
4. **End EVA** → **Queue EVA log to Earth**.

## 5. Earth Link — armazenar e encaminhar (30 s) · `/future`

1. Abra **Overview** → [captura 9](../screenshots/future/09-link-lost-queue.png).
   > "Tudo continuou funcionando sem a Terra. Três itens aguardam; o urgente é o próximo a sair, mesmo tendo sido criado depois da nota de rotina."
2. **Restore link** e depois **+15 min** → [captura 10](../screenshots/future/10-link-restored.png).
   > "O link voltou: primeiro o urgente, depois a rotina. Doze minutos depois estão na Terra — o mesmo modelo de atraso de 3 a 22 minutos do módulo Earth Link testado."

## 6. F05 · Prontidão e rastreabilidade (30 s) · `/future/readiness`

1. → [captura 11](../screenshots/future/11-readiness.png).
   > "Para cada tripulante: a informação de hoje está completa e revisada? É prontidão dos dados, não aptidão para o trabalho. E o sistema se verifica: trilha íntegra, regras versionadas e provisórias, toda referência resolve offline."
2. Clique em **Tamper test (on a copy)** e role até a trilha de auditoria → [captura 12](../screenshots/future/12-audit-trail.png).
   > "Toda decisão, evidência e transmissão está numa trilha encadeada por checksum, com a versão das regras e o checksum das entradas. Altere uma entrada e a verificação falha. Ela pode ser exportada em JSON."

## 7. Encerramento — offline de verdade (15 s) · [captura 14](../screenshots/future/14-offline-reload.png)

Ative o modo avião (ou DevTools → Network → **Offline**) e aperte **F5**.
> "Nenhuma rede, recarga completa — o app e o check-in do Tripulante C continuam aqui. É disso que uma tripulação precisa quando a Terra está a vinte minutos ou em silêncio."

Religue a rede.

---

## Versão curta (90 s)

Overview (0) → Avaliação com sinal de alerta (2.3) → EVA com override + evento (4.2–4.3) → Restaurar o link (5.2) → Teste de adulteração (6.2).

## Perguntas prováveis

| Pergunta | Resposta |
|---|---|
| É um dispositivo médico? | Não. É um protótipo de demonstração; toda regra e protocolo está marcado como PROVISIONAL e foi escrito pela equipe. Não nomeia doença, medicamento nem tratamento. |
| De onde vêm as regras? | De arquivos JSON versionados no repositório (`src/data/future/`). Cada decisão registra a versão do conjunto de regras e quais regras foram acionadas, para que um especialista possa revisá-las e alterá-las com controle de versão. |
| Qual é o conteúdo da NASA? | 15 riscos oficiais do Human Research Roadmap (títulos e links conferidos no índice da NASA) e três relatórios de evidência da NASA citados palavra por palavra. Qual risco aparece para cada sintoma foi escolhido pela equipe. |
| Vocês usam IA para decidir? | Não. As decisões vêm de regras determinísticas; ferramentas de IA ajudaram a construir o software (veja a declaração de uso de IA). |
| E sem a Terra? | Tudo roda localmente; os relatórios aguardam e saem por prioridade quando o link volta. O app recarrega até sem rede. |
| Os dados são reais? | Não. Todos os dados de tripulação são simulados ou digitados durante a demo. |
