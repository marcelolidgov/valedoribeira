// Confere uma matéria antes de qualquer envio ao portal.
// Uso: node scripts/validar.js materias/NN-slug.json [--fonte fontes_texto/slug.txt]
// --fonte: texto integral da matéria original, salvo pelo agente, para medir sobreposição.
const fs = require('fs');
const { lerJSON, norm, palavrasDe, contarPalavras } = require('./lib');

const cfg = lerJSON('config.json');

function validar(m, fonteTxt) {
  const erros = [], avisos = [];

  for (const c of ['chapeu', 'categoria', 'destaque', 'fonte', 'titulo', 'subtitulo', 'texto', 'link_original']) {
    if (!m[c] || (Array.isArray(m[c]) && m[c].length === 0)) erros.push(`campo obrigatório ausente: ${c}`);
  }
  if (m.titulo && m.titulo.length > 110) erros.push(`título com ${m.titulo.length} caracteres (máximo 110)`);
  if (m.subtitulo && m.subtitulo.length > 220) erros.push(`linha fina com ${m.subtitulo.length} caracteres (máximo 220)`);

  const texto = (m.texto || []).filter(p => !p.startsWith('## '));
  const n = contarPalavras(texto);
  if (n < cfg.min_palavras) erros.push(`texto com ${n} palavras (mínimo ${cfg.min_palavras})`);
  if (n > cfg.max_palavras) erros.push(`texto com ${n} palavras (máximo ${cfg.max_palavras})`);

  if (cfg.categorias.length && !cfg.categorias.includes(m.categoria)) erros.push(`categoria "${m.categoria}" não está na lista de categorias do painel`);
  if (cfg.destaques.length && !cfg.destaques.includes(m.destaque)) erros.push(`destaque "${m.destaque}" não existe`);

  // Matéria de outro veículo: crédito obrigatório no último parágrafo
  const ultimo = (m.texto || []).slice(-1)[0] || '';
  if (m.fonte && m.fonte !== cfg.portal.nome && !(/^Com informações d[aoe]s? /.test(ultimo) && ultimo.includes(m.fonte))) {
    erros.push(`último parágrafo deve ser "Com informações de/da ${m.fonte}."`);
  }

  const todoTexto = norm((m.titulo || '') + ' ' + (m.subtitulo || '') + ' ' + texto.join(' '));
  const bloqueados = (cfg.termos_bloqueados || []).filter(t => todoTexto.includes(norm(t)));
  if (bloqueados.length) erros.push(`termos bloqueados (acusação direta sem base; usar "suspeito"/"investigado"): ${bloqueados.join(', ')}`);

  if (fonteTxt) {
    const K = 6;
    const gramas = t => {
      const w = palavrasDe(t), s = new Set();
      for (let i = 0; i + K <= w.length; i++) s.add(w.slice(i, i + K).join(' '));
      return s;
    };
    const fg = gramas(fonteTxt), mg = gramas(texto.join(' '));
    const taxa = [...mg].filter(g => fg.has(g)).length / Math.max(1, mg.size);
    const pct = (taxa * 100).toFixed(1);
    if (taxa > cfg.max_sobreposicao) erros.push(`sobreposição de ${pct}% com a fonte em sequências de 6 palavras (máximo ${cfg.max_sobreposicao * 100}%): reescrever com texto próprio`);
    else avisos.push(`sobreposição com a fonte: ${pct}%`);
  } else {
    avisos.push('sem --fonte: sobreposição com a matéria original não foi conferida');
  }

  return { ok: erros.length === 0, erros, avisos, palavras: n };
}

if (require.main === module) {
  const arq = process.argv[2];
  if (!arq) { console.error('Uso: node scripts/validar.js materias/x.json [--fonte arquivo.txt]'); process.exit(1); }
  const i = process.argv.indexOf('--fonte');
  const fonteTxt = i >= 0 ? fs.readFileSync(process.argv[i + 1], 'utf8') : null;
  const m = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const r = validar(m, fonteTxt);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

module.exports = { validar };
