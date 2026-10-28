/**
 * Teste de integração ponta-a-ponta — roda 100% local com SQLite.
 * NÃO usa o banco de produção. Cada execução recria o schema do zero
 * (SQLite em arquivo temporário) e exercita TODAS as rotas da API.
 *
 *   node scripts/testeIntegracao.js
 *
 * Sai com código 0 se tudo passar, 1 se qualquer asserção falhar.
 */

const os = require("os");
const path = require("path");
const fs = require("fs");
const http = require("http");

// ------------------------------------------------------------------
// Ambiente de teste — precisa ser definido ANTES de exigir a app.
// dotenv não sobrescreve variáveis já existentes, então isto vence o .env.
// ------------------------------------------------------------------
const TMP_DB = path.join(
  os.tmpdir(),
  `teste-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
);

process.env.SKIP_DB_INIT = "true";
process.env.DB_DIALECT = "sqlite";
process.env.DB_STORAGE = TMP_DB;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "teste-secret-nao-usar-em-producao";
process.env.JWT_EXPIRES_IN = "1h";
process.env.FRONTEND_URL = "";
process.env.LOGIN_RATELIMIT_MAX = "5";
process.env.LOGIN_RATELIMIT_WINDOW_MIN = "15";

const app = require("../src/app");
const sequelize = require("../src/database");
const User = require("../models/User");
const Return = require("../models/Return");
const Evento = require("../models/Evento");

// ------------------------------------------------------------------
// mini-framework de asserção
// ------------------------------------------------------------------
let passes = 0;
let fails = 0;
const falhas = [];

function ok(cond, label) {
  if (cond) {
    passes++;
    console.log(`  ✅ ${label}`);
  } else {
    fails++;
    falhas.push(label);
    console.log(`  ❌ ${label}`);
  }
}

function eq(actual, expected, label) {
  ok(
    actual === expected,
    `${label} (esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)})`
  );
}

function section(t) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`);
}

// ------------------------------------------------------------------
// cliente HTTP
// ------------------------------------------------------------------
let baseUrl;

function req(method, pathname, { token, body, raw, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const payload =
      raw !== undefined
        ? raw
        : body !== undefined
        ? JSON.stringify(body)
        : null;

    const h = { ...headers };
    if (payload && !h["Content-Type"]) h["Content-Type"] = "application/json";
    if (payload) h["Content-Length"] = Buffer.byteLength(payload);
    if (token) h["Authorization"] = `Bearer ${token}`;

    const r = http.request(
      { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: h },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          let json = null;
          try {
            json = JSON.parse(buf.toString("utf8"));
          } catch {
            /* resposta não-JSON (ex.: PDF) */
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json,
            buffer: buf,
            text: buf.toString("utf8"),
          });
        });
      }
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// multipart/form-data com um único arquivo
function multipartFile(fieldName, filename, contentBuffer, contentType = "text/csv") {
  const boundary = "----iptest" + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    body: Buffer.concat([head, contentBuffer, tail]),
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
  };
}

// ------------------------------------------------------------------
// seeds
// ------------------------------------------------------------------
async function seed() {
  // admin (senha passa pelo hook → vira bcrypt)
  const admin = await User.create({
    id: "admin-0000-0000-0000-000000000001",
    user: "admin.teste",
    password: "senhaAdmin123",
    token: "adm",
    name: "Admin Teste",
    cpf: "00000000000",
    email: "admin@teste.local",
    data_cadastro: "2025-01-01",
    valor_aportado: 0,
    percentual_contrato: 0,
  });

  // cliente LEGADO com senha em texto puro (hooks:false = não faz hash)
  const legado = await User.create(
    {
      id: "user-0000-0000-0000-000000000002",
      user: "legado.teste",
      password: "123456",
      token: "user",
      name: "Cliente Legado",
      cpf: "11111111111",
      email: "legado@teste.local",
      data_cadastro: "2025-02-01",
      valor_aportado: 10000,
      percentual_contrato: 3,
    },
    { hooks: false }
  );

  return { admin, legado };
}

// ------------------------------------------------------------------
// suíte
// ------------------------------------------------------------------
async function run() {
  console.log(`\n🗄  SQLite temporário: ${TMP_DB}`);

  await sequelize.sync({ force: true });
  const { legado } = await seed();

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`🌐 servidor de teste em ${baseUrl}`);

  let adminToken = "";
  let legadoToken = "";
  let novoClienteId = "";

  // ---------------------------------------------------------------
  section("Infra / health");
  {
    const h = await req("GET", "/health");
    eq(h.status, 200, "GET /health → 200");
    ok(h.json?.config?.JWT_SECRET === true, "/health: JWT_SECRET presente");

    const root = await req("GET", "/");
    eq(root.status, 200, "GET / → 200");
    eq(root.json?.status, "ok", "GET / status ok");
  }

  // ---------------------------------------------------------------
  section("Autenticação");
  {
    const bad = await req("POST", "/users/login", {
      body: { user: "admin.teste", password: "errada" },
    });
    eq(bad.status, 401, "login senha errada → 401");

    const nouser = await req("POST", "/users/login", {
      body: { user: "naoexiste", password: "x" },
    });
    eq(nouser.status, 401, "login usuário inexistente → 401");

    const adm = await req("POST", "/users/login", {
      body: { user: "admin.teste", password: "senhaAdmin123" },
    });
    eq(adm.status, 200, "login admin correto → 200");
    ok(typeof adm.json?.accessToken === "string", "login admin devolve accessToken");
    eq(adm.json?.token, "adm", "login admin role=adm");
    ok(adm.json?.password === undefined, "login admin não vaza password");
    adminToken = adm.json.accessToken;

    // cliente legado: primeiro login migra a senha para bcrypt
    const l1 = await req("POST", "/users/login", {
      body: { user: "legado.teste", password: "123456" },
    });
    eq(l1.status, 200, "login cliente legado (texto puro) → 200");
    legadoToken = l1.json.accessToken;

    await legado.reload();
    ok(
      User.isBcryptHash(legado.password),
      "senha do cliente legado migrada para bcrypt após 1º login"
    );

    const l2 = await req("POST", "/users/login", {
      body: { user: "legado.teste", password: "123456" },
    });
    eq(l2.status, 200, "2º login do cliente legado (já bcrypt) → 200");

    const l3 = await req("POST", "/users/login", {
      body: { user: "legado.teste", password: "outra" },
    });
    eq(l3.status, 401, "login cliente legado com senha errada → 401");

  }

  // ---------------------------------------------------------------
  section("Autorização (/users)");
  {
    const semToken = await req("GET", "/users");
    eq(semToken.status, 401, "GET /users sem token → 401");

    const comCliente = await req("GET", "/users", { token: legadoToken });
    eq(comCliente.status, 403, "GET /users com token de cliente → 403");

    const comAdmin = await req("GET", "/users", { token: adminToken });
    eq(comAdmin.status, 200, "GET /users com token admin → 200");
    ok(Array.isArray(comAdmin.json), "GET /users devolve array");
    ok(
      comAdmin.json.every((u) => u.password === undefined),
      "GET /users nunca inclui password"
    );

    const me = await req("GET", "/users/me", { token: legadoToken });
    eq(me.status, 200, "GET /users/me (cliente) → 200");
    eq(me.json?.id, legado.id, "GET /users/me devolve o próprio usuário");
    ok(me.json?.password === undefined, "GET /users/me não vaza password");
    ok(
      "onboarding_versao" in me.json,
      "GET /users/me traz onboarding_versao"
    );
    eq(me.json?.onboarding_versao, null, "onboarding_versao começa null");
  }

  // ---------------------------------------------------------------
  section("Onboarding (POST /users/me/onboarding)");
  {
    const semToken = await req("POST", "/users/me/onboarding", {
      body: { versao: "1" },
    });
    eq(semToken.status, 401, "POST /users/me/onboarding sem token → 401");

    const marcou = await req("POST", "/users/me/onboarding", {
      token: legadoToken,
      body: { versao: "1" },
    });
    eq(marcou.status, 200, "POST /users/me/onboarding → 200");
    eq(marcou.json?.onboarding_versao, "1", "devolve a versão gravada");

    const meDepois = await req("GET", "/users/me", { token: legadoToken });
    eq(
      meDepois.json?.onboarding_versao,
      "1",
      "onboarding_versao persistido no /users/me"
    );

    // idempotente
    const denovo = await req("POST", "/users/me/onboarding", {
      token: legadoToken,
      body: { versao: "1" },
    });
    eq(denovo.status, 200, "POST /users/me/onboarding de novo → 200 (idempotente)");
  }

  // ---------------------------------------------------------------
  section("Cadastro de cliente (POST /users)");
  {
    const clienteOk = {
      id: "user-0000-0000-0000-000000000003",
      user: "novo.cliente",
      password: "654321",
      token: "user",
      name: "Novo Cliente",
      cpf: "22222222222",
      email: "novo@teste.local",
      data_cadastro: "2025-03-01",
      valor_aportado: 50000,
      percentual_contrato: 4.5,
    };

    const criar = await req("POST", "/users", { token: adminToken, body: clienteOk });
    eq(criar.status, 200, "POST /users cliente válido → 200");
    ok(criar.json?.success === true, "POST /users success:true");
    ok(criar.json?.user?.password === undefined, "POST /users não devolve password");
    novoClienteId = criar.json.user.id;

    const dup = await req("POST", "/users", {
      token: adminToken,
      body: { ...clienteOk, id: "user-dup", user: "outro.user", email: "outro@teste.local" },
    });
    eq(dup.status, 409, "POST /users CPF duplicado → 409");

    const semNumeros = await req("POST", "/users", {
      token: adminToken,
      body: {
        id: "user-0000-0000-0000-000000000004",
        user: "sem.numeros",
        password: "111111",
        token: "user",
        name: "Sem Numeros",
        cpf: "33333333333",
        email: "semnum@teste.local",
        data_cadastro: "2025-03-02",
        valor_aportado: "",
        percentual_contrato: "",
      },
    });
    eq(semNumeros.status, 200, "POST /users com numéricos em branco → 200 (usa default)");

    const comoCliente = await req("POST", "/users", {
      token: legadoToken,
      body: { ...clienteOk, id: "x", user: "y", cpf: "9", email: "z@z.z" },
    });
    eq(comoCliente.status, 403, "POST /users como cliente → 403");
  }

  // ---------------------------------------------------------------
  section("Edição / exclusão de usuário");
  {
    const upd = await req("PUT", `/users/${novoClienteId}`, {
      token: adminToken,
      body: { name: "Novo Cliente Editado", valor_aportado: 60000 },
    });
    eq(upd.status, 200, "PUT /users/:id → 200");
    eq(upd.json?.user?.name, "Novo Cliente Editado", "PUT /users aplica alteração");

    const updNaoExiste = await req("PUT", "/users/nao-existe", {
      token: adminToken,
      body: { name: "x" },
    });
    eq(updNaoExiste.status, 404, "PUT /users/:id inexistente → 404");
  }

  // ---------------------------------------------------------------
  section("Rendimentos (/returns)");
  let dataRend = "2025-03-10";
  {
    const semCampos = await req("POST", `/returns/${novoClienteId}`, {
      token: adminToken,
      body: { data: dataRend },
    });
    eq(semCampos.status, 400, "POST /returns sem campos obrigatórios → 400");

    const criar = await req("POST", `/returns/${novoClienteId}`, {
      token: adminToken,
      body: { data: dataRend, percentual: 0.5, variacao: 0.1, rendimento: 250.75 },
    });
    eq(criar.status, 201, "POST /returns válido → 201");

    const criar2 = await req("POST", `/returns/${novoClienteId}`, {
      token: adminToken,
      body: { data: "2025-03-11", percentual: 0.3, variacao: -0.2, rendimento: 120 },
    });
    eq(criar2.status, 201, "POST /returns 2º lançamento → 201");

    const comoCliente = await req("POST", `/returns/${novoClienteId}`, {
      token: legadoToken,
      body: { data: "2025-03-12", percentual: 1, variacao: 1, rendimento: 1 },
    });
    eq(comoCliente.status, 403, "POST /returns como cliente → 403");

    const listaAdmin = await req("GET", `/returns/${novoClienteId}`, { token: adminToken });
    eq(listaAdmin.status, 200, "GET /returns/:id (admin) → 200");
    eq(listaAdmin.json?.length, 2, "GET /returns devolve os 2 lançamentos");

    const listaDono = await req("GET", `/returns/${legado.id}`, { token: legadoToken });
    eq(listaDono.status, 200, "GET /returns/:id do próprio cliente → 200");

    const listaOutro = await req("GET", `/returns/${novoClienteId}`, { token: legadoToken });
    eq(listaOutro.status, 403, "GET /returns/:id de outro cliente → 403");

    const duplicado = await req("POST", `/returns/${novoClienteId}`, {
      token: adminToken,
      body: { data: dataRend, percentual: 9, variacao: 9, rendimento: 9 },
    });
    eq(duplicado.status, 409, "POST /returns no mesmo dia de outro lançamento → 409");
    ok(/10\/03\/2025/.test(duplicado.json?.error || ""), "409 explica qual dia já tem rendimento");

    const upd = await req("PUT", `/returns/${novoClienteId}/${dataRend}`, {
      token: adminToken,
      body: { percentual: 0.6, variacao: 0.15, rendimento: 300 },
    });
    eq(upd.status, 200, "PUT /returns/:id/:date (formato antigo, pela data) → 200");

    // pelo id: edita exatamente aquele lançamento, inclusive a data
    const [r10, r11] = listaAdmin.json;
    const updId = await req("PUT", `/returns/${novoClienteId}/${r11.id}`, {
      token: adminToken,
      body: { data: "2025-03-14", percentual: 0.4, variacao: 0.1, rendimento: 130 },
    });
    eq(updId.status, 200, "PUT /returns/:id/:returnId → 200");
    const r11Depois = await Return.findByPk(r11.id);
    eq(JSON.stringify([r11Depois.data, r11Depois.rendimento]), '["2025-03-14",130]',
      "PUT pelo id muda data e valor do lançamento certo");
    eq((await Return.findByPk(r10.id)).rendimento, 300, "PUT pelo id não mexe no outro lançamento");

    const dataOcupada = await req("PUT", `/returns/${novoClienteId}/${r11.id}`, {
      token: adminToken,
      body: { data: dataRend, percentual: 0.4, variacao: 0.1, rendimento: 130 },
    });
    eq(dataOcupada.status, 409, "PUT mudando para um dia que já tem lançamento → 409");

    const dataRuim = await req("PUT", `/returns/${novoClienteId}/${r11.id}`, {
      token: adminToken,
      body: { data: "14/03/2025", percentual: 0.4, variacao: 0.1, rendimento: 130 },
    });
    eq(dataRuim.status, 400, "PUT com data fora do formato AAAA-MM-DD → 400");

    const outroCliente = await req("DELETE", `/returns/${legado.id}/${r11.id}`, { token: adminToken });
    eq(outroCliente.status, 404, "DELETE com id de lançamento de outro cliente → 404");

    const del = await req("DELETE", `/returns/${novoClienteId}/${r11.id}`, {
      token: adminToken,
    });
    eq(del.status, 200, "DELETE /returns/:id/:returnId → 200");

    const listaDepois = await req("GET", `/returns/${novoClienteId}`, { token: adminToken });
    eq(listaDepois.json?.length, 1, "após DELETE resta 1 lançamento");
    eq(listaDepois.json?.[0]?.id, r10.id, "DELETE pelo id apagou o lançamento certo");

    // legado: banco antigo com 2 lançamentos no mesmo dia → pela data fica ambíguo
    const dup = await Return.create({ data: dataRend, percentual: 1, variacao: 1, rendimento: 1, userId: novoClienteId });
    eq((await req("DELETE", `/returns/${novoClienteId}/${dataRend}`, { token: adminToken })).status, 409,
      "DELETE pela data com 2 lançamentos no dia → 409 (não apaga o errado)");
    eq((await req("DELETE", `/returns/${novoClienteId}/${dup.id}`, { token: adminToken })).status, 200,
      "o mesmo caso pelo id → 200");
  }

  // ---------------------------------------------------------------
  section("Repasses (/repasse)");
  {
    const fechar = await req("POST", `/repasse/close/${novoClienteId}`, { token: adminToken });
    eq(fechar.status, 200, "POST /repasse/close/:userId → 200");
    ok(fechar.json?.label?.includes("Repasse"), "repasse devolve label formatado");

    const semAdmin = await req("POST", `/repasse/close/${novoClienteId}`, { token: legadoToken });
    eq(semAdmin.status, 403, "POST /repasse/close como cliente → 403");

    const lista = await req("GET", `/repasse/${novoClienteId}`, { token: adminToken });
    eq(lista.status, 200, "GET /repasse/:userId → 200");
    ok(Array.isArray(lista.json?.repasses), "GET /repasse devolve repasses[]");
    ok(lista.json.repasses.length >= 1, "GET /repasse: ao menos 1 repasse");
    // cadastro 01/03/2025 (sábado) + 30 dias úteis = 11/04/2025, em qualquer fuso do servidor
    eq(lista.json.repasses[0]?.end, "2025-04-11",
      `repasse fecha 30 dias úteis depois do cadastro (fuso do servidor: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`);

    const listaDono = await req("GET", `/repasse/${legado.id}`, { token: legadoToken });
    eq(listaDono.status, 200, "GET /repasse/:userId do próprio cliente → 200");

    const listaOutro = await req("GET", `/repasse/${novoClienteId}`, { token: legadoToken });
    eq(listaOutro.status, 403, "GET /repasse/:userId de outro cliente → 403");
  }

  // ---------------------------------------------------------------
  section("Aportes e Extrato (/aportes)");
  {
    const login = await req("POST", "/users/login", {
      body: { user: "novo.cliente", password: "654321" },
    });
    eq(login.status, 200, "login do novo cliente → 200");
    const novoToken = login.json?.accessToken;

    // autenticação / autorização
    const semToken = await req("POST", "/aportes", {
      body: { userId: legado.id, valor: 10, data_recebimento: "2025-04-01" },
    });
    eq(semToken.status, 401, "POST /aportes sem token → 401");
    eq((await req("GET", `/aportes/extrato/${legado.id}`)).status, 401,
      "GET /aportes/extrato sem token → 401");

    const comoInvestidor = await req("POST", "/aportes", {
      token: legadoToken,
      body: { userId: legado.id, valor: 10, data_recebimento: "2025-04-01" },
    });
    eq(comoInvestidor.status, 403, "POST /aportes com token de investidor → 403");
    eq((await req("GET", "/aportes", { token: legadoToken })).status, 403,
      "GET /aportes (lista admin) com token de investidor → 403");

    const extratoDeOutro = await req("GET", `/aportes/extrato/${novoClienteId}`, {
      token: legadoToken,
    });
    eq(extratoDeOutro.status, 403, "investidor A pedindo extrato do investidor B → 403");

    // validação
    const base = { userId: legado.id, data_recebimento: "2025-04-01" };
    for (const [valor, rotulo] of [[0, "zero"], [-5, "negativo"], ["abc", "texto"], [1.234, "3 casas"]]) {
      const r = await req("POST", "/aportes", { token: adminToken, body: { ...base, valor } });
      eq(r.status, 400, `POST /aportes valor ${rotulo} → 400`);
    }
    const dataRuim = await req("POST", "/aportes", {
      token: adminToken,
      body: { ...base, valor: 10, data_recebimento: "01/04/2025" },
    });
    eq(dataRuim.status, 400, "POST /aportes data fora do formato → 400");
    const naoExiste = await req("POST", "/aportes", {
      token: adminToken,
      body: { ...base, userId: "nao-existe", valor: 10 },
    });
    eq(naoExiste.status, 404, "POST /aportes investidor inexistente → 404");

    // 0,10 + 0,20 = 0,30 exato (no total do extrato e no valor_aportado)
    const a1 = await req("POST", "/aportes", {
      token: adminToken,
      body: { ...base, valor: 0.1, data_recebimento: "2025-04-01" },
    });
    eq(a1.status, 201, "POST /aportes 0,10 (admin) → 201");
    const a2 = await req("POST", "/aportes", {
      token: adminToken,
      body: { ...base, valor: 0.2, data_recebimento: "2025-04-02", observacao: "TED" },
    });
    eq(a2.status, 201, "POST /aportes 0,20 (admin) → 201");
    eq(a2.json?.valor_aportado, 10000.3, "valor_aportado 10.000 + 0,10 + 0,20 = 10.000,30 exato");

    const extLegado = await req("GET", `/aportes/extrato/${legado.id}`, { token: legadoToken });
    eq(extLegado.status, 200, "investidor lê o próprio extrato → 200");
    eq(extLegado.json?.totais?.aportado, 0.3, "extrato: 0,10 + 0,20 = 0,30 exato");
    eq(extLegado.json?.lancamentos?.[0]?.descricao, "TED", "extrato: mais recente primeiro, com observação");

    // aporte novo soma; aporte histórico só registra
    const somado = await req("POST", "/aportes", {
      token: adminToken,
      body: { userId: novoClienteId, valor: 500, data_recebimento: "2025-06-10" },
    });
    eq(somado.status, 201, "POST /aportes novo (soma) → 201");
    eq(somado.json?.valor_aportado, 60500, "aporte novo soma no valor_aportado (60.000 → 60.500)");
    const historico = await req("POST", "/aportes", {
      token: adminToken,
      body: { userId: novoClienteId, valor: 60000, data_recebimento: "2025-03-01", historico: true },
    });
    eq(historico.status, 201, "POST /aportes histórico → 201");
    eq(historico.json?.valor_aportado, 60500, "aporte histórico NÃO soma no valor_aportado");
    eq(historico.json?.aporte?.somado_ao_aportado, false, "aporte histórico marcado somado_ao_aportado=false");

    const listaNovo = await req("GET", `/aportes?userId=${novoClienteId}`, { token: adminToken });
    eq(listaNovo.status, 200, "GET /aportes?userId (admin) → 200");
    eq(listaNovo.json?.length, 2, "lista admin filtra por investidor");
    eq(listaNovo.json?.[0]?.data_recebimento, "2025-06-10", "lista admin: mais recente primeiro");
    eq(listaNovo.json?.[0]?.nome, "Novo Cliente Editado", "lista admin traz o nome do investidor");
    eq((await req("GET", "/aportes", { token: adminToken })).json?.length, 4,
      "GET /aportes sem filtro lista todos");

    // extrato do novo cliente: rendimento do repasse fechado bate com /returns
    const ext = await req("GET", `/aportes/extrato/${novoClienteId}`, { token: novoToken });
    eq(ext.status, 200, "GET /aportes/extrato do próprio investidor → 200");
    const repasses = (await req("GET", `/repasse/${novoClienteId}`, { token: novoToken })).json?.repasses || [];
    let liquidoPortal = 0;
    for (const r of repasses) {
      const rets = (await req("GET", `/returns/${novoClienteId}?repasseId=${r.id}`, { token: novoToken })).json || [];
      liquidoPortal += rets.reduce((s, x) => s + Number(x.rendimento), 0) * 0.7;
    }
    eq(ext.json?.totais?.rendimentos, Math.round(liquidoPortal * 100) / 100,
      "extrato: rendimentos = líquido (70%) dos repasses que o portal exibe");
    eq(ext.json?.totais?.aportado, 60500, "extrato: total aportado = soma dos aportes");
    eq(ext.json?.lancamentos?.length, 2 + repasses.length, "extrato: aportes + 1 linha por repasse");
    ok(ext.json?.lancamentos?.some((l) => l.tipo === "rendimento" && l.descricao.startsWith("1º Repasse")),
      "extrato: linha de rendimento descreve o repasse");
    const datas = (ext.json?.lancamentos || []).map((l) => l.data);
    ok(datas.every((d, i) => i === 0 || datas[i - 1] >= d), "extrato: ordem cronológica, mais recente primeiro");
    eq((await req("GET", `/aportes/extrato/${novoClienteId}`, { token: adminToken })).status, 200,
      "admin lê extrato de qualquer investidor → 200");
  }

  // ---------------------------------------------------------------
  section("Saques (/saques) + informe no chat + extrato");
  {
    const login = await req("POST", "/users/login", {
      body: { user: "novo.cliente", password: "654321" },
    });
    const novoToken = login.json?.accessToken;
    const base = { userId: novoClienteId, data_saque: "2025-07-01" };

    eq((await req("POST", "/saques", { body: { ...base, valor: 10 } })).status, 401,
      "POST /saques sem token → 401");
    eq((await req("POST", "/saques", { token: novoToken, body: { ...base, valor: 10 } })).status, 403,
      "POST /saques com token de investidor → 403");
    eq((await req("GET", "/saques", { token: novoToken })).status, 403,
      "GET /saques (lista admin) com token de investidor → 403");

    for (const [valor, rotulo] of [[0, "zero"], [-5, "negativo"], ["abc", "texto"], [1.234, "3 casas"]]) {
      const r = await req("POST", "/saques", { token: adminToken, body: { ...base, valor } });
      eq(r.status, 400, `POST /saques valor ${rotulo} → 400`);
    }
    eq((await req("POST", "/saques", {
      token: adminToken, body: { ...base, valor: 10, data_saque: "01/07/2025" },
    })).status, 400, "POST /saques data fora do formato → 400");
    eq((await req("POST", "/saques", {
      token: adminToken, body: { ...base, userId: "nao-existe", valor: 10 },
    })).status, 404, "POST /saques investidor inexistente → 404");
    eq((await req("POST", "/saques", {
      token: adminToken, body: { ...base, valor: 60500.01 },
    })).status, 422, "POST /saques maior que o valor aportado → 422");

    const chatAntes = (await req("GET", `/chat/${novoClienteId}`, { token: novoToken })).json || [];

    const s1 = await req("POST", "/saques", {
      token: adminToken, body: { ...base, valor: 1000, observacao: "PIX" },
    });
    eq(s1.status, 201, "POST /saques 1.000 (admin) → 201");
    eq(s1.json?.valor_aportado, 59500, "saque subtrai do valor_aportado (60.500 → 59.500)");
    eq(s1.json?.avisado, true, "saque novo avisa o investidor");

    const chatDepois = (await req("GET", `/chat/${novoClienteId}`, { token: novoToken })).json || [];
    eq(chatDepois.length, chatAntes.length + 1, "saque cria 1 mensagem no chat do investidor");
    ok(String(chatDepois[chatDepois.length - 1]?.texto || "").includes("R$ 59.500,00"),
      "informe do saque traz o novo valor investido");

    const hist = await req("POST", "/saques", {
      token: adminToken, body: { ...base, valor: 200, data_saque: "2025-02-01", historico: true },
    });
    eq(hist.status, 201, "POST /saques histórico → 201");
    eq(hist.json?.valor_aportado, 59500, "saque histórico NÃO subtrai do valor_aportado");
    eq(hist.json?.saque?.descontado_do_aportado, false, "saque histórico marcado descontado_do_aportado=false");
    eq(((await req("GET", `/chat/${novoClienteId}`, { token: novoToken })).json || []).length,
      chatDepois.length, "saque histórico não manda mensagem");

    const lista = await req("GET", `/saques?userId=${novoClienteId}`, { token: adminToken });
    eq(lista.json?.length, 2, "lista admin de saques filtra por investidor");
    eq(lista.json?.[0]?.data_saque, "2025-07-01", "lista admin de saques: mais recente primeiro");

    const ext = await req("GET", `/aportes/extrato/${novoClienteId}`, { token: novoToken });
    eq(ext.json?.totais?.sacado, 1200, "extrato: total sacado = soma dos saques");
    ok(ext.json?.lancamentos?.some((l) => l.tipo === "saque" && l.descricao === "PIX"),
      "extrato: linha de saque com observação");
  }

  // ---------------------------------------------------------------
  section("Agenda de repasses (/repasse/agenda) + fechar sem duplicar");
  {
    // mesma conta do backend: +n dias úteis, só com a data (UTC)
    const diasUteis = (iso, n) => {
      const r = new Date(`${iso}T00:00:00Z`);
      const passo = n < 0 ? -1 : 1;
      for (let k = 0; k < Math.abs(n); ) {
        r.setUTCDate(r.getUTCDate() + passo);
        if (r.getUTCDay() !== 0 && r.getUTCDay() !== 6) k++;
      }
      return r.toISOString().slice(0, 10);
    };
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const agenda = async () => (await req("GET", "/repasse/agenda", { token: adminToken })).json;
    const doCliente = async (id) => (await agenda()).itens.find((i) => i.userId === id);

    eq((await req("GET", "/repasse/agenda")).status, 401, "GET /repasse/agenda sem token → 401");
    eq((await req("GET", "/repasse/agenda", { token: legadoToken })).status, 403,
      "GET /repasse/agenda como cliente → 403");
    const a0 = await req("GET", "/repasse/agenda", { token: adminToken });
    eq(a0.status, 200, "GET /repasse/agenda (admin) → 200");
    eq(a0.json?.hoje, hoje, "agenda informa a data de hoje (Brasília)");

    // novo cliente: 1º repasse fechou em 11/04/2025 → 2º vence 30 dias úteis depois (atrasado)
    let item = await doCliente(novoClienteId);
    eq(item?.numero, 2, "agenda: próximo repasse do cliente é o 2º");
    eq(item?.dataInicio, "2025-04-11", "agenda: período começa no fim do último repasse");
    eq(item?.dataFim, diasUteis("2025-04-11", 30), "agenda: período termina 30 dias úteis depois");
    eq(item?.situacao, "atrasado", "agenda: venceu e não fechou → atrasado");
    eq(item?.bruto, 0, "agenda: sem lançamentos no período, bruto 0");

    await req("POST", `/returns/${novoClienteId}`, {
      token: adminToken,
      body: { data: "2025-04-15", percentual: 0.2, variacao: 0, rendimento: 100 },
    });
    item = await doCliente(novoClienteId);
    eq(item?.lancamentos, 1, "agenda: conta os lançamentos do período");
    eq(JSON.stringify([item?.bruto, item?.taxa, item?.liquido]), "[100,30,70]",
      "agenda: bruto 100 → taxa 30 / líquido 70");

    // fechar com o número errado ou duas vezes não duplica
    eq((await req("POST", `/repasse/close/${novoClienteId}`, { token: adminToken, body: { numero: 1 } })).status,
      409, "fechar o 1º de novo (já fechado) → 409");
    eq((await req("POST", `/repasse/close/${novoClienteId}`, { token: adminToken, body: { numero: 2 } })).status,
      200, "fechar o 2º repasse → 200");
    eq((await req("POST", `/repasse/close/${novoClienteId}`, { token: adminToken, body: { numero: 2 } })).status,
      409, "clicar de novo no 2º → 409 (não duplica)");
    const duplo = await Promise.all([1, 2].map(() =>
      req("POST", `/repasse/close/${novoClienteId}`, { token: adminToken, body: { numero: 3 } })));
    // MySQL: o 2º espera a trava e recebe 409. SQLite (teste) recusa a escrita
    // concorrente com erro de trava. Em ambos, só um fecha.
    eq(duplo.filter((r) => r.status === 200).length, 1,
      "dois cliques simultâneos no 3º → só um fecha");
    const repasses = (await req("GET", `/repasse/${novoClienteId}`, { token: adminToken })).json.repasses;
    eq(repasses.map((r) => r.label).join(","), "1º Repasse,2º Repasse,3º Repasse",
      "sem repasse duplicado");
    eq((await doCliente(novoClienteId))?.numero, 4, "agenda já mostra o 4º depois de fechar");

    // vence hoje / amanhã
    const criarCom = (sufixo, cadastro) => User.create({
      id: `user-agenda-${sufixo}`, user: `agenda.${sufixo}`, password: "123456", token: "user",
      name: `Agenda ${sufixo}`, cpf: `7700000000${sufixo === "hoje" ? 1 : 2}`, email: `agenda.${sufixo}@teste.local`,
      data_cadastro: cadastro, valor_aportado: 1000, percentual_contrato: 3,
    });
    const diaUtil = (iso) => ![0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());
    if (diaUtil(hoje)) {
      await criarCom("hoje", diasUteis(hoje, -30));
      eq((await doCliente("user-agenda-hoje"))?.situacao, "hoje", "agenda: repasse que vence hoje → hoje");
    }
    const amanha = diasUteis(hoje, 1);
    await criarCom("amanha", diasUteis(amanha, -30));
    eq((await doCliente("user-agenda-amanha"))?.situacao, "amanha", "agenda: vence no próximo dia útil → amanha");
    eq((await agenda()).itens.some((i) => i.dataFim > amanha), false, "agenda não traz repasses mais distantes");
  }

  // ---------------------------------------------------------------
  section("Índices — comparativo CDI/Poupança (/indices)");
  {
    const semToken = await req("GET", "/indices/comparativo?inicio=2025-06-02&fim=2025-08-15");
    eq(semToken.status, 401, "GET /indices/comparativo sem token → 401");

    const ruim = await req("GET", "/indices/comparativo?inicio=abc&fim=2025-08-15", {
      token: legadoToken,
    });
    eq(ruim.status, 400, "GET /indices/comparativo com data inválida → 400");

    const invertido = await req(
      "GET",
      "/indices/comparativo?inicio=2025-09-01&fim=2025-06-01",
      { token: legadoToken }
    );
    eq(invertido.status, 400, "GET /indices/comparativo com inicio > fim → 400");

    // chamada real ao Ipeadata/Banco Central — tolerante a rede fora do ar
    const real = await req(
      "GET",
      "/indices/comparativo?inicio=2025-06-02&fim=2025-08-15",
      { token: legadoToken }
    );
    ok(
      [200, 502].includes(real.status),
      `GET /indices/comparativo (BCB) → ${real.status} (200 esperado; 502 se o BCB estiver fora)`
    );
    if (real.status === 200) {
      ok(real.json?.cdi?.serie?.length > 0, "comparativo: série do CDI preenchida");
      ok(
        real.json?.poupanca?.serie?.length > 0,
        "comparativo: série da poupança preenchida"
      );
      ok(
        real.json.cdi.percentual > real.json.poupanca.percentual,
        "comparativo: CDI rende mais que a poupança no período"
      );
    }
  }

  // ---------------------------------------------------------------
  section("Eventos (/eventos)");
  let eventoId;
  {
    const semToken = await req("GET", "/eventos");
    eq(semToken.status, 401, "GET /eventos sem token → 401");

    const listaCliente = await req("GET", "/eventos", { token: legadoToken });
    eq(listaCliente.status, 403, "GET /eventos como cliente → 403 (eventos citam outros clientes)");

    const lista = await req("GET", "/eventos", { token: adminToken });
    eq(lista.status, 200, "GET /eventos (admin) → 200");

    const criar = await req("POST", "/eventos", {
      token: adminToken,
      body: { nome: "Reunião trimestral", data: "2025-04-01", categoria: "interno" },
    });
    eq(criar.status, 200, "POST /eventos (admin) → 200");
    eventoId = criar.json?.evento?.id;
    ok(eventoId != null, "POST /eventos devolve id");

    const criarCliente = await req("POST", "/eventos", {
      token: legadoToken,
      body: { nome: "x", data: "2025-04-02" },
    });
    eq(criarCliente.status, 403, "POST /eventos como cliente → 403");

    const getById = await req("GET", `/eventos/${eventoId}`, { token: adminToken });
    eq(getById.status, 200, "GET /eventos/:id → 200");

    const upd = await req("PUT", `/eventos/${eventoId}`, {
      token: adminToken,
      body: { status: "concluido" },
    });
    eq(upd.status, 200, "PUT /eventos/:id → 200");
    eq(upd.json?.evento?.status, "concluido", "PUT /eventos aplica status");

    const del = await req("DELETE", `/eventos/${eventoId}`, { token: adminToken });
    eq(del.status, 200, "DELETE /eventos/:id → 200");

    const delDepois = await req("GET", `/eventos/${eventoId}`, { token: adminToken });
    eq(delDepois.status, 404, "GET /eventos/:id após exclusão → 404");
  }

  // ---------------------------------------------------------------
  section("Eventos recorrentes (repetição mensal)");
  {
    const { proximoMes, hojeBrasil } = require("../src/services/recorrenciaEventos");
    eq(proximoMes("2026-09-01"), "2026-10-01", "próximo mês: 01/09 → 01/10");
    eq(proximoMes("2026-12-15"), "2027-01-15", "próximo mês: vira o ano");
    eq(proximoMes("2026-01-31"), "2026-02-28", "próximo mês: 31/01 → 28/02");
    eq(proximoMes("2028-01-31"), "2028-02-29", "próximo mês: ano bissexto");

    const listar = async () => (await req("GET", "/eventos", { token: adminToken })).json || [];
    const daSerie = async (nome) => (await listar()).filter((e) => e.nome === nome);
    const hoje = hojeBrasil();

    // futura: nada muda até concluir
    const fut = await req("POST", "/eventos", {
      token: adminToken,
      body: { nome: "Recorrente futuro", data: "2099-03-10", recorrente: true },
    });
    eq((await daSerie("Recorrente futuro")).length, 1, "recorrente com data futura não gera nada antes da hora");

    const concluir = await req("PUT", `/eventos/${fut.json.evento.id}`, {
      token: adminToken,
      body: { status: "concluido" },
    });
    eq(concluir.status, 200, "concluir evento recorrente → 200");
    eq(concluir.json?.evento?.recorrente, false, "ocorrência concluída deixa de ser a 'ativa' da série");
    let serie = await daSerie("Recorrente futuro");
    eq(serie.length, 2, "concluir gera a ocorrência do mês seguinte");
    const prox = serie.find((e) => e.data === "2099-04-10");
    ok(prox && prox.status === "pendente" && prox.recorrente === true,
      "próxima ocorrência: 10/04, pendente, recorrente");

    // cancelar uma ocorrência também segue a série
    await req("PUT", `/eventos/${prox.id}`, { token: adminToken, body: { status: "cancelado" } });
    ok((await daSerie("Recorrente futuro")).some((e) => e.data === "2099-05-10" && e.recorrente),
      "cancelar uma ocorrência não interrompe a série (gera 10/05)");

    // desmarcar "recorrente" na mais recente encerra a série
    const ultima = (await daSerie("Recorrente futuro")).find((e) => e.recorrente);
    await req("PUT", `/eventos/${ultima.id}`, {
      token: adminToken,
      body: { recorrente: false, status: "concluido" },
    });
    eq((await daSerie("Recorrente futuro")).length, 3, "desmarcar recorrente encerra a série");

    // data no passado: cria os meses que faltam até chegar em hoje ou depois
    const [a, m] = hoje.split("-").map(Number);
    const dataInicio = new Date(Date.UTC(a, m - 1 - 3, 5)).toISOString().slice(0, 10);
    await req("POST", "/eventos", {
      token: adminToken,
      body: { nome: "Recorrente atrasado", data: dataInicio, recorrente: true },
    });
    // várias leituras simultâneas não podem duplicar ocorrências
    await Promise.all([listar(), listar(), listar(), listar()]);
    serie = (await daSerie("Recorrente atrasado")).sort((x, y) => (x.data < y.data ? -1 : 1));
    const datas = serie.map((e) => e.data);
    eq(new Set(datas).size, datas.length, "sem ocorrências duplicadas (leituras simultâneas)");
    let esperado = dataInicio;
    const sequencia = [esperado];
    while (esperado < hoje) sequencia.push((esperado = proximoMes(esperado)));
    eq(JSON.stringify(datas), JSON.stringify(sequencia), "meses atrasados criados, um por mês, até hoje ou depois");
    eq(serie.filter((e) => e.recorrente).length, 1, "só a ocorrência mais recente fica marcada como recorrente");
    ok(serie[serie.length - 1].recorrente && serie[serie.length - 1].data >= hoje,
      "a ocorrência ativa é a de hoje em diante");
    eq((await daSerie("Recorrente atrasado")).length, serie.length, "listar de novo não gera nada a mais");

    // marcar "recorrente" de novo num mês antigo não recria meses que já existem
    await req("PUT", `/eventos/${serie[0].id}`, { token: adminToken, body: { recorrente: true } });
    eq((await daSerie("Recorrente atrasado")).length, serie.length,
      "remarcar recorrente num evento antigo não duplica a série");

    const resumo = await req("GET", "/chat/resumo", { token: adminToken });
    eq(resumo.status, 200, "sino do admin continua respondendo com a recorrência");

    // dia 31 não "escorrega" depois de fevereiro
    eq(proximoMes("2026-02-28", 31), "2026-03-31", "próximo mês respeita o dia original (28/02 → 31/03)");
    const d31 = await req("POST", "/eventos", {
      token: adminToken,
      body: { nome: "Cobrança dia 31", data: "2099-01-31", recorrente: true },
    });
    await req("PUT", `/eventos/${d31.json.evento.id}`, { token: adminToken, body: { status: "concluido" } });
    const fev = (await daSerie("Cobrança dia 31")).find((e) => e.recorrente);
    eq(fev?.data, "2099-02-28", "série do dia 31: fevereiro cai no dia 28");
    await req("PUT", `/eventos/${fev.id}`, { token: adminToken, body: { status: "concluido" } });
    const mar = (await daSerie("Cobrança dia 31")).find((e) => e.recorrente);
    eq(mar?.data, "2099-03-31", "série do dia 31: março volta para o dia 31");
  }

  // ---------------------------------------------------------------
  section("Sino do admin — avisos de eventos (3 dias antes, some ao clicar)");
  {
    const { hojeBrasil, somarDias } = require("../src/services/recorrenciaEventos");
    const hoje = hojeBrasil();
    const criar = async (nome, data, extra = {}) =>
      (await req("POST", "/eventos", { token: adminToken, body: { nome, data, ...extra } })).json.evento;
    const avisos = async () => (await req("GET", "/chat/resumo", { token: adminToken })).json;
    const noSino = async (id) => ((await avisos()).eventos || []).some((e) => e.id === id);
    const listarEventos = async () => (await req("GET", "/eventos", { token: adminToken })).json || [];

    const em2 = await criar("Aviso em 2 dias", somarDias(hoje, 2));
    const em3 = await criar("Aviso em 3 dias", somarDias(hoje, 3));
    const em4 = await criar("Aviso em 4 dias", somarDias(hoje, 4));
    const vencido = await criar("Aviso vencido", somarDias(hoje, -5));
    const concluido = await criar("Aviso concluído", hoje, { status: "concluido" });

    ok(await noSino(em2.id), "evento que vence em 2 dias aparece no sino");
    ok(await noSino(em3.id), "evento que vence em 3 dias aparece no sino");
    ok(!(await noSino(em4.id)), "evento que vence em 4 dias ainda NÃO aparece");
    ok(await noSino(vencido.id), "evento vencido e não visto aparece");
    ok(!(await noSino(concluido.id)), "evento concluído não aparece");
    const r = await avisos();
    eq(r.eventosPendentes, r.eventos.length, "contador do sino = quantidade de avisos");
    ok(r.eventos.every((e) => e.nome && e.data), "cada aviso traz nome e data");

    eq((await req("POST", `/eventos/${em2.id}/visto`)).status, 401, "marcar visto sem token → 401");
    eq((await req("POST", `/eventos/${em2.id}/visto`, { token: legadoToken })).status, 403,
      "marcar visto como cliente → 403");
    eq((await req("POST", "/eventos/999999/visto", { token: adminToken })).status, 404,
      "marcar visto de evento inexistente → 404");
    eq((await req("POST", `/eventos/${em2.id}/visto`, { token: adminToken })).status, 200,
      "admin clica no aviso → 200");
    ok(!(await noSino(em2.id)), "depois de clicar, o aviso some do sino");
    ok(await noSino(em3.id), "os outros avisos continuam");
    ok((await listarEventos()).some((e) => e.id === em2.id && e.status === "pendente"),
      "o evento continua na agenda, pendente");

    // mudar a data faz o aviso voltar
    await req("PUT", `/eventos/${em2.id}`, { token: adminToken, body: { data: somarDias(hoje, 1) } });
    ok(await noSino(em2.id), "mudar a data do evento faz o aviso voltar");

    // recorrente: a ocorrência do mês seguinte avisa de novo, na hora dela
    const rec = await criar("Plataforma mensal", hoje, { recorrente: true });
    await req("POST", `/eventos/${rec.id}/visto`, { token: adminToken });
    ok(!(await noSino(rec.id)), "pagamento do mês: clicou, sumiu");
    await req("PUT", `/eventos/${rec.id}`, { token: adminToken, body: { status: "concluido" } });
    const proximo = (await listarEventos()).find((e) => e.nome === "Plataforma mensal" && e.recorrente);
    ok(proximo && proximo.notificacao_vista_em === null, "ocorrência do mês seguinte nasce com aviso não visto");
    ok(!(await noSino(proximo.id)), "e só aparece no sino quando faltar 3 dias");
  }

  // ---------------------------------------------------------------
  section("Chat cliente <-> admin (/chat)");
  {
    const semToken = await req("GET", "/chat/resumo");
    eq(semToken.status, 401, "GET /chat/resumo sem token → 401");

    const conversasComoCliente = await req("GET", "/chat/conversas", {
      token: legadoToken,
    });
    eq(conversasComoCliente.status, 403, "GET /chat/conversas como cliente → 403");

    const lerOutro = await req("GET", `/chat/${novoClienteId}`, {
      token: legadoToken,
    });
    eq(lerOutro.status, 403, "cliente lendo conversa de outro → 403");

    const vazio = await req("POST", `/chat/${legado.id}`, {
      token: legadoToken,
      body: { texto: "   " },
    });
    eq(vazio.status, 400, "POST /chat com texto vazio → 400");

    // cliente manda mensagem
    const enviouCliente = await req("POST", `/chat/${legado.id}`, {
      token: legadoToken,
      body: { texto: "Olá, tenho uma dúvida sobre o repasse." },
    });
    eq(enviouCliente.status, 201, "cliente envia mensagem → 201");
    eq(enviouCliente.json?.autor, "cliente", "mensagem marcada como autor=cliente");

    // admin vê no resumo
    const resumoAdmin = await req("GET", "/chat/resumo", { token: adminToken });
    eq(resumoAdmin.status, 200, "GET /chat/resumo (admin) → 200");
    ok(resumoAdmin.json?.chatNaoLidas >= 1, "resumo admin conta a não lida");
    ok(
      Array.isArray(resumoAdmin.json?.conversas) &&
        resumoAdmin.json.conversas.some((c) => c.userId === legado.id),
      "resumo admin lista a conversa"
    );
    ok(
      typeof resumoAdmin.json?.eventosPendentes === "number",
      "resumo admin traz eventosPendentes"
    );

    // admin abre a conversa (marca como lida) e responde
    const abriu = await req("GET", `/chat/${legado.id}`, { token: adminToken });
    eq(abriu.status, 200, "admin abre a conversa → 200");
    ok(abriu.json.length >= 1, "conversa tem a mensagem do cliente");

    const resumoAdmin2 = await req("GET", "/chat/resumo", { token: adminToken });
    eq(
      resumoAdmin2.json?.chatNaoLidas,
      0,
      "após abrir, não lidas do admin → 0"
    );

    const respondeu = await req("POST", `/chat/${legado.id}`, {
      token: adminToken,
      body: { texto: "Claro! O repasse sai em 30 dias úteis." },
    });
    eq(respondeu.status, 201, "admin responde → 201");
    eq(respondeu.json?.autor, "admin", "resposta marcada como autor=admin");

    // agora o cliente tem 1 não lida
    const resumoCliente = await req("GET", "/chat/resumo", {
      token: legadoToken,
    });
    eq(resumoCliente.json?.chatNaoLidas, 1, "cliente tem 1 mensagem não lida");
    ok(
      resumoCliente.json?.conversas === undefined,
      "resumo do cliente não expõe conversas de outros"
    );
  }

  // ---------------------------------------------------------------
  section("Segurança — sessão, login e upload");
  {
    // conta excluída perde o acesso na hora (antes: o token valia por 7 dias)
    const temp = await req("POST", "/users", {
      token: adminToken,
      body: { user: "temp.seg", password: "senhaTemp1", name: "Temp Seg", cpf: "98765432100", email: "temp.seg@teste.com" },
    });
    eq(temp.status, 200, "cria conta temporária");
    const tempLogin = await req("POST", "/users/login", { body: { user: "temp.seg", password: "senhaTemp1" } });
    const tempToken = tempLogin.json?.accessToken;
    eq((await req("GET", "/users/me", { token: tempToken })).status, 200, "token da conta funciona antes de excluir");
    eq((await req("DELETE", `/users/${temp.json?.user?.id}`, { token: adminToken })).status, 200, "admin exclui a conta");
    eq((await req("GET", "/users/me", { token: tempToken })).status, 401, "token de conta excluída → 401 na hora");

    // login com objeto/array no lugar de texto: 401, não 500
    eq((await req("POST", "/users/login", { body: { user: { $ne: "" }, password: "x" } })).status, 401,
      "login com objeto no usuário → 401");
    eq((await req("POST", "/users/login", { body: { user: "admin.teste", password: ["x"] } })).status, 401,
      "login com array na senha → 401");
    // (mais tentativas erradas aqui esbarrariam no limite de 10 falhas — testado no fim)

    // token assinado com outro segredo
    const jwt = require("jsonwebtoken");
    const falso = jwt.sign({ sub: legado.id, role: "adm" }, "outro-segredo");
    eq((await req("GET", "/users", { token: falso })).status, 401, "token com segredo errado → 401");

    // papel vem do banco, não do token: token "adm" forjado com o segredo certo
    // mas de um investidor continua sem acesso de admin
    const papelForjado = jwt.sign({ sub: legado.id, role: "adm" }, process.env.JWT_SECRET, { algorithm: "HS256" });
    eq((await req("GET", "/users", { token: papelForjado })).status, 403,
      "papel 'adm' no token de um investidor → 403 (vale o papel do banco)");

    // upload: arquivo que não é .csv → 400 com mensagem, e nada fica no disco
    const { UPLOAD_DIR } = require("../src/utils/fileManager");
    const antes = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;
    const mpRuim = multipartFile("file", "planilha.exe", Buffer.from("nada"));
    const upRuim = await req("POST", `/returns/import/${novoClienteId}`, {
      token: adminToken, raw: mpRuim.body, headers: mpRuim.headers,
    });
    eq(upRuim.status, 400, "upload de arquivo não-.csv → 400");
    ok(/csv/i.test(upRuim.json?.error || ""), "400 explica que só aceita .csv");
    const mpVazio = multipartFile("file", "vazio.csv", Buffer.from("lixo sem datas\n"));
    await req("POST", `/returns/import/${novoClienteId}`, { token: adminToken, raw: mpVazio.body, headers: mpVazio.headers });
    await new Promise((r) => setTimeout(r, 200));
    const depois = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;
    eq(depois, antes, "upload não deixa arquivo temporário para trás");

    // reinvestir: erro de regra com mensagem; nada de erro interno vazando
    const reinv = await req("POST", `/repasse/${novoClienteId}/reinvestir`, { token: adminToken, body: { repasseId: 999999 } });
    eq(JSON.stringify([reinv.status, reinv.json?.error]), '[400,"Repasse não encontrado"]',
      "reinvestir repasse inexistente → 400 com mensagem de regra");
  }

  // ---------------------------------------------------------------
  section("Importação de histórico CSV (/returns/import/:id)");
  {
    const csv = Buffer.from(
      "data,dia,percentual,variacao,rendimento\n" +
        "12/03/2025,Quarta,\"0,50\",\"0,10\",\"R$ 100,00\"\n" +
        "13/03/2025,Quinta,\"0,30\",\"-0,05\",\"R$ 80,00\"\n"
    );
    const mp = multipartFile("file", "historico.csv", csv);
    const imp = await req("POST", `/returns/import/${novoClienteId}`, {
      token: adminToken,
      raw: mp.body,
      headers: mp.headers,
    });
    eq(imp.status, 200, "POST /returns/import/:id → 200");
    ok(imp.json?.success === true, "import: success:true");

    // confere que as linhas entraram
    await new Promise((r) => setTimeout(r, 300));
    const n = await Return.count({ where: { userId: novoClienteId } });
    ok(n >= 2, `import inseriu os lançamentos (Return.count = ${n})`);

    // importar o mesmo arquivo de novo não duplica os dias
    const mp2 = multipartFile("file", "historico.csv", csv);
    const imp2 = await req("POST", `/returns/import/${novoClienteId}`, {
      token: adminToken,
      raw: mp2.body,
      headers: mp2.headers,
    });
    eq(JSON.stringify([imp2.json?.inseridos, imp2.json?.ignorados]), "[0,2]",
      "reimportar o mesmo CSV: 0 inseridos, 2 ignorados");
    eq(await Return.count({ where: { userId: novoClienteId } }), n, "reimportar não muda a contagem");

    const semArquivo = await req("POST", `/returns/import/${novoClienteId}`, {
      token: adminToken,
    });
    eq(semArquivo.status, 400, "POST /returns/import/:id sem arquivo → 400");
  }

  // ---------------------------------------------------------------
  section("Rate limit do login");
  {
    let ultimo = 0;
    for (let i = 0; i < 8; i++) {
      const r = await req("POST", "/users/login", {
        body: { user: "admin.teste", password: "errada" },
      });
      ultimo = r.status;
    }
    eq(ultimo, 429, "após várias falhas seguidas → 429 (Too Many Requests)");

    // login correto ainda deve funcionar? Não — o limiter já bloqueou o IP.
    // Verifica só que o 429 continua (comportamento esperado do express-rate-limit).
  }

  // ---------------------------------------------------------------
  server.close();
  await sequelize.close();
  try {
    fs.unlinkSync(TMP_DB);
  } catch {
    /* ignora */
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`RESULTADO: ${passes} passaram, ${fails} falharam`);
  if (fails) {
    console.log("\nFalhas:");
    falhas.forEach((f) => console.log("  • " + f));
  }
  console.log("═".repeat(60));

  process.exit(fails ? 1 : 0);
}

run().catch((err) => {
  console.error("\n💥 erro fatal na suíte de teste:");
  console.error(err);
  process.exit(1);
});
