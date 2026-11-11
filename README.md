# Agente autônomo de notícias

Busca notícias, reescreve com texto próprio e publica no portal, sem acompanhamento a cada matéria.
As regras do agente estão em `CLAUDE.md`. Este arquivo explica como operar.

## Estrutura

| Arquivo | Função |
|---|---|
| `CLAUDE.md` | Instruções do ciclo e regras editoriais (lido pelo Claude em cada execução) |
| `config.json` | Portal, `modo`, limite diário, limites de tamanho, termos bloqueados |
| `pautas.json` | Temas e palavras-chave (treino) |
| `fontes.json` | Feeds RSS/Atom (treino) |
| `estilo.md` | Linha editorial e tom (treino) |
| `publicadas.json` | Registro do que foi publicado (evita repetição) |
| `scripts/candidatos.js` | Lê os feeds e grava as pautas candidatas em `candidatos/` |
| `scripts/validar.js` | Confere tamanho, categoria, crédito, termos bloqueados e sobreposição com a fonte |
| `scripts/publicar.js` | Aplica as travas (pausa, modo, limite) e chama o adaptador |
| `scripts/lenium.js` | Adaptador do painel Lenium CMS v4 (preenche e, se liberado, envia) |

## Primeiros passos (antes do primeiro ciclo)

1. Preencher `config.json` → `portal.nome`, `portal.site` e `categorias`. Com `portal.site` vazio, o agente recusa publicar.
2. Definir as credenciais do painel no ambiente da sessão: `PORTAL_EMAIL` e `PORTAL_SENHA`
   (o nome vem de `portal.env_email` e `portal.env_senha`; ajustar se o portal usar outros).
3. Preencher `pautas.json`, `fontes.json` e `estilo.md`.
4. Rodar um ensaio com uma matéria de teste e conferir o print em `materias/NN-form.png`:
   `node scripts/publicar.js materias/teste.json --ensaio`
   Os seletores do painel (`scripts/lenium.js`) foram copiados do Direita Paraná e ainda não foram conferidos neste portal.
5. Só então trocar `modo` para `"publicar"`.

## Operação

```bash
node scripts/candidatos.js                                   # coletar pautas
node scripts/validar.js materias/x.json --fonte fontes_texto/x.txt   # conferir
node scripts/publicar.js materias/x.json --fonte fontes_texto/x.txt  # publicar (conforme modo)
```

**Pausar tudo:** criar um arquivo vazio `PAUSADO` na raiz do repositório (ou remover `modo` → `"ensaio"`).
**Retomar:** apagar `PAUSADO`.

**Agendar:** criar uma tarefa recorrente que execute o ciclo do `CLAUDE.md` (por exemplo, 3 vezes ao dia, nos
horários de `portal.horarios`). A tarefa precisa das variáveis de login no ambiente.

## Limites conhecidos

- Não existe revisão humana antes do envio. O que o agente publica fica no portal até alguém remover.
- Sobreposição e tamanho são checados por script. O julgamento de fato, de contexto e de tom é do modelo, e pode errar.
- Redes sociais (WhatsApp, Instagram, Facebook) dependem dos plugins do painel, que ficam fora do controle do script.
