# InvestPortal — Gestão de Clientes e Rendimentos

Plataforma web para **gestão de carteiras de investimento**: o administrador
cadastra investidores, lança rendimentos diários e fecha repasses. O investidor
acompanha a evolução do patrimônio num portal próprio.

> Projeto de portfólio. A demonstração usa apenas dados fictícios, recriados a
> cada inicialização do servidor.

## Demonstração

| Perfil | Usuário | Senha |
|---|---|---|
| Administrador | `admin` | `admin123` |
| Investidor (com histórico) | `investidor.demo` | `demo123` |
| Investidor (sem histórico) | `cliente.teste` | `123456` |

---

## Funcionalidades

### Portal do investidor
- Valor aportado, rendimento bruto e líquido e próximo repasse.
- Gráfico de performance e tabela de rendimentos com filtro por período.
- **Comparativo com CDI e Poupança**, com dados oficiais do Banco Central.
- Extrato de aportes, saques e rendimentos.
- Chat com a gestora, com sino de notificações.
- Tutorial de onboarding no primeiro acesso.

### Painel do administrador
- Dashboard com visão geral da operação.
- Cadastro, edição e exclusão de clientes, com tabela ordenável.
- Lançamento de rendimentos: individual, em lote por percentual ou por importação de CSV.
- **Agenda de repasses**: mostra o que fecha hoje, o que está atrasado e o que fecha amanhã. Divide o resultado em 70% para o investidor e 30% de taxa.
- Reinvestimento do rendimento no valor aportado.
- Registro de aportes e saques. O investidor recebe aviso automático no chat.
- Eventos com recorrência mensal e lembretes.
- Central de mensagens com todos os investidores.

### Segurança
- Login com JWT e senhas com bcrypt.
- Papel do usuário conferido no banco a cada requisição.
- Helmet, CORS restrito e rate limit de login.
- Validação de uploads de CSV.

---

## Tecnologias

**Backend:** Node.js, Express 5, Sequelize (MySQL ou SQLite), JWT, bcrypt, Multer, Helmet.

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Motion, Lucide Icons.
Os gráficos são SVG próprios, sem biblioteca de gráficos.

---

## Estrutura

```
.
├── backend/
│   ├── server.js          # entrada em produção (MySQL)
│   ├── models/            # models Sequelize
│   ├── migrations/
│   ├── scripts/           # demo, ambiente local, seeds e testes de integração
│   └── src/
│       ├── app.js         # Express: middlewares, rotas e (opcional) o site
│       ├── controllers/
│       ├── routes/
│       ├── middlewares/   # autenticação e autorização
│       └── services/      # índices BCB, mensagens automáticas
├── frontend/
│   └── src/
│       ├── pages/         # Login, ClientDashboard, admin/*
│       ├── components/
│       ├── hooks/
│       └── utils/
└── render.yaml            # blueprint de deploy da demonstração
```

---

## Rodar localmente

Requisito: Node.js 20 ou mais recente.

```bash
# backend (SQLite local, sem instalar banco)
cd backend
npm install
npm run seed:demo   # cria o investidor.demo com ~5 meses de histórico
npm run local       # API em http://localhost:5000

# frontend, em outro terminal
cd frontend
npm install
npm run dev         # http://localhost:5173 (repassa /api para o backend)
```

### Demonstração em um único processo

```bash
cd frontend && npm install && npm run build
cd ../backend && npm install && npm run demo   # http://localhost:5000
```

O comando `npm run demo` recria o banco com dados fictícios. Depois serve o site em `/` e a API em `/api`.

### Testes

```bash
cd backend
npm test   # suíte de integração da API (SQLite temporário)
```

---

## Deploy (Render)

O arquivo `render.yaml` cria um serviço web gratuito. O build gera o frontend
e instala o backend. O start roda `npm run demo`. No Render, crie um
**New → Blueprint** apontando para este repositório.

No plano gratuito, o serviço hiberna após um período sem acesso. O primeiro
acesso depois disso leva cerca de 1 minuto. Os dados voltam ao estado inicial
a cada reinício.

---

## Autor

Desenvolvido por **Gustavo Suzuki**
[LinkedIn](https://www.linkedin.com/in/gustavo-suzuki-858189163/) · [GitHub](https://github.com/GS-suzuki13)

## Licença

MIT
