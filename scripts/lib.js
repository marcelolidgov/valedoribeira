// Utilitários compartilhados pelos scripts do agente.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const caminho = rel => path.join(ROOT, rel);
const lerJSON = (rel, padrao) => {
  const p = caminho(rel);
  if (!fs.existsSync(p)) { if (padrao !== undefined) return padrao; throw new Error(`Arquivo não encontrado: ${rel}`); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};
const salvarJSON = (rel, obj) => fs.writeFileSync(caminho(rel), JSON.stringify(obj, null, 2) + '\n');

// Minúsculas, sem acento, espaços normalizados
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const palavrasDe = s => norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(Boolean);
const contarPalavras = arr => arr.join(' ').split(/\s+/).filter(Boolean).length;

// Data de hoje no fuso de Brasília, formato AAAA-MM-DD
const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

// Proporção de palavras em comum entre dois títulos (0 a 1)
function semelhancaTitulo(a, b) {
  const A = new Set(palavrasDe(a)), B = new Set(palavrasDe(b));
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / Math.max(1, Math.min(A.size, B.size));
}

module.exports = { ROOT, caminho, lerJSON, salvarJSON, norm, palavrasDe, contarPalavras, hojeSP, semelhancaTitulo };
