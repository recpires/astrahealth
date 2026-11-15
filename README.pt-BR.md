<p align="center">
  <img src="docs/assets/banner-pt.png" alt="ASTRA Health — Assistente Autônomo de Resposta em Saúde Espacial (logo gerada por IA)" width="100%" />
</p>

<p align="center">
  <a href="README.md">English</a> · <strong>Português (Brasil)</strong>
</p>

<p align="center">
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white" />
  <img alt="React 19" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white" />
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tailwind CSS 4" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img alt="Recharts 3" src="https://img.shields.io/badge/Recharts-3-22D3EE" />
  <img alt="Vitest: 77 testes" src="https://img.shields.io/badge/Vitest-77_testes_passando-6E9F18?logo=vitest&logoColor=white" />
  <img alt="Pronto para Vercel" src="https://img.shields.io/badge/Vercel-pronto-000000?logo=vercel&logoColor=white" />
  <a href="LICENSE"><img alt="Licença: MIT" src="https://img.shields.io/badge/licença-MIT-2EA44F" /></a>
  <br/>
  <img alt="NASA Space Apps Challenge 2026" src="https://img.shields.io/badge/NASA_Space_Apps-2026-0B3D91" />
  <img alt="Status: protótipo demonstrativo" src="https://img.shields.io/badge/status-protótipo_demonstrativo-F59E0B" />
  <img alt="Dados: simulados" src="https://img.shields.io/badge/dados-simulados-A78BFA" />
  <a href="docs/TEST_REPORT.pt-BR.md"><img alt="Relatório de testes dos cenários: aprovado" src="https://img.shields.io/badge/testes_dos_cenários-17%2F17_aceitação_·_14%2F14_navegador-2EA44F" /></a>
</p>

<p align="center">
  O <b>ASTRA Health</b> ajuda astronautas em missões de longa duração a <b>compreender alterações nos sinais vitais</b>
  e a <b>seguir procedimentos previamente definidos</b> a bordo — mesmo quando cada mensagem para a Terra leva minutos para chegar.
</p>

<p align="center">
  📄 <a href="docs/ASTRA_Health_ANGARIS_Technical_Documentation_EN.pdf"><b>Documentação técnica (PDF, em inglês)</b></a> — versão 1.0, 15 de novembro de 2026
</p>

> [!WARNING]
> **Protótipo demonstrativo.** Todos os valores de sinais vitais deste projeto são **simulados**. O ASTRA Health **não é
> um dispositivo médico**, **não faz diagnóstico**, **não recomenda medicamentos, tratamentos nem intervenções clínicas** e
> **não possui validação clínica**. Os limites de análise são **valores provisórios** até que a Equipe ANGARIS confirme o
> enunciado oficial do desafio e o recurso científico da NASA. Veja [Base científica e limitações](#-base-científica-e-limitações).

---

## 📑 Sumário

1. [Visão geral](#-visão-geral)
2. [O problema](#-o-problema)
3. [Como funciona](#-como-funciona)
4. [Módulos](#-módulos)
5. [Prévia da plataforma — módulos FUTURE](#-prévia-da-plataforma--módulos-future)
6. [Cenários de demonstração](#-cenários-de-demonstração)
7. [Sequência completa — Cenário 2](#-sequência-completa--cenário-2-alteração-dos-sinais-vitais)
8. [Motor de análise](#-motor-de-análise)
9. [Comunicação Terra–Marte](#-simulador-de-comunicação-terramarte)
10. [Relatório de incidente (ASTRA-IR/0.1)](#-relatório-de-incidente-astra-ir01)
11. [Arquitetura](#-arquitetura)
12. [Tecnologias](#-tecnologias)
13. [Como executar](#-como-executar)
14. [Testes](#-testes)
15. [Capturas de tela e banners](#-capturas-de-tela-e-banners)
16. [Publicação (Vercel)](#-publicação-vercel)
17. [Base científica e limitações](#-base-científica-e-limitações)
18. [Roadmap](#-roadmap)
19. [Declaração de uso de ferramentas de IA](#-declaração-de-uso-de-ferramentas-de-ia)
20. [Equipe, licença e agradecimentos](#-equipe)

---

## 🛰 Visão geral

O **ASTRA Health — Autonomous Space Health Response Assistant** (Assistente Autônomo de Resposta em Saúde Espacial) é um
MVP web desenvolvido pela **Equipe ANGARIS** para o **NASA Space Apps Challenge 2026**. Ele demonstra um ciclo fechado
de quatro etapas:

| Etapa | Módulo | Pergunta que responde |
|:---:|---|---|
| **01 · MEDIR** | Monitoramento | *Como estão meus sinais vitais agora? Os sensores estão funcionando?* |
| **02 · ENTENDER** | Análise | *Algo mudou? É o corpo ou o sensor? Quanto posso confiar nos dados?* |
| **03 · AGIR** | Resposta | *Que passos predefinidos devo seguir? Preciso pedir suporte médico?* |
| **04 · COMUNICAR** | Link com a Terra | *Como aviso a Terra e quando posso esperar uma resposta?* |

**Destaques**

- 📈 Monitoramento simulado em tempo real de frequência cardíaca, SpO₂ e temperatura corporal, com gráficos de tendência e estado dos sensores.
- 🧠 Motor de regras determinístico e explicável — cada achado vem com explicação em linguagem simples e evidências.
- 🟣 Falhas de sensor são detectadas e exibidas em outra cor, para que um sensor com defeito nunca seja confundido com uma emergência médica.
- ✅ Confirmação de medições inconsistentes pelo astronauta, checklists de segurança demonstrativos e registro de ações com horário.
- 🚨 Indicação clara de **quando** pedir suporte médico — sem jamais recomendar tratamento.
- 📡 Simulador do link Terra–Marte com atraso de 3 a 22 min por sentido, fila de transmissão, simulação de queda do link e estados de mensagem.
- 🧾 Relatório de incidente estruturado (texto + JSON) gerado a partir do estado atual.
- 📚 **Science & Limits**: evidências verificadas do NASA Human Research Program (riscos cardiovasculares, hipóxia e capacidade médica) e um conjunto de dados real do NASA OSDR, sempre separados dos dados simulados e das regras demonstrativas.
- 🧪 77 testes automatizados, incluindo **17 casos de aceitação e 14 verificações no navegador** dos três cenários — veja o [relatório de testes](docs/TEST_REPORT.pt-BR.md).

---

## 🧭 O problema

Numa missão a Marte, um sinal de rádio leva aproximadamente **de 3 a 22 minutos para percorrer um único sentido** (faixa
definida no briefing da equipe). Uma pergunta ao médico de voo na Terra e sua resposta podem levar, portanto, **de 6 a 44
minutos**, além do tempo que a equipe em solo precisa para responder. Nesse intervalo, a tripulação precisa:

1. perceber que algo está mudando,
2. distinguir uma **alteração fisiológica real** de um **problema de sensor**,
3. seguir ações **seguras e predefinidas** a bordo, e
4. enviar à Terra um resumo **claro e estruturado**, útil quando finalmente chegar.

O ASTRA Health prototipa esse fluxo de trabalho com dados simulados.

---

## ⚙ Como funciona

```mermaid
flowchart LR
    S["Sensores simulados<br/>FC · SpO₂ · Temperatura"] --> M
    M["01 · MEDIR<br/>Painel de monitoramento"] --> U
    U["02 · ENTENDER<br/>Motor de regras determinístico"] --> A
    A["03 · AGIR<br/>Confirmação · Checklists · Escalonamento"] --> C
    C["04 · COMUNICAR<br/>Link com atraso + relatório de incidente"]
    C -. "resposta simulada após 2 × atraso" .-> A
    classDef step fill:#071226,stroke:#22d3ee,color:#e6f1ff;
    class M,U,A,C step;
```

Um único **relógio simulado da missão** comanda tudo: a reprodução dos sinais vitais (uma amostra a cada 10 s de tempo de
missão), o motor de análise, o registro de ações e a fila do link com a Terra. No cabeçalho é possível **pausar** ou mudar a
velocidade (**1×, 10× por padrão, 30×, 60×**), e o estado é compartilhado entre todas as páginas.

> A interface da aplicação está em **inglês** para a demonstração; nesta documentação, os nomes de botões e telas aparecem
> como na interface.

---

## 🧩 Módulos

### 01 · MEDIR — Monitoramento (`/`)

- Frequência cardíaca (bpm), SpO₂ (%) e temperatura corporal (°C) com valores em destaque.
- Gráfico de tendência por sinal vital (últimos 10 min de missão) com a **faixa de referência demonstrativa em verde** e os **limites de cautela tracejados em vermelho**; pontos fora da faixa são destacados.
- Barra de qualidade de sinal e estado de cada sensor simulado: *Online · Degraded · No signal · Suspect · Excluded*.
- Botões **Simulate incident** (simular incidente), **Simulate sensor fault** (simular falha de sensor) e **Reset to nominal** (voltar ao normal), além da seleção direta de cenário.
- Todo valor é identificado como **SIM** / *Simulated data*.

<p align="center"><img src="docs/screenshots/sequence-vital-deviation/04-monitoring-warning.png" alt="Módulo de monitoramento em WARNING" width="90%" /></p>

### 02 · ENTENDER — Análise (`/analysis`)

- **Nível de atenção** geral: `NOMINAL → ADVISORY → CAUTION → WARNING`.
- Índice de **confiabilidade dos dados** (geral e por sinal vital), com os fatores que o reduziram.
- **Achados** em linguagem simples, cada um com categoria (alteração de sinal vital 🔴 ou problema de sensor 🟣), evidências, ID da regra e horário de início.
- Lista das regras determinísticas, destacando as que estão **acionadas**.
- **Histórico de eventos**: detecções, escalonamentos, reduções de nível e normalizações, com horário da missão.

<p align="center"><img src="docs/screenshots/sequence-vital-deviation/05-analysis-findings-and-reliability.png" alt="Módulo de análise" width="90%" /></p>

### 03 · AGIR — Resposta (`/response`)

- **Evento identificado**, com nível, categoria e horário de início.
- **Confirmação de medição** para leituras inconsistentes: *Take confirmation reading* (fazer leitura de confirmação) ou *Unable to re-measure* (não foi possível medir de novo).
- **Procedimentos demonstrativos** selecionados automaticamente (monitoramento de rotina, verificação de sensor, artefato de sensor, alteração de sinais vitais, pedido de suporte médico) como checklists interativos.
- **Indicador de suporte médico** — *não necessário · continuar monitorando · solicitar · solicitar agora* — com os motivos e quem acionar (Oficial Médico da Tripulação a bordo, médico de voo na Terra).
- **Registro de ações**: cada passo, confirmação e transmissão recebe horário e entra no relatório.

<p align="center"><img src="docs/screenshots/sequence-vital-deviation/07-response-identified-event-medical-support.png" alt="Módulo de resposta" width="90%" /></p>

### 04 · COMUNICAR — Link com a Terra (`/comms`)

- Controle de atraso por sentido de **3 a 22 min**, com atalhos (3 · 12 · 22 min), **estimativa de ida e volta** e distância percorrida pela luz.
- Alternância **link disponível / indisponível**, para mostrar mensagens aguardando na fila.
- **Relatório de incidente estruturado** gerado a partir do estado atual, com prévia em texto ou JSON; prioridade pré-selecionada conforme a urgência de suporte médico.
- **Fila de transmissão e histórico**, com indicador de estado e barra de progresso por mensagem, além de uma **visão do link** mostrando mensagens e confirmações viajando entre Marte e a Terra.
- Também é possível enviar **notas curtas da tripulação**.

<p align="center"><img src="docs/screenshots/sequence-vital-deviation/12-earth-link-2-sent-in-transit.png" alt="Módulo de comunicação com a Terra" width="90%" /></p>

### Science & Limits — Ciência e limitações (`/science`)

- **Três categorias de conteúdo**, identificadas em toda a seção: *dados simulados*, *dados e evidências científicas reais* e *regras demonstrativas*.
- **Biblioteca de evidências do NASA Human Research Program** — relatórios oficiais de evidência sobre risco cardiovascular, hipóxia e capacidade médica, cada um com título, fonte, autores, data, links, a declaração de risco do HRR na íntegra, citações literais, como o ASTRA Health a utiliza e suas limitações; com filtro por tema.
- **Conjunto de dados OSD-575 do NASA OSDR** (painel de biomarcadores cardiovasculares séricos da Inspiration4), com identificação completa da fonte, gráfico e tabela de resumo por momento e importação, no navegador, de outros arquivos do OSDR — nunca misturado aos sinais vitais simulados.
- Tabela de procedência, limites provisórios, limitações científicas e a declaração de uso de ferramentas de IA.

Veja [Como os recursos científicos são utilizados](#como-os-recursos-científicos-são-utilizados).

<p align="center"><img src="docs/screenshots/13-science-evidence-library.png" alt="Science & Limits — biblioteca de evidências do HRP" width="90%" /></p>

---

## 🚀 Prévia da plataforma — módulos FUTURE

Ao lado da demo testada, **Platform preview** (`/future`) mostra como o ASTRA Health pode evoluir para um **sistema autônomo de apoio à decisão em saúde espacial**: offline-first, baseado em evidências, com humano no circuito e totalmente rastreável. Os cinco módulos têm estado e armazenamento próprios no dispositivo; apenas *leem* os sinais vitais simulados da demo testada, que permanece inalterada (seus 77 testes e 14 verificações de navegador são executados novamente a cada mudança).

| Módulo | O que faz |
|---|---|
| **F01 · Diário de saúde e check diário** (`/future/journal`) | Autorrelato diário (sono, humor, fadiga, hidratação, sintomas), rotinas com status atrasada / para hoje, tendências de 14 dias, alertas de atenção por regras demonstrativas versionadas. |
| **F02 · Avaliação de sintomas e motor de evidências** (`/future/assess`) | Perguntas estruturadas → conjunto de regras versionado `ASTRA-SYM@0.1.0-demo` → nível de atenção e próximos passos, com os fatos do diário e as referências oficiais NASA HRR por trás deles, incerteza declarada e revisão humana obrigatória. |
| **F03 · Perfil de Saúde Espacial** (`/future/profile`) | 9 domínios (neuro-ocular, cardiovascular, renal, radiação, ósseo, vascular, imunológico, emocional, sono), 28 métricas com valor, unidade, horário, origem, qualidade, tendência e status de validação. Exames que exigem equipamento indisponível (ex.: pressão intracraniana, densidade óssea) mostram **sem dado** — nunca simulados. |
| **F04 · EVA e resposta autônoma** (`/future/eva`) | Checklists pré / durante / pós-EVA, passos condicionados a equipamentos, proposta GO / HOLD usando F01 e F02, eventos durante a EVA, decisões do comandante com motivo obrigatório para sobrepor, relatórios priorizados para o Earth Link. |
| **F05 · Verificação e prontidão da missão** (`/future/readiness`) | Prontidão de dados da tripulação (não é liberação médica), verificações do sistema, conjuntos de regras versionados com checksum, trilha de auditoria encadeada com teste de adulteração e exportação JSON. |

Tudo funciona com o link com a Terra perdido: os relatórios aguardam numa fila store-and-forward e saem por ordem de prioridade (urgente → prioritário → rotina) quando ele volta. Um **service worker** guarda uma cópia de cada página no dispositivo; depois de uma visita com internet, o app inteiro — inclusive a demo testada — **recarrega sem nenhuma rede** (testado com o servidor desligado). Todas as regras e protocolos são **conteúdo demonstrativo PROVISIONAL**, não são procedimentos da NASA e não são clinicamente validados.

📘 [Documentação FUTURE](docs/future/README.pt-BR.md) · 🎬 [Roteiro de demo](docs/future/DEMO_SCRIPT.pt-BR.md) · 🖼 [14 capturas](docs/screenshots/future/README.md) · 🧪 [Relatório de testes](docs/future/TEST_REPORT.pt-BR.md) — 110 testes automatizados + 19 verificações no navegador (incl. rede cortada, recarga com o servidor desligado, layout em celular/tablet) + regressão completa · ♿ [Auditoria de acessibilidade](docs/ACCESSIBILITY.pt-BR.md)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/future/04-assessment-headache.png" alt="F02 avaliação de sintomas" /><br/><sub><b>F02</b> — Regras versionadas, evidências usadas e incerteza declarada</sub></td>
    <td width="50%"><img src="docs/screenshots/future/06-health-profile.png" alt="F03 perfil de saúde espacial" /><br/><sub><b>F03</b> — Nove domínios; “No data” em vez de exames simulados</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/future/08-eva-event.png" alt="F04 evento na EVA" /><br/><sub><b>F04</b> — EVA sem link e sem telemetria: passos alternativos, o comandante decide</sub></td>
    <td><img src="docs/screenshots/future/12-audit-trail.png" alt="F05 trilha de auditoria" /><br/><sub><b>F05</b> — Trilha de auditoria encadeada e teste de adulteração</sub></td>
  </tr>
</table>

---

## 🎬 Cenários de demonstração

| Cenário | O que acontece (simulado) | O que o ASTRA Health faz |
|---|---|---|
| **1 — Monitoramento normal** | Todos os valores dentro das faixas demonstrativas, boa qualidade de sinal. A gravação se repete sem emendas. | `NOMINAL` · nenhum achado · confiabilidade **High** · checklist de monitoramento de rotina · sem suporte médico. Ainda é possível enviar um relatório de status de rotina. |
| **2 — Alteração de sinais vitais** | A frequência cardíaca sobe (~72 → ~130 bpm), a SpO₂ cai (~98 → ~88 %) e a temperatura sobe (~36,7 → ~37,8 °C); os sensores continuam saudáveis. | Detecções → escalonamento até `WARNING` · confiabilidade **High** (os sinais se confirmam entre si) · **Request medical support now** (solicitar suporte médico agora) · checklists de escalonamento e de segurança · relatório **urgente** pelo link com atraso. |
| **3 — Falha de sensor** | O oxímetro de pulso passa a reportar SpO₂ errática e muito baixa, com qualidade ruim e perdas de leitura, enquanto frequência cardíaca e temperatura seguem estáveis. | Achados de sensor e *reading inconsistent — confirmation needed* (leitura inconsistente, confirmação necessária) · confiabilidade **Low** · suporte médico **ainda não** necessário. Uma leitura de confirmação (98 %) atribui os valores ao sensor → SpO₂ **excluída**, nível cai para `ADVISORY`, checklist de higiene de dados. Se não for possível medir novamente, o suporte médico é recomendado. |

Em **10×**, as primeiras detecções aparecem após cerca de **2 s** (falha de sensor) ou **9 s** (alteração de sinais vitais)
de tempo real, e o `WARNING` após cerca de **15 s**. Há um roteiro de apresentação em
[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) (em inglês).

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/09-response-confirmation-request.png" alt="Falha de sensor: confirmação solicitada" /><br/><sub>Cenário 3 — confirmação solicitada</sub></td>
    <td width="50%"><img src="docs/screenshots/11-monitoring-sensor-excluded.png" alt="Falha de sensor: SpO₂ excluída após confirmação" /><br/><sub>Cenário 3 — SpO₂ excluída como artefato de sensor</sub></td>
  </tr>
</table>

---

## 🎞 Sequência completa — Cenário 2 (alteração dos sinais vitais)

Dezesseis quadros 16:9 capturados com a simulação pausada em cada etapa, do estado normal até a resposta simulada da Terra
(atraso de 12 min por sentido). Pasta: [`docs/screenshots/sequence-vital-deviation/`](docs/screenshots/sequence-vital-deviation/).

<details>
<summary><b>Mostrar os 16 quadros</b></summary>
<br/>

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/sequence-vital-deviation/01-monitoring-baseline-nominal.png" alt="01" /><br/><sub><b>01 · MEDIR</b> — Estado normal</sub></td>
    <td width="50%"><img src="docs/screenshots/sequence-vital-deviation/02-monitoring-incident-started.png" alt="02" /><br/><sub><b>02 · MEDIR</b> — Incidente simulado, valores ainda normais</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/03-monitoring-first-deviation-caution.png" alt="03" /><br/><sub><b>03 · MEDIR</b> — Primeira alteração (SpO₂), CAUTION</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/04-monitoring-warning.png" alt="04" /><br/><sub><b>04 · MEDIR</b> — Três sinais vitais fora da faixa, WARNING</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/05-analysis-findings-and-reliability.png" alt="05" /><br/><sub><b>05 · ENTENDER</b> — Achados e confiabilidade dos dados</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/06-analysis-event-history.png" alt="06" /><br/><sub><b>06 · ENTENDER</b> — Histórico de eventos</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/07-response-identified-event-medical-support.png" alt="07" /><br/><sub><b>07 · AGIR</b> — Evento identificado, solicitar suporte médico agora</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/08-response-checklist-and-action-log.png" alt="08" /><br/><sub><b>08 · AGIR</b> — Checklists e registro de ações</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/09-earth-link-report-generated-text.png" alt="09" /><br/><sub><b>09 · COMUNICAR</b> — Relatório gerado (texto)</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/10-earth-link-report-generated-json.png" alt="10" /><br/><sub><b>10 · COMUNICAR</b> — Relatório gerado (JSON)</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/11-earth-link-1-awaiting-send.png" alt="11" /><br/><sub><b>11 · COMUNICAR</b> — Aguardando envio</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/12-earth-link-2-sent-in-transit.png" alt="12" /><br/><sub><b>12 · COMUNICAR</b> — Enviado, a caminho da Terra</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/13-earth-link-3-received-by-earth.png" alt="13" /><br/><sub><b>13 · COMUNICAR</b> — Recebido pela Terra (simulado)</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/14-earth-link-4-response-pending.png" alt="14" /><br/><sub><b>14 · COMUNICAR</b> — Resposta pendente, a caminho de Marte</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sequence-vital-deviation/15-earth-link-5-response-received.png" alt="15" /><br/><sub><b>15 · COMUNICAR</b> — Confirmação simulada recebida</sub></td>
    <td><img src="docs/screenshots/sequence-vital-deviation/16-response-final-checklists-and-action-log.png" alt="16" /><br/><sub><b>16 · AGIR</b> — Checklists concluídos, registro completo</sub></td>
  </tr>
</table>

</details>

---

## 🧠 Motor de análise

Funções TypeScript puras e determinísticas (`src/lib/analysis`). A mesma entrada sempre produz a mesma saída; nenhum modelo
de IA roda dentro da aplicação.

### Regras

Cada sinal vital é avaliado sobre as últimas 24 amostras (4 min de missão).

| Regra | Disparo | Categoria | Nível |
|---|---|---|---|
| `VITAL_OUT_OF_RANGE` | 3 amostras válidas consecutivas fora da faixa demonstrativa, do mesmo lado; normaliza após 3 de volta à faixa (histerese) | 🔴 alteração de sinal vital | `CAUTION`; `WARNING` quando as 3 últimas passam da faixa de cautela |
| `SENSOR_DROPOUT` | Leituras ausentes nas últimas 10 amostras | 🟣 sensor | `ADVISORY` (1) · `CAUTION` (≥ 2) |
| `SENSOR_IMPLAUSIBLE` | Valor fora dos limites de plausibilidade física | 🟣 sensor | `CAUTION` · confirmação necessária |
| `SENSOR_ABRUPT_CHANGE` | Salto entre leituras consecutivas acima do passo máximo | 🟣 sensor | `ADVISORY` (1) · `CAUTION` (≥ 2) · confirmação necessária |
| `SENSOR_LOW_QUALITY` | Qualidade média de sinal das 3 últimas amostras < 60 % (ruim < 40 %) | 🟣 sensor | `ADVISORY` · `CAUTION` |
| `SENSOR_FLATLINE` | Frequência cardíaca exatamente igual por 12 amostras (2 min) | 🟣 sensor | `CAUTION` · confirmação necessária |
| `READING_INCONSISTENT` | Valor fora da faixa vindo de um sensor suspeito — substitui a alteração | 🟣 sensor | `CAUTION` · confirmação necessária |

### Níveis de atenção

| Nível | Significado na demonstração |
|---|---|
| 🟢 `NOMINAL` | Tudo dentro das faixas demonstrativas, sensores confiáveis. |
| 🔵 `ADVISORY` | Atenção (por exemplo, uma perda de leitura isolada ou um sensor excluído após confirmação). |
| 🟡 `CAUTION` | Verificar a situação e seguir o checklist. |
| 🔴 `WARNING` | Alteração confiável de sinal vital além da faixa de cautela — solicitar suporte médico. |

São categorias demonstrativas, **não níveis de triagem clínica**.

### Confiabilidade dos dados

- Por sinal vital: `qualidade do sinal × 100 − penalidades das regras` (perda de leitura −5 cada, salto brusco −10, valor implausível −20, valor congelado −20), `+3` quando duas ou mais alterações confiáveis se confirmam entre si.
- **Geral = o sinal vital mais fraco** — um único sensor pouco confiável já reduz a confiança no quadro todo.
- Rótulos: **High** ≥ 80 · **Medium** ≥ 55 · **Low** abaixo disso.
- A confiabilidade descreve a **qualidade dos dados**, não a certeza sobre a saúde do tripulante.

### Confirmação pelo astronauta

| Resultado | Efeito |
|---|---|
| **Artefato** — leitura de confirmação dentro da faixa demonstrativa | Os achados daquele sensor são resolvidos, o sensor é **excluído** e permanece um `ADVISORY`. |
| **Confirmada** — leitura também fora da faixa | A *leitura inconsistente* passa a ser uma alteração de sinal vital confirmada. |
| **Não foi possível medir novamente** | Os achados continuam abertos e o suporte médico é recomendado. |

### Quando solicitar suporte médico

| Urgência | Condição |
|---|---|
| **Solicitar agora** (`urgent`) | Qualquer alteração confiável de sinal vital em `WARNING`. |
| **Solicitar** (`recommended`) | ≥ 2 alterações simultâneas · alteração persistente por ≥ 3 min · alteração confirmada · leitura inconsistente que não pôde ser verificada. |
| **Continuar monitorando** (`monitor`) | Uma única alteração em `CAUTION`, ou um problema de sensor em aberto (verificar o sensor primeiro). |
| **Não necessário** (`none`) | Situação normal, ou a leitura anormal foi atribuída ao sensor. |

O ASTRA Health indica apenas **quando** envolver o Oficial Médico da Tripulação e o médico de voo. Ele nunca indica **qual tratamento** aplicar.

---

## 📡 Simulador de comunicação Terra–Marte

```mermaid
stateDiagram-v2
    direction LR
    [*] --> AguardandoEnvio: relatório na fila
    AguardandoEnvio --> Enviado: transmissor livre e link ativo (30 s)
    Enviado --> Recebido: atraso de um sentido (3–22 min)
    Recebido --> RespostaPendente: atendimento em solo (2 min)
    RespostaPendente --> RespostaRecebida: atraso de um sentido
    RespostaRecebida --> [*]
```

- Um transmissor, **30 s** por mensagem; ordem: **urgente → prioritária → rotina** e, depois, ordem de chegada.
- Mensagens aguardam enquanto o link está **indisponível** (simulação de queda) e saem assim que ele é restabelecido.
- O atraso de um sentido é **fixado** no momento da transmissão; mudar o controle afeta apenas as novas mensagens.
- A estação terrestre simulada responde **2 min** após o recebimento com uma confirmação automática que deixa claro que **nenhuma pessoa real revisou o conteúdo**.
- Ida e volta exibida na interface = `2 × atraso de um sentido` (+ tempo de resposta em solo). Distância percorrida pela luz = `atraso × velocidade da luz`.

**Exemplo da sequência completa (atraso de 12 min por sentido):**

| Evento | Horário da missão |
|---|---|
| Relatório colocado na fila | T+00:14:53 |
| Transmissão concluída — **enviado** | T+00:15:23 |
| **Recebido** pela Terra | T+00:27:23 |
| Resposta enviada pela Terra — **resposta pendente** | T+00:29:23 |
| **Resposta recebida** a bordo | T+00:41:23 |

---

## 🧾 Relatório de incidente (ASTRA-IR/0.1)

Gerado a partir do estado atual na página Earth Link e anexado à mensagem enviada. Trecho de um relatório real produzido pelo
código no Cenário 2 (todos os valores simulados; o conteúdo do relatório é gerado em inglês, como a interface):

```json
{
  "reportId": "IR-02-001",
  "format": "ASTRA-IR/0.1",
  "simulated": true,
  "disclaimer": "SIMULATED DEMONSTRATION REPORT — generated by ASTRA Health from synthetic data. Not real astronaut data. Not a diagnosis. Not clinically validated.",
  "generatedAt": "T+00:15:20",
  "crewMember": "Crew Member A (simulated)",
  "assessment": {
    "attentionLevel": "WARNING",
    "status": "vital-deviation",
    "summary": "3 vital signs are outside the demo reference range with reliable sensor data (WARNING).",
    "dataReliability": { "score": 96, "label": "High" }
  },
  "latestVitals": [
    { "vital": "hr", "value": "129", "unit": "bpm", "signalQuality": 0.93, "sensorStatus": "online" },
    { "vital": "spo2", "value": "89", "unit": "%", "signalQuality": 0.93, "sensorStatus": "online" },
    { "vital": "temp", "value": "37.8", "unit": "°C", "signalQuality": 0.97, "sensorStatus": "online" }
  ],
  "activeFindings": [
    {
      "title": "Heart rate above demo reference range",
      "level": "WARNING",
      "evidence": "Last 3 values 129, 129, 129 bpm; demo reference 50–100 bpm; beyond caution band 40–120 bpm.",
      "since": "T+00:11:50"
    }
  ],
  "actionsTaken": [
    { "at": "T+00:15:00", "text": "Step completed [PROC-ESC-01] Notify the Crew Medical Officer (CMO) on board now." }
  ],
  "medicalSupport": { "urgency": "urgent", "headline": "Request medical support now" },
  "requestToGround": "PRIORITY: Request flight surgeon review of the attached simulated data and guidance through approved procedures.",
  "scientificBasis": {
    "referenceRanges": "PROVISIONAL: Demonstration placeholder values chosen by the development team. Not clinically validated. …",
    "nasaResource": "Pending team confirmation — no NASA source for thresholds integrated yet.",
    "evidenceContext": "Context only, no threshold derived: 3 NASA HRP evidence reports (cardiovascular, hypoxia, medical capability) listed in Science & Limits."
  }
}
```

O relatório completo também traz todos os achados, os achados resolvidos, as confirmações, todas as ações registradas e os
motivos da decisão sobre suporte médico. Uma versão em texto simples é transmitida como corpo da mensagem.

---

## 🏗 Arquitetura

```mermaid
flowchart TB
    subgraph Data["Dados e configuração"]
        SC["scenarios/*.json<br/>(simulados, com semente)"]
        PR["procedures.json<br/>(checklists demonstrativos)"]
        RR["reference-ranges.ts<br/>(PROVISÓRIO)"]
        NR["scientific-sources.ts<br/>(registro NASA — pendente)"]
    end
    subgraph Core["Lógica de domínio pura — src/lib"]
        RED["mission/reducer.ts<br/>relógio · reprodução · eventos · fila"]
        AN["analysis/<br/>motor · eventos · confirmação"]
        RS["response/<br/>escalonamento · procedimentos"]
        CM["comms/<br/>atraso · fila"]
        RP["report/<br/>relatório de incidente"]
    end
    subgraph UI["Next.js App Router — src/app + src/components"]
        PV["MissionProvider<br/>(contexto, tick de 250 ms)"]
        P1["/ Monitoramento"]
        P2["/analysis"]
        P3["/response"]
        P4["/comms"]
        P5["/science"]
    end
    SC --> RED
    RR --> AN
    PR --> RS
    NR --> RP
    RED --> AN --> RS
    RED --> CM
    RS --> RP --> CM
    PV --> RED
    PV --> P1 & P2 & P3 & P4
    NR --> P5
```

**Princípios de projeto**

- **Núcleo puro, interface fina** — toda a lógica de domínio é pura e tipada; os componentes React só exibem o estado derivado e disparam ações, então o ciclo completo é testável sem navegador.
- **Um único relógio simulado** — horários consistentes entre monitoramento, análise, ações e mensagens.
- **Configuração em vez de código** — limites, registro da NASA, cenários e procedimentos são dados, substituíveis sem mexer nos motores.
- **Honestidade garantida por testes** — os testes falham se um recurso da NASA for declarado sem procedência completa, ou se os procedimentos mencionarem medicamentos ou intervenções clínicas.

<details>
<summary><b>Estrutura do projeto</b></summary>

```text
astrahealth/
├── src/
│   ├── app/                      # Rotas: / · /analysis · /response · /comms · /science
│   │   ├── layout.tsx            # MissionProvider + AppShell
│   │   ├── icon.png · apple-icon.png · opengraph-image.png
│   │   └── globals.css           # Tokens do tema (azul-marinho / ciano, cores de alerta)
│   ├── components/
│   │   ├── layout/               # Cabeçalho, navegação lateral, logo
│   │   ├── ui/                   # Panel, Badge, Button, ProgressBar, mapas de cor
│   │   └── monitor/ · analysis/ · response/ · comms/ · science/
│   ├── state/MissionProvider.tsx # Contexto React + relógio da simulação
│   ├── lib/
│   │   ├── mission/reducer.ts    # Máquina de estados pura
│   │   ├── analysis/             # Motor de regras, eventos, confirmação
│   │   ├── response/             # Escalonamento + seleção de procedimentos
│   │   ├── comms/                # Cálculo de atraso + fila de transmissão
│   │   ├── report/               # Relatório de incidente ASTRA-IR/0.1
│   │   └── scenarios.ts · time.ts · types.ts
│   │   └── science/              # Tipos de evidência e OSDR, leitor/resumo do OSDR
│   ├── config/
│   │   ├── reference-ranges.ts   # Limites PROVISÓRIOS
│   │   ├── scientific-sources.ts # Registro NASA para fonte de limites (pendente)
│   │   ├── evidence-library.ts   # Acesso tipado à biblioteca de evidências do HRP
│   │   └── data-provenance.ts    # Classificação simulado / real / regra demonstrativa
│   ├── data/
│   │   ├── scenarios/*.json      # Gravações SIMULADAS (180 amostras × 10 s)
│   │   ├── science/nasa-hrp-evidence.json # Evidências do HRP (links verificados + citações literais)
│   │   ├── osdr/OSD-575.json     # Arquivo REAL do NASA OSDR, salvo na íntegra + SHA-256
│   │   └── procedures.json       # Checklists demonstrativos
│   └── assets/astra-emblem.png
├── tests/                        # Vitest: aceitação (plano de testes), motor, comunicação, ciência, interface
├── scripts/                      # Gerador de dados, importação OSDR, checagem de links, capturas, banners
├── docs/                         # Arquitetura, limitações, guia NASA, roteiro, imagens
├── public/brand/astra-health-logo.png
├── AI_DISCLOSURE.md
└── README.md · README.pt-BR.md
```

</details>

Mais detalhes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (em inglês).

---

## 🛠 Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Cache Components, Turbopack) · React 19 |
| Linguagem | TypeScript (modo strict) |
| Estilo | Tailwind CSS 4 — tema escuro azul-marinho e ciano, cores de alerta distintas |
| Gráficos | Recharts 3 |
| Ícones | Lucide |
| Testes | Vitest 5 · Testing Library · jsdom |
| Ferramentas | ESLint (Next.js core-web-vitals + TypeScript) · Playwright (somente capturas e banners) |
| Hospedagem | Vercel |

Sem autenticação, sem banco de dados, sem APIs externas e sem variáveis de ambiente. Os dados simulados ficam em JSON.

---

## 🚀 Como executar

**Requisitos:** Node.js **≥ 20.9** e npm.

```bash
git clone https://github.com/recpires/astrahealth.git
cd astrahealth
npm install
npm run dev
# abra http://localhost:3000
```

**Primeiros passos no aplicativo**

1. Observe o cenário 1 (normal) em **Monitoring**.
2. Clique em **Simulate incident** (cenário 2) ou **Simulate sensor fault** (cenário 3).
3. Siga a navegação lateral: **Analysis → Response → Earth Link**.
4. Use os controles do cabeçalho para pausar ou mudar a velocidade; **Reset to nominal** recomeça.

### Scripts npm

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento em http://localhost:3000 |
| `npm run build` / `npm run start` | Build de produção / servidor de produção |
| `npm test` | Executa todos os testes automatizados uma vez |
| `npm run test:watch` | Testes em modo observação |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos das rotas e executa `tsc --noEmit` |
| `npm run generate:data` | Regenera os cenários simulados (com semente, reproduzível) |
| `npm run screenshots` | 15 capturas para apresentação → `docs/screenshots/` ¹ |
| `npm run screenshots:sequence` | Sequência de 16 quadros do Cenário 2 → `docs/screenshots/sequence-vital-deviation/` ¹ |
| `npm run screenshots:future` | 14 capturas FUTURE seguindo o roteiro de demo → `docs/screenshots/future/` (sobe o próprio servidor) ² |
| `npm run banners` | Banners do README (EN / PT) → `docs/assets/` ² |
| `npm run osdr:import -- OSD-575` | Importa um arquivo público do NASA OSDR para `src/data/osdr/` (`--list`, `--file <nome>`) ³ |
| `npm run science:check-links` | Confere todos os links da biblioteca de evidências e do OSDR nos servidores oficiais ³ |
| `python3 scripts/verify-science-sources.py` | Verificação independente de citações, integridade do arquivo, unidades e estatísticas (requer `pip install pypdf`) ³ |
| `npm run test:evidence` | Suíte completa + resultados legíveis por máquina e evidências de aceitação → `docs/test-results/` |
| `npm run test:e2e` | Verificações no navegador dos três cenários com o build de produção, com capturas (rode `npm run build` antes) ² |
| `npm run test:report` | Regenera o relatório de testes dos cenários (`docs/TEST_REPORT.md`, `docs/TEST_REPORT.pt-BR.md`) a partir dos resultados |
| `npm run generate:future` | Regenera o seed de demonstração FUTURE (diário, leituras de equipamentos) |
| `npm run future:check-refs` | Confere as referências de riscos NASA HRR dos módulos FUTURE com o índice oficial (`-- --write-snapshot` atualiza o snapshot offline) ³ |
| `npm run test:future` | Testes FUTURE unitários, de integração e de interface + resultados JSON → `docs/test-results/future/` |
| `npm run test:e2e:future` | Verificações FUTURE no navegador (F01–F05, rede cortada, recarga, exportação) contra o build de produção ² |
| `npm run test:regression` / `npm run test:e2e:regression` | Os 77 testes originais / 14 verificações de navegador dos cenários, resultados → `docs/test-results/future/regression/` |
| `npm run test:report:future` | Regenera `docs/future/TEST_REPORT.md` e `.pt-BR.md` a partir dos resultados |
| `npm run test:a11y` | Auditoria de acessibilidade (axe-core WCAG 2.2 A/AA em todas as páginas, desktop + celular + estados interativos, passagem por teclado) → `docs/ACCESSIBILITY.pt-BR.md` ² |

¹ Requer o servidor em execução (`BASE_URL`, padrão `http://localhost:3000`) e o Playwright com Chromium.
² Requer o Playwright com Chromium.
³ Requer acesso à internet aos servidores da NASA; atrás de um proxy HTTP, use o prefixo `NODE_USE_ENV_PROXY=1`.

---

## 🧪 Testes

### Relatório de testes dos cenários

Os três cenários de demonstração são testados contra um plano de testes escrito, e os resultados estão publicados em
**[docs/TEST_REPORT.pt-BR.md](docs/TEST_REPORT.pt-BR.md)** ([English](docs/TEST_REPORT.md)), gerado a partir de resultados legíveis por máquina:

| Camada | O que é executado | Evidência |
|---|---|---|
| Plano de testes | 17 casos (S1-01 … S3-06), cada um ligado a uma etapa do enunciado (MEDIR · ENTENDER · AGIR · COMUNICAR) e a um resultado esperado | [`tests/acceptance/test-plan.json`](tests/acceptance/test-plan.json) |
| Testes de aceitação | Cada caso executado de ponta a ponta no motor determinístico da missão; valores observados registrados (horários das detecções, níveis, linha do tempo das mensagens…) | [`acceptance-evidence.json`](docs/test-results/acceptance-evidence.json) |
| Verificações no navegador | 14 verificações percorrendo os três cenários no Chromium com o build de produção | [`e2e-results.json`](docs/test-results/e2e-results.json) + [capturas](docs/test-results/e2e/) |

```bash
npm run test:evidence && npm run build && npm run test:e2e && npm run test:report
```

### Testes de unidade e integração

```bash
npm test
```

**77 testes em 8 arquivos**, todos determinísticos e sem acesso à rede:

| Arquivo | O que cobre |
|---|---|
| `tests/acceptance/scenarios.acceptance.test.ts` | Os 17 casos do plano de testes: fluxo completo MEDIR → ENTENDER → AGIR → COMUNICAR de cada cenário (detecções e seus horários, escalonamento, procedimentos, confirmação, registro de ações, conteúdo do relatório, prioridade na fila e todos os estados da mensagem). |
| `tests/analysis.test.ts` | Cada regra (persistência/histerese, perda de leitura, plausibilidade, taxa de variação, qualidade, valor congelado, verificação cruzada), confiabilidade, eventos, resultados da confirmação e ausência de termos diagnósticos. |
| `tests/comms.test.ts` | Limites do atraso, ida e volta, distância percorrida pela luz, fila por ordem de chegada e por prioridade, queda do link, fixação do atraso e linha do tempo dos estados. |
| `tests/science.test.ts` | Salvaguardas: nenhuma fonte NASA de limites declarada enquanto pendente; rótulos de provisório; procedimentos sem termos de medicamento ou intervenção clínica; declaração de uso de IA exibida na página de ciência. |
| `tests/evidence.test.ts` | Biblioteca de evidências: os três temas cobertos; título, fonte, data, link do PDF e limitações presentes; apenas domínios oficiais da NASA com HTTPS; nenhum limite derivado e nenhuma alegação de aprovação da NASA; classificação de procedência. |
| `tests/osdr.test.ts` | Leitor do OSDR (casos de CSV, momentos, resumos, erros); a cópia do OSD-575 confere com o SHA-256; estatísticas iguais às de um cálculo independente em Python a partir do arquivo enviado ao OSDR; dados reais nunca importados pelos módulos da simulação. |
| `tests/ui/science.test.tsx` | Página Science & Limits: três categorias, cartões de evidência e filtro por tema, identificação da fonte do OSDR, importação de arquivo (válido, inválido, sem accession). |
| `tests/ui/modules.test.tsx` | Os quatro módulos renderizados com Testing Library: botões de incidente, achados, confirmação, registro de checklist, atalhos de atraso, geração e envio do relatório, valores não verificados de sensor suspeito. |

Com os módulos FUTURE, `npm test` executa **187 testes em 18 arquivos**: os 77 acima, sem alteração, mais 110 em `tests/future/` (veja o [relatório de testes FUTURE](docs/future/TEST_REPORT.pt-BR.md)).

### Acessibilidade

`npm run test:a11y` executa o axe-core (WCAG 2.0, 2.1 e 2.2, níveis A e AA) nas 11 páginas, em largura de desktop e de celular, e em 7 estados interativos (incidente em andamento, relatório gerado, resultado de avaliação, evento de EVA…), depois percorre cada página com Tab verificando se o foco é visível, não fica escondido sob o cabeçalho fixo e nunca fica preso. Resultado: **0 violações, 0 problemas de teclado** — veja [docs/ACCESSIBILITY.pt-BR.md](docs/ACCESSIBILITY.pt-BR.md) com os detalhes, o que foi corrigido e os limites (ainda sem sessão com leitor de tela).

Verificações executadas antes de cada commit: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

---

## 🖼 Capturas de tela e banners

Todas as imagens são capturadas da aplicação em execução (não são montagens) em quadros **16:9**, prontos para slides:

- [`docs/screenshots/`](docs/screenshots/) — 15 capturas cobrindo os três cenários e a seção Science & Limits (2880 × 1620 px).
- [`docs/screenshots/sequence-vital-deviation/`](docs/screenshots/sequence-vital-deviation/) — a sequência de 16 quadros acima, com legendas.
- [`docs/screenshots/future/`](docs/screenshots/future/README.md) — 14 capturas dos módulos FUTURE seguindo o [roteiro de demo](docs/future/DEMO_SCRIPT.pt-BR.md), incluindo uma captura de celular e uma recarga com o servidor desligado (legendas em inglês e português).
- [`docs/assets/`](docs/assets/) — banners do README em inglês e português, gerados a partir de `scripts/banner/banner.html`.

---

## ☁ Publicação (Vercel)

A aplicação pré-renderiza todas as rotas como conteúdo estático e **não precisa de variáveis de ambiente**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frecpires%2Fastrahealth)

1. Envie o repositório para o GitHub.
2. Na Vercel: **Add New… → Project → Import** do repositório.
3. Mantenha o preset **Next.js** detectado (build `next build`, Node.js 20+).
4. **Deploy.**

Pela linha de comando: `npx vercel` (prévia) e `npx vercel --prod` (produção).

---

## 🔬 Base científica e limitações

### Como os recursos científicos são utilizados

O ASTRA Health mantém três tipos de conteúdo rigorosamente separados e os identifica em toda a seção **Science & Limits**:

| Categoria | O quê | Onde no código | Usado em |
|---|---|---|---|
| 🟦 **Dados simulados** | Sinais vitais, qualidade de sinal, perdas de leitura, leitura de confirmação, confirmação da Terra | `src/data/scenarios/*.json` (gerador com semente) | Monitoramento, Análise, Resposta, Link com a Terra |
| 🟩 **Dados e evidências científicas reais** | Relatórios de evidência do NASA HRP; conjunto de dados OSD-575 do NASA OSDR | `src/data/science/nasa-hrp-evidence.json`, `src/data/osdr/` | Somente Science & Limits — contexto e exibição |
| 🟨 **Regras demonstrativas** | Faixas de referência, regras de análise, escalonamento, checklists, tempos do link | `src/config/reference-ranges.ts`, `src/lib/`, `src/data/procedures.json` | Análise, Resposta, Link com a Terra |

#### Biblioteca de evidências do NASA Human Research Program

| Tema | Relatório de evidência | Fonte · data | Links |
|---|---|---|---|
| Cardiovascular | *Evidence Report: Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes* | NASA HRP, Human Health and Countermeasures Element, JSC · liberado para divulgação pública em 15/12/2022 | [PDF](https://humanresearchroadmap.nasa.gov/evidence/reports/Cardio%20Risk%20EB%202022%20FINAL_4-3-2023.pdf) · [Risco no HRR](https://humanresearchroadmap.nasa.gov/Risks/?i=179) · [Visão geral NASA](https://www.nasa.gov/directorates/esdmd/hhp/cv-risk/) |
| Hipóxia | *Evidence Report: Risk of Reduced Crew Health and Performance Due to Decompression Sickness and Hypoxia* | NASA HRP, JSC · liberado para divulgação pública em 31/10/2023 | [PDF](https://humanresearchroadmap.nasa.gov/evidence/reports/Evidence%20Report%20Hypoxia%20and%20DCS_FINAL_1-8-2024.pdf) · [Risco no HRR](https://humanresearchroadmap.nasa.gov/Risks/?i=173) · [Visão geral NASA](https://www.nasa.gov/directorates/esdmd/hhp/risk-of-reduced-crew-health-and-performance-due-to-hypoxia/) |
| Capacidade médica | *Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions* | NASA HRP, Exploration Medical Capabilities Element, JSC · liberado para divulgação pública em 08/05/2017 | [PDF](https://humanresearchroadmap.nasa.gov/evidence/reports/Medical.pdf) · [Risco no HRR](https://humanresearchroadmap.nasa.gov/Risks/?i=95) · [NTRS](https://ntrs.nasa.gov/citations/20170004604) |

- Títulos, datas e autores foram conferidos nos PDFs do Human Research Roadmap e no NASA Technical Reports Server; as declarações de risco foram copiadas na íntegra das páginas de risco do HRR e os pontos-chave são citações literais. Última verificação em 15/11/2026 — refaça a qualquer momento com `npm run science:check-links`.
- As evidências são usadas **somente como contexto científico**. Cada item tem `derivesThresholds: false` (garantido por teste): nenhum limite, nível de alarme, regra ou checklist do ASTRA Health vem delas, e nenhum checklist é apresentado como aprovado pela NASA.
- Cada item mostra suas **limitações** no app (por exemplo, o relatório cardiovascular afirma ser inconclusivo se o voo espacial causa ou aumenta as arritmias).

#### Conjunto de dados do NASA OSDR — OSD-575

- **Estudo:** *SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (Comprehensive Metabolic Panel and Multiplex)* — público desde 14/05/2024 — [osdr.nasa.gov/bio/repo/data/studies/OSD-575](https://osdr.nasa.gov/bio/repo/data/studies/OSD-575).
- **Arquivo:** `LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv` (ALSDA Transformed Files): 4 tripulantes × 7 momentos (L-92 … R+194) × 9 biomarcadores cardiovasculares séricos.
- **Importação:** `npm run osdr:import -- OSD-575` baixa o arquivo pela API oficial do OSDR e o salva **na íntegra** em `src/data/osdr/OSD-575.json`, com accession, título, URLs do estudo e do download, data de divulgação pública, missão, publicações (DOIs), data da coleta e **SHA-256** (um teste confere). Use `--list` para ver os arquivos de um estudo e `--file <nome>` para escolher outro.
- **Importação no app:** *Science & Limits → Import another OSDR file* lê uma tabela multiplex do OSDR escolhida pelo usuário, exige o accession do OSDR e a mantém **apenas no navegador** (não é salva).
- **Separação:** os dados do OSDR ficam em `src/data/osdr/`, separados de `src/data/scenarios/`; os módulos de simulação, análise e relatório nunca os importam (testado). A página mostra **apenas estatísticas resumidas** (n, média, mínimo e máximo por momento) — sem valores por pessoa, sem faixas de referência e sem interpretação clínica.
- **Por que não há download direto no navegador:** a API do OSDR só aceita requisições de navegador vindas de `osdr.nasa.gov` (CORS); por isso a importação é feita por linha de comando ou a partir de um arquivo local.

#### Verificação

Verificado em 15/11/2026 com arquivos oficiais baixados novamente — relatório completo em
[docs/SCIENCE_VERIFICATION.md](docs/SCIENCE_VERIFICATION.md) (em inglês):

- **Links:** 17/17 respondem nos servidores oficiais (`npm run science:check-links`).
- **Textos:** títulos, datas e autores (9/9), declarações de risco (3/3) e citações (10/10) encontrados literalmente nos PDFs e nas páginas oficiais do HRR.
- **Arquivo do OSD-575:** a cópia salva é idêntica, byte a byte, a um novo download (SHA-256); os 252 valores e as 9 unidades conferem com o arquivo *enviado* pelos pesquisadores, indicado nos metadados ISA do estudo.
- **Estatísticas:** n, média, mínimo e máximo dos 63 grupos (biomarcador × momento) recalculados de forma independente em Python a partir do arquivo enviado — idênticos aos do app (maior diferença relativa de 2,1 × 10⁻¹⁶); a comparação também roda sem internet no `npm test`.
- **Controle negativo:** cópias alteradas de propósito (uma citação invertida, um dígito trocado, um erro de 0,1 % numa estatística) foram todas detectadas.
- Para refazer tudo: `python3 scripts/verify-science-sources.py` (Python 3 + `pip install pypdf`).

Esta verificação cobre a **exatidão das fontes, do arquivo e dos cálculos**. Ela **não** valida os limites do motor de
análise, que continuam provisórios (próxima seção).

#### Fonte para os limites de análise — *aguardando confirmação da equipe*

Nenhum dos recursos acima define os limites numéricos do ASTRA Health. O registro em `src/config/scientific-sources.ts`
continua reservado a uma fonte da NASA para os limites e permanece vazio até que a Equipe ANGARIS confirme o enunciado
oficial do desafio; depois da confirmação, ele deve registrar **nome, origem, URL/DOI, versão, data de acesso e utilização
efetiva** da fonte — um teste garante isso. Guia passo a passo: [docs/NASA_RESOURCE.md](docs/NASA_RESOURCE.md) (em inglês).

### Limites demonstrativos provisórios

De `src/config/reference-ranges.ts` (status **PROVISIONAL** — valores provisórios escolhidos pela equipe de desenvolvimento,
sem validação clínica e sem origem em fonte da NASA):

| Sinal vital | Referência demonstrativa | Faixa de cautela | Limites de plausibilidade | Passo máximo / 10 s |
|---|---|---|---|---|
| Frequência cardíaca | 50–100 bpm | 40–120 bpm | 25–230 bpm | 30 bpm |
| SpO₂ | 95–100 % | 90–100 % | 50–100 % | 6 % |
| Temperatura corporal | 36,0–37,5 °C | 35,5–38,0 °C | 30–43 °C | 0,6 °C |

### Principais limitações

- Todos os **sinais vitais** são **sintéticos**, produzidos por um gerador com semente (`scripts/generate-scenarios.mjs`). As únicas medições reais são os resumos do NASA OSDR em Science & Limits, que vêm de quatro astronautas privados em uma missão de 3 dias em órbita baixa e não representam missões longas a Marte.
- A biblioteca de evidências da NASA é citada como contexto; os documentos oficiais continuam sendo a fonte de referência e podem ser atualizados pela NASA.
- Regras, níveis, índices de confiabilidade e critérios de escalonamento são **escolhas demonstrativas**, sem validação clínica.
- Os procedimentos são checklists de segurança **ilustrativos**, não procedimentos de voo aprovados, e nunca incluem medicamentos ou tratamentos.
- A faixa de atraso Terra–Marte (3–22 min) vem do briefing da equipe; o atraso real depende da posição dos planetas, e o link pode ficar indisponível por longos períodos. As respostas da Terra são confirmações automáticas.
- Apenas três cenários são modelados; fisiologia e artefatos de sensor reais são muito mais variados.
- Sem autenticação, persistência, criptografia ou processos de qualidade de dispositivo médico. O estado é reiniciado ao recarregar a página.

Lista completa: [docs/SCIENTIFIC_LIMITATIONS.md](docs/SCIENTIFIC_LIMITATIONS.md) (em inglês).

---

## 🗺 Roadmap

Próximos passos possíveis (não são compromissos):

- [ ] Confirmar o enunciado do desafio e, se houver uma fonte da NASA para limites numéricos, registrá-la e derivar dela os limites.
- [ ] Revisão por especialistas das regras, do escalonamento e do texto dos checklists.
- [ ] Interface de adaptadores para sensores vestíveis reais (substituindo a reprodução dos JSON).
- [x] Registro de decisões persistente e exportável — trilha de auditoria do FUTURE 05 (prévia).
- [ ] Atraso Terra–Marte baseado em efemérides e janelas de bloqueio por conjunção solar; modelo de largura de banda.
- [x] Visão para múltiplos tripulantes — FUTURE 01 / FUTURE 05 (prévia); console do Oficial Médico ainda em aberto.
- [ ] Revisão por especialistas dos conjuntos de regras e protocolos FUTURE, com controle de mudanças.
- [x] Auditoria automática de acessibilidade (axe-core WCAG 2.2 A/AA + teclado) — [docs/ACCESSIBILITY.pt-BR.md](docs/ACCESSIBILITY.pt-BR.md).
- [x] Operação totalmente offline, inclusive recarregando sem rede (service worker).
- [ ] Interface totalmente bilíngue (EN / PT-BR) e revisão com leitor de tela.

---

## 🤖 Declaração de uso de ferramentas de IA

> *AI Tools & Usage Disclosure* — versão original em inglês no [README.md](README.md#-ai-tools--usage-disclosure).

A Equipe ANGARIS utilizou ferramentas assistidas por IA, incluindo Claude Code, Codex e ChatGPT, conforme aplicável, para apoiar o desenvolvimento de software, a revisão de código, a documentação e a preparação da apresentação.

O conceito do projeto, as decisões técnicas, os testes e a validação final são de responsabilidade da Equipe ANGARIS.

Todos os dados fisiológicos apresentados no protótipo são simulados. O ASTRA Health é uma demonstração experimental e não é um dispositivo médico clinicamente validado.

Observações adicionais:

- **Logo** — a logo do ASTRA Health é uma imagem gerada por IA. O arquivo original mantém a identificação *AI-generated* (`public/brand/astra-health-logo.png`) e aparece com ela nos banners; o emblema do cabeçalho, o ícone da aba e a imagem de compartilhamento são recortes dela.
- **Dentro do aplicativo** — nenhum modelo de IA roda na aplicação; toda a análise é determinística e baseada em regras.

Detalhes: [AI_DISCLOSURE.md](AI_DISCLOSURE.md) (em inglês).

---

## 👥 Equipe

**Equipe ANGARIS** — NASA Space Apps Challenge 2026.

| Nome | GitHub |
|---|---|
| Rodrigo Eufrásio Costa Pires | [recpires](https://github.com/recpires) |
| Vinicius Gomes Jeronimo | [vinnlacoste](https://github.com/vinnlacoste) |
| Jecika Lilia Cavalcante e Silva Saito | — |
| Diego Felippe Scorsi Prado | — |
| Yvna Marçal Sousa Rosa | — |
| Kennedy Teixeira da Silva | — |

## 📄 Licença

Distribuído sob a [Licença MIT](LICENSE) — Copyright (c) 2026 Team ANGARIS.

A licença cobre o código e a documentação escritos pela equipe. Materiais de terceiros mantêm seus próprios termos:

- **Conteúdo da NASA** — os trechos de evidências do Human Research Program e os títulos de riscos do Human Research Roadmap (`src/data/science/`, `src/data/future/`) e a cópia dos dados OSD-575 do OSDR (`src/data/osdr/`) vêm de fontes públicas da NASA, identificadas em cada registro.
- **Dependências** — Next.js, React, Recharts, Lucide e os demais pacotes npm são distribuídos sob suas próprias licenças (ícones Lucide: ISC, com os ícones derivados do Feather sob MIT).

## 🙏 Agradecimentos

- Aos organizadores e à comunidade do **NASA Space Apps Challenge**.
- Aos projetos de código aberto que tornam este protótipo possível: Next.js, React, Tailwind CSS, Recharts, Lucide, Vitest, Testing Library e Playwright.

<sub>O ASTRA Health é um projeto de hackathon. Não é afiliado à NASA nem endossado por ela. Todos os dados de sinais vitais são simulados.</sub>
