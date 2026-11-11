// Coleta candidatas nos feeds de fontes.json, filtra por pautas.json e descarta o que já foi tratado.
// Uso: node scripts/candidatos.js
// Grava candidatos/AAAA-MM-DD.json e imprime um resumo.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { ROOT, lerJSON, norm, hojeSP, semelhancaTitulo } = require('./lib');

const cfg = lerJSON('config.json');
const pautas = lerJSON('pautas.json', { temas: [] });
const fontes = lerJSON('fontes.json', { fontes: [] }).fontes || [];
const registro = lerJSON('publicadas.json', []);

const decode = s => s
  .replace(/<!\[CDATA\[|\]\]>/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

const campo = (bloco, tag) => {
  const m = bloco.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? decode(m[1]) : '';
};

// Lê RSS (<item>) e Atom (<entry>)
function itens(xml) {
  return (xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || []).map(b => ({
    titulo: campo(b, 'title'),
    link: campo(b, 'link') || ((b.match(/<link[^>]*href="([^"]+)"/) || [])[1] || ''),
    data: campo(b, 'pubDate') || campo(b, 'updated') || campo(b, 'published'),
    resumo: (campo(b, 'description') || campo(b, 'summary')).slice(0, 600),
  })).filter(i => i.titulo && i.link);
}

// curl (e não fetch) porque o curl respeita HTTPS_PROXY, e o fetch nativo do Node não respeita
function baixar(fonte) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sSL', '--fail', '--max-time', '20', '-A', cfg.portal.user_agent || 'NoticiasAgente/1.0', fonte.feed],
      { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
        if (err) return reject(new Error(`falha ao baixar (${err.message.split('\n')[0]})`));
        resolve(itens(stdout).map(i => ({ ...i, veiculo: fonte.nome })));
      });
  });
}

const jaTratada = i => registro.some(r => {
  if (r.link_original && norm(r.link_original) === norm(i.link)) return true;
  const recente = Date.now() - new Date(r.data).getTime() < cfg.dias_sem_repetir * 864e5;
  return recente && semelhancaTitulo(r.titulo, i.titulo) >= 0.6; // mesma pauta com outro link
});

(async () => {
  const erros = [], todas = [];
  for (const f of fontes) {
    try { todas.push(...await baixar(f)); } catch (e) { erros.push(`${f.nome}: ${e.message}`); }
  }

  const vistos = new Set(), candidatas = [];
  for (const i of todas) {
    if (vistos.has(norm(i.link))) continue;
    vistos.add(norm(i.link));
    if (jaTratada(i)) continue;
    const texto = norm(i.titulo + ' ' + i.resumo);
    const tema = pautas.temas.find(t =>
      (t.palavras || []).some(p => texto.includes(norm(p))) &&
      !(t.excluir || []).some(p => texto.includes(norm(p))));
    if (tema) candidatas.push({ ...i, tema: tema.nome });
  }

  const lista = candidatas.slice(0, cfg.max_candidatos);
  const saida = `candidatos/${hojeSP()}.json`;
  fs.mkdirSync(path.join(ROOT, 'candidatos'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, saida), JSON.stringify(lista, null, 2) + '\n');

  console.log(`Feeds: ${fontes.length} · itens lidos: ${todas.length} · candidatas após pautas e sem repetição: ${candidatas.length} · gravadas: ${lista.length}`);
  console.log(`Arquivo: ${saida}`);
  if (fontes.length === 0) console.log('Aviso: fontes.json está vazio. Nada foi coletado por RSS; usar busca na web conforme CLAUDE.md.');
  if (erros.length) console.log('Falhas de feed:\n- ' + erros.join('\n- '));
})();
