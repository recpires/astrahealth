# ASTRA Health — auditoria de acessibilidade

> 🌐 [English version](ACCESSIBILITY.md)

Gerado por `scripts/a11y-audit.cjs` (`npm run test:a11y`) em 2026-11-15 · código `c87e603` · Chromium 153.0.8010.12 · axe-core 4.14.0. Resultados brutos: [a11y-results.json](test-results/a11y/a11y-results.json).

## Resumo

| Verificação | Escopo | Resultado |
|---|---|---|
| axe-core — WCAG 2.0/2.1/2.2 A + AA | 11 páginas × desktop e celular + 7 estados interativos (29) | ✅ 0 violações |
| Teclado: foco visível, sem armadilha | 11 páginas, Tab em cada uma | ✅ nenhum problema |

## axe-core por página

| Página | Desktop | Celular |
|---|---|---|
| `/` | ✅ (27 regras aprovadas) | ✅ (28 regras aprovadas) |
| `/analysis` | ✅ (26 regras aprovadas) | ✅ (27 regras aprovadas) |
| `/response` | ✅ (25 regras aprovadas) | ✅ (26 regras aprovadas) |
| `/comms` | ✅ (28 regras aprovadas) | ✅ (29 regras aprovadas) |
| `/science` | ✅ (32 regras aprovadas) | ✅ (33 regras aprovadas) |
| `/future` | ✅ (25 regras aprovadas) | ✅ (26 regras aprovadas) |
| `/future/journal` | ✅ (29 regras aprovadas) | ✅ (30 regras aprovadas) |
| `/future/assess` | ✅ (26 regras aprovadas) | ✅ (27 regras aprovadas) |
| `/future/profile` | ✅ (28 regras aprovadas) | ✅ (29 regras aprovadas) |
| `/future/eva` | ✅ (26 regras aprovadas) | ✅ (27 regras aprovadas) |
| `/future/readiness` | ✅ (27 regras aprovadas) | ✅ (28 regras aprovadas) |

## Estados interativos

| Estado | Página | axe |
|---|---|---|
| Monitoring during a vital-sign incident | `/` | ✅ |
| Analysis with active findings | `/analysis` | ✅ |
| Response with medical support and checklists | `/response` | ✅ |
| Earth Link with a generated and queued report | `/comms` | ✅ |
| FUTURE 02 assessment result with review | `/future/assess` | ✅ |
| FUTURE 04 EVA during an event | `/future/eva` | ✅ |
| FUTURE 05 with audit entries and tamper test | `/future/readiness` | ✅ |

## Teclado

| Página | Paradas de Tab verificadas | Resultado |
|---|---|---|
| `/` | 23 | ✅ |
| `/analysis` | 13 | ✅ |
| `/response` | 17 | ✅ |
| `/comms` | 20 | ✅ |
| `/science` | 49 | ✅ |
| `/future` | 33 | ✅ |
| `/future/journal` | 54 | ✅ |
| `/future/assess` | 44 | ✅ |
| `/future/profile` | 43 | ✅ |
| `/future/eva` | 37 | ✅ |
| `/future/readiness` | 31 | ✅ |

## O que foi corrigido nesta auditoria

- **Rótulo no nome (WCAG 2.5.3)** — o link do logo no cabeçalho tinha nome acessível (“ASTRA Health home”) diferente do texto visível; agora usa o texto visível.
- **Listas de definição (WCAG 1.3.1)** — marcação `<dl>` inválida em Science & Limits (cartões de evidência, fonte do OSDR), na linha do tempo das mensagens do Earth Link e no Perfil de Saúde Espacial foi reorganizada em pares termo / descrição.
- **Regiões roláveis (WCAG 2.1.1)** — tabelas largas que rolam para o lado no celular (histórico do diário, conjuntos de regras, trilha de auditoria, decisões de EVA, procedência, limites provisórios) agora são regiões rotuladas que recebem foco e podem ser roladas pelo teclado.
- **Tamanho do alvo (WCAG 2.5.8)** — as caixas de sinais de alerta da avaliação de sintomas (13 × 13 px) viraram opções de largura total com pelo menos 36 px de altura.
- **Foco visível (WCAG 2.4.7)** — campos de texto e seletores dos módulos FUTURE mostram um anel de foco, e opções em formato de botão (sintomas, sinais de alerta, notas 1–5, escolha de arquivo do OSDR) mostram o foco no rótulo visível.
- **Foco não encoberto (WCAG 2.4.11) e refluxo (1.4.10)** — no celular o cabeçalho fixo cobria mais da metade da tela; abaixo de 768 px ele agora rola junto com a página, e a partir de 768 px o `scroll-padding-top` mantém o elemento focado fora dele. A passagem por teclado agora falha se um elemento focado ficar escondido atrás de outro conteúdo (verificado com controle negativo).

## Limites

- Ferramentas automáticas encontram só parte dos problemas de acessibilidade. Não houve sessão com leitor de tela (NVDA, JAWS, VoiceOver) nem teste com pessoas com deficiência.
- Os gráficos (Recharts) são visuais; os mesmos valores aparecem em texto em cada página (valores atuais, tabelas, listas de eventos), mas os gráficos em si não têm tabela de dados alternativa.
- A interface está só em inglês.
- O contraste de cores é verificado pelo axe no que está na tela no momento da auditoria; cores usadas só em outros estados foram conferidas pelos tokens do tema (abaixo).
