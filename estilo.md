# Estilo editorial

> Este arquivo é preenchido no treino. Enquanto estiver vazio, o agente usa o padrão neutro descrito em `CLAUDE.md`.

## Linha do portal

_(a definir)_

## Tom

_(a definir: formal/informal, opinião permitida ou não, tratamento ao leitor)_

## Estrutura da matéria

_(a definir: quantos parágrafos, se há intertítulos, tamanho típico)_

## Redes sociais (regra do treino)

- Em toda matéria publicada pelos ciclos: `instagram_post: true` e `facebook: true`.
- Instagram: `legenda_instagram` recebe o primeiro parágrafo da matéria (pode ser resumido para caber em uma legenda).
- Facebook: `facebook_texto` recebe uma introdução curta que leva o leitor à página da matéria, sem copiar parágrafos.
- `instagram_storie: true` em toda matéria.
- Foto do portal em paisagem 16:9, 1200x675 (padrão do site, como nas matérias antigas, 1000x562). Não enviar foto em retrato para o portal.
- Imagem padrão do portal em 16:9: `../assets/fallback-sem-foto-16x9.jpg`.
- Foto para o Instagram: o plugin faz o próprio recorte; manter o original com boa resolução.
- Foto sempre real (pessoas, obra, local, evento). Nunca card, banner ou arte genérica de capa de blog.
- Ordem de prioridade da imagem: (1) foto da própria matéria (obra, política, saúde, pessoas, local, evento), sempre a primeira a ser buscada; (2) somente se não houver nenhuma foto real, a imagem padrão `assets/fallback-sem-foto-4x5.jpg` (logo do portal sobre fundo azul), com crédito "Imagem ilustrativa". A imagem padrão nunca substitui uma foto disponível.
- WhatsApp e grupos de WhatsApp: habilitados. Em toda matéria, `redes.whatsapp: true`.

## Exceção de fonte única (autorizada pelo usuário)

- Matéria de investigação ou de pessoa pública pode ter **fonte única** quando a reportagem for da Gazeta do Povo, com autorização do usuário.
- Mesmo assim: linguagem de apuração e suspeita ("investigado", "suspeita", "apura"), nunca acusação direta, e citação do veículo no último parágrafo.
- A regra geral do `CLAUDE.md` (duas fontes ou fonte oficial) continua valendo para os demais veículos.

## Exemplos aprovados

Matérias aprovadas em `exemplos/` servem de referência de tom. Listar aqui os arquivos mais representativos.
