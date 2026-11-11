// Varre as contas de fontes_instagram.json pela API oficial (Business Discovery) e grava candidatas
// no mesmo formato de candidatos/. O token não fica no código: o proxy da rede injeta a autorização
// nas chamadas a graph.facebook.com.
// Uso: node scripts/instagram.js [--horas 48]
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');
const { ROOT, lerJSON, hojeSP } = require('./lib');

const IG_BUSINESS_ID = (lerJSON('fontes_instagram.json', {}) || {}).ig_business_id || process.env.IG_BUSINESS_ID;
const API = 'https://graph.facebook.com/v21.0';
const args = process.argv.slice(2);
const iHoras = args.indexOf('--horas');
const horas = iHoras >= 0 ? Number(args[iHoras + 1]) : 48;

// Filtro determinístico (primeira triagem). A leitura final, de notícia ou publicidade, é feita pelo agente.
const FILTRO = lerJSON('fontes_instagram.json', {}).filtro || {};
const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function passaFiltro(caption) {
  const t = norm(caption);
  if ((FILTRO.publicidade || []).some(p => t.includes(norm(p)))) return false;
  if ((FILTRO.sensacionalismo || []).some(p => t.includes(norm(p)))) return false;
  return (FILTRO.temas || []).some(p => t.includes(norm(p)));
}

// Usa curl (como candidatos.js), porque o fetch do Node não passa pelo proxy da rede.
function chamar(params) {
  const url = new URL(API + '/' + IG_BUSINESS_ID);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sS', '--max-time', '30', '-w', '\n%{http_code}', url.toString()], { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(new Error('curl: ' + err.message.split('\n')[0]));
      const corpo = stdout.slice(0, stdout.lastIndexOf('\n'));
      const status = Number(stdout.slice(stdout.lastIndexOf('\n') + 1));
      let j; try { j = JSON.parse(corpo); } catch { return reject(new Error('resposta inválida, HTTP ' + status)); }
      if (status >= 400 || j.error) return reject(new Error(j.error ? j.error.message : 'HTTP ' + status));
      resolve(j);
    });
  });
}

(async () => {
  if (!IG_BUSINESS_ID) { console.error('Defina ig_business_id em fontes_instagram.json.'); process.exit(1); }
  const contas = lerJSON('fontes_instagram.json', { contas: [] }).contas || [];
  const corte = Date.now() - horas * 3600 * 1000;
  const lista = [], erros = [];

  for (const c of contas) {
    try {
      const j = await chamar({
        fields: `business_discovery.username(${c.usuario}){username,media.limit(10){caption,permalink,timestamp,media_type,media_url,thumbnail_url}}`,
      });
      const midias = (j.business_discovery && j.business_discovery.media && j.business_discovery.media.data) || [];
      for (const m of midias) {
        if (Date.parse(m.timestamp) < corte || !m.caption) continue;
        if (!passaFiltro(m.caption)) continue;
        const linhas = m.caption.split('\n').map(s => s.trim()).filter(Boolean);
        lista.push({
          veiculo: c.nome,
          titulo: linhas[0].slice(0, 110),
          resumo: linhas.slice(1).join(' ').slice(0, 800),
          texto_integral: m.caption,
          link: m.permalink,
          data: m.timestamp,
          tipo_midia: m.media_type,
          imagem: m.media_type === 'VIDEO' ? (m.thumbnail_url || null) : (m.media_url || null),
        });
      }
    } catch (e) {
      erros.push(`${c.nome} (@${c.usuario}): ${e.message}`);
    }
  }

  const saida = `candidatos/instagram-${hojeSP()}.json`;
  fs.mkdirSync(path.join(ROOT, 'candidatos'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, saida), JSON.stringify(lista, null, 2) + '\n');
  console.log(`Contas: ${contas.length} · posts recentes gravados: ${lista.length} · arquivo: ${saida}`);
  if (erros.length) console.log('Falhas:\n- ' + erros.join('\n- '));
})();
