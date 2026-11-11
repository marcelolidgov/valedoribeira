// Publica uma matéria já redigida, com as travas do agente:
//   1. arquivo PAUSADO na raiz -> não faz nada
//   2. portal.site vazio -> recusa
//   3. validação (scripts/validar.js) -> reprova e não envia
//   4. limite diário (config.limite_diario) -> não envia além do limite
//   5. modo: só envia se config.modo === "publicar" e não houver --ensaio
// Uso: node scripts/publicar.js materias/NN-slug.json [--fonte fontes_texto/slug.txt] [--ensaio]
const fs = require('fs');
const path = require('path');
const { ROOT, lerJSON, salvarJSON, hojeSP } = require('./lib');
const { validar } = require('./validar');

const cfg = lerJSON('config.json');
const args = process.argv.slice(2);
const arq = args.find(a => a.endsWith('.json'));
const iFonte = args.indexOf('--fonte');
const fonteTxt = iFonte >= 0 ? fs.readFileSync(args[iFonte + 1], 'utf8') : null;
const ensaio = args.includes('--ensaio') || cfg.modo !== 'publicar';

(async () => {
  if (!arq) { console.error('Uso: node scripts/publicar.js materias/x.json [--fonte arquivo.txt] [--ensaio]'); process.exit(1); }
  if (fs.existsSync(path.join(ROOT, 'PAUSADO'))) { console.log('Agente pausado (arquivo PAUSADO existe). Nada foi feito.'); return; }
  if (!cfg.portal.site) { console.error('config.json: portal.site está vazio. Configurar o portal antes de publicar.'); process.exit(1); }

  const m = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const v = validar(m, fonteTxt);
  if (!v.ok) { console.error('Reprovada na validação:\n- ' + v.erros.join('\n- ')); process.exit(2); }
  v.avisos.forEach(a => console.log('aviso: ' + a));

  const registro = lerJSON('publicadas.json', []);
  const hoje = hojeSP();
  const feitasHoje = registro.filter(r => r.dia === hoje).length;
  if (!ensaio && feitasHoje >= cfg.limite_diario) {
    console.log(`Limite diário atingido (${feitasHoje}/${cfg.limite_diario}). Matéria guardada para o próximo ciclo.`);
    return;
  }

  const { enviar } = require('./lenium');
  const res = await enviar(m, { publicar: !ensaio, arq });

  if (ensaio) { console.log('[ensaio] Formulário preenchido. NADA foi enviado.'); return; }

  registro.push({
    titulo: m.titulo,
    link_original: m.link_original,
    fonte: m.fonte,
    dia: hoje,
    data: new Date().toISOString(),
    status: 'publicada',
    url_site: res.url,
    agendamento: res.ag,
  });
  salvarJSON('publicadas.json', registro);
  console.log('Publicada:', res.url);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
