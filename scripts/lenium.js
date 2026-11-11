// Adaptador do painel Lenium CMS v4. Lógica derivada do agente do Direita Paraná (marcelolidgov/direita).
// ATENÇÃO: os seletores ainda não foram testados contra o painel deste portal. Na primeira vez,
// rodar em ensaio e conferir o print em materias/NN-form.png antes de liberar o modo "publicar".
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { lerJSON, hojeSP } = require('./lib');

const cfg = lerJSON('config.json');
const P = cfg.portal;
const ADMIN = P.site + '/admin/index.php';
const HOST = new URL(P.site).hostname.replace(/^www\./, '');

// Navegador que só acessa o domínio do portal (scripts de terceiros travam o carregamento)
async function abrir() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: P.user_agent, viewport: { width: 1400, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  await ctx.route('**/*', r => {
    const h = new URL(r.request().url()).hostname;
    return (h === HOST || h.endsWith('.' + HOST)) ? r.continue() : r.abort();
  });
  ctx.setDefaultTimeout(60000);
  return { browser, page: await ctx.newPage() };
}

async function login(page) {
  const email = (process.env[P.env_email] || '').trim();
  const senha = process.env[P.env_senha] || '';
  if (!email || !senha) throw new Error(`Variáveis ${P.env_email} / ${P.env_senha} não definidas no ambiente`);
  await page.goto(P.site + '/admin/', { waitUntil: 'domcontentloaded' });
  if (await page.$('input[name=password]')) {
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', senha);
    await page.click('input[type=submit]', { noWaitAfter: true });
    await page.waitForSelector('a[href*="logout.php"]', { state: 'attached' });
  }
  if (await page.$('input[name=password]')) throw new Error('Login falhou');
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function montaHtml(blocos) {
  return blocos.map(b => {
    const img = b.match(/^!\[(.*)\]\((https?:\/\/\S+)\)$/);
    if (img) return `<p style="text-align:center"><img src="${img[2]}" alt="${esc(img[1])}" style="max-width:100%;height:auto"></p>`;
    return b.startsWith('## ') ? `<p><strong>${esc(b.slice(3))}</strong></p>` : `<p>${esc(b)}</p>`;
  }).join('\n');
}

function agoraSP() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
}
const maisDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// Horários já ocupados no painel (inclusive agendados)
async function horariosOcupados(page) {
  const ocup = new Set();
  for (let p = 1; p <= 2; p++) {
    await page.goto(`${ADMIN}?pg=noticias_lista&p=${p}`, { waitUntil: 'domcontentloaded' });
    const linhas = await page.$$eval('table tr', trs => trs.map(t => t.innerText));
    for (const t of linhas) {
      const r = t.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
      if (r && !/Rascunho/.test(t)) ocup.add(`${r[3]}-${r[2]}-${r[1]} ${+r[4]}`);
    }
  }
  return ocup;
}

function proximoHorario(ocup) {
  const { data, min } = agoraSP();
  for (let d = 0; d < 7; d++) {
    const dia = maisDias(data, d);
    for (const h of P.horarios) {
      if (d === 0 && h * 60 <= min + 15) continue; // folga mínima de 15 min
      if (!ocup.has(`${dia} ${h}`)) return { data: dia, hora: h, minuto: 0 };
    }
  }
  throw new Error('Nenhum horário livre nos próximos 7 dias');
}

async function baixarFoto(m, dirMat, nome) {
  if (!m.foto) return null;
  if (m.foto.arquivo) return path.resolve(dirMat, m.foto.arquivo);
  const destino = path.join(dirMat, `${nome}.jpg`);
  const r = await fetch(m.foto.url, { headers: { 'user-agent': P.user_agent } });
  if (!r.ok) throw new Error(`foto: HTTP ${r.status}`);
  fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  return destino;
}

// Preenche o formulário. Só envia se publicar === true.
// Retorna { url, ag } com o link final quando enviado.
async function enviar(m, { publicar, arq }) {
  const dirMat = path.dirname(arq);
  const nome = path.basename(arq, '.json');
  const { browser, page } = await abrir();
  try {
    await login(page);

    let ag = m.agendamento;
    if (ag === 'agora') {
      const { data, min } = agoraSP();
      ag = { data, hora: Math.floor(min / 60), minuto: min % 60 };
    } else if (!ag) {
      ag = proximoHorario(await horariosOcupados(page));
    }
    console.log(`Agendamento: ${ag.data} ${String(ag.hora).padStart(2, '0')}:${String(ag.minuto || 0).padStart(2, '0')}`);

    const foto = await baixarFoto(m, dirMat, nome);

    await page.goto(`${ADMIN}?pg=noticias`, { waitUntil: 'domcontentloaded' });
    const f = 'form[enctype="multipart/form-data"]';
    await page.selectOption(`${f} select[name=id_cat]`, { label: m.categoria });
    await page.selectOption(`${f} select[name=destino]`, { label: m.destaque });
    await page.fill(`${f} input[name=chapeu]`, m.chapeu);
    await page.fill(`${f} input[name=fonte]`, m.fonte || '');
    await page.fill(`${f} input[name=titulo]`, m.titulo);
    await page.fill(`${f} input[name=subtitulo]`, m.subtitulo);
    await page.fill(`${f} textarea[name=texto]`, montaHtml(m.texto));
    if (foto) {
      await page.setInputFiles(`${f} input[name=foto]`, foto);
      await page.fill(`${f} input[name=descricao_foto]`, (m.foto && m.foto.credito) || '');
    }
    await page.fill(`${f} input[name=data]`, ag.data);
    await page.fill(`${f} input[name=hora]`, String(ag.hora));
    await page.fill(`${f} input[name=minuto]`, String(ag.minuto || 0));
    await page.fill(`${f} input[name=segundo]`, '0');

    // Redes: campos dos plugins (preenchidos via jQuery no painel real)
    const r = m.redes || {};
    const ids = P.plugins_id || {};
    await page.evaluate(({ sel, r }) => {
      const form = document.querySelector(sel);
      const add = (name, value, tag = 'input') => {
        const el = document.createElement(tag);
        if (tag === 'input') el.type = 'hidden';
        el.name = name; el.value = value; el.className = 'campo-agente';
        form.appendChild(el);
      };
      if (r.whatsapp) add('whatsapp_post', 'S');
      if (r.instagram_post) { add('instagram_post', 'S'); add('legenda_instagram', r.legenda_instagram || '', 'textarea'); }
      if (r.instagram_storie) add('instagram_storie', 'S');
      if (r.facebook) { add('facebook_post', 'S'); add('facabook_push_txt', r.facebook_texto || ''); }
    }, { sel: f, r });

    await page.screenshot({ path: path.join(dirMat, `${nome}-form.png`), fullPage: true });
    const resumo = await page.$$eval(`${f} [name]`, els => els
      .filter(e => !['token', 'texto', 'legenda_instagram'].includes(e.name) && e.type !== 'file')
      .map(e => `${e.name}=${(e.tagName === 'SELECT' ? e.selectedOptions[0]?.text : e.value || '').slice(0, 90)}`));
    console.log(resumo.join('\n'));

    if (!publicar) return { url: null, ag };

    await Promise.all([page.waitForLoadState('domcontentloaded'), page.click(`${f} input[type=submit]`)]);
    await page.waitForTimeout(2000);
    const msg = await page.$eval('.msg-form', e => e.innerText).catch(() => '');
    if (!/sucesso/i.test(msg)) throw new Error(`Painel não confirmou o cadastro: "${msg.trim() || '(sem mensagem)'}"`);
    await page.screenshot({ path: path.join(dirMat, `${nome}-enviado.png`), fullPage: false });

    await page.goto(`${ADMIN}?pg=noticias_lista`, { waitUntil: 'domcontentloaded' });
    const link = await page.$$eval('table tr', (trs, t) => {
      const tr = trs.find(x => x.innerText.includes(t));
      return tr ? tr.querySelector('a')?.href || '' : null;
    }, m.titulo);
    if (link === null) throw new Error('Notícia não encontrada na lista após o envio');
    return { url: link, ag };
  } finally {
    await browser.close();
  }
}

module.exports = { enviar };
