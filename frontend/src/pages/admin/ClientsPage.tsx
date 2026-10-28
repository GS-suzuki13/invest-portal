import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, CalendarDays, Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { User } from '../../types';
import { CSVHandler } from '../../utils/csvHandler';
import ClientRegistrationForm from '../../components/ClientRegistrationForm';
import ClientDetailsModal from '../../components/ClientDetailsModal';
import ClientNextBusinessDay from '../../components/admin/ClientNextBusinessDay';
import ClientTable from '../../components/admin/ClientTable';
import Modal from '../../components/ui/Modal';
import { isoParaBR, proximoRepasseISO } from '../../utils/calculateNextRepasse';
import type { RepasseProximo } from '../../components/admin/ClientNextBusinessDay';

type SortBy = 'nome' | 'percentual' | 'data' | 'data_modificacao';

// data local do navegador em YYYY-MM-DD
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// próximo dia útil (seg–sex) depois de `iso`
const proximoDiaUtil = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  const r = new Date(Date.UTC(a, m - 1, d));
  do r.setUTCDate(r.getUTCDate() + 1);
  while ([0, 6].includes(r.getUTCDay()));
  return r.toISOString().slice(0, 10);
};

export default function ClientsPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('nome');
  const [loading, setLoading] = useState(true);

  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showNextBusinessDay, setShowNextBusinessDay] = useState(false);

  const [clientesProximoRepasse, setClientesProximoRepasse] = useState<RepasseProximo[]>([]);
  const [carregandoRepasses, setCarregandoRepasses] = useState(true);

  // Próximo repasse de cada cliente = último repasse fechado (ou cadastro) + 30
  // dias úteis. Mostra atrasados (venceu e não fechou), hoje e o próximo dia útil.
  const carregarProximosRepasses = async (lista: User[]) => {
    setCarregandoRepasses(true);
    const hoje = isoLocal(new Date());
    const amanhaUtil = proximoDiaUtil(hoje);

    const resultado = await Promise.all(
      lista
        .filter((cliente) => cliente.data_cadastro)
        .map(async (cliente): Promise<RepasseProximo | null> => {
          const repasses = await CSVHandler.getRepasses(cliente.id).catch(() => null);
          if (!repasses) return null;
          const iso = proximoRepasseISO(cliente.data_cadastro, repasses);
          if (!iso) return null;
          const grupo = iso < hoje ? 'atrasado' : iso === hoje ? 'hoje' : iso === amanhaUtil ? 'proximo' : null;
          return grupo ? { ...cliente, proximoRepasse: isoParaBR(iso), proximoISO: iso, grupo } : null;
        })
    );

    setClientesProximoRepasse(
      resultado
        .filter((c): c is RepasseProximo => c !== null)
        .sort((a, b) => a.proximoISO.localeCompare(b.proximoISO) || a.name.localeCompare(b.name))
    );
    setCarregandoRepasses(false);
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);

    try {
      const data = await CSVHandler.getUsers();
      const onlyClients = data.filter((user) => user.token !== 'adm');

      setClients(onlyClients);
      setLoading(false);
      void carregarProximosRepasses(onlyClients);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClients([]);
      setClientesProximoRepasse([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleClientUpdated = (updated: User, action: 'edit' | 'delete') => {
    setClients((prev) =>
      action === 'delete'
        ? prev.filter((c) => c.user !== updated.user)
        : prev.map((c) => (c.user === updated.user ? updated : c))
    );
  };

  const filteredClients = useMemo(() => {
    const searched = clients.filter((client) =>
      client.name?.toLowerCase().includes(search.toLowerCase())
    );

    return searched.sort((a, b) => {
      const compare = <T extends string | number>(valA: T, valB: T) =>
        valA > valB ? 1 : valA < valB ? -1 : 0;

      switch (sortBy) {
        case 'nome':
          return compare(a.name, b.name);

        case 'percentual':
          return compare(
            b.percentual_contrato || 0,
            a.percentual_contrato || 0
          );

        case 'data':
          return compare(
            new Date(b.data_cadastro).getTime(),
            new Date(a.data_cadastro).getTime()
          );

        case 'data_modificacao':
          return compare(
            new Date(b.data_modificacao).getTime(),
            new Date(a.data_modificacao).getTime()
          );

        default:
          return 0;
      }
    });
  }, [clients, search, sortBy]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="ip-eyebrow">Gestão</p>
          <h2 className="mt-1 text-2xl font-bold text-ip-text">Clientes</h2>
          <p className="text-ip-text-dim text-sm">
            Gerencie investidores cadastrados, edite informações e acompanhe repasses
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowNextBusinessDay(true)}
            className="inline-flex items-center justify-center gap-2 bg-ip-surface hover:bg-ip-surface-3 border border-ip-border text-ip-text px-4 py-2 rounded-lg"
          >
            <CalendarDays size={18} />
            Próximos Repasses
            {!carregandoRepasses && clientesProximoRepasse.length > 0 && (
              <span className="grid min-w-[20px] place-items-center rounded-full bg-ip-gold px-1.5 ip-selo font-bold text-ip-navy">
                {clientesProximoRepasse.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowClientForm(true)}
            className="inline-flex items-center justify-center gap-2 bg-ip-gold hover:bg-ip-gold-600 text-ip-navy font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="absolute left-3 top-2.5 text-ip-text-dim" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
        >
          <option value="nome">Ordenar por Nome</option>
          <option value="percentual">Ordenar por Percentual</option>
          <option value="data">Ordenar por Cadastro</option>
          <option value="data_modificacao">Ordenar por Última Alteração</option>
        </select>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ip-text-dim">
            Carregando clientes...
          </div>
        ) : (
          <ClientTable
            // nova busca/ordem: volta para as primeiras 50 linhas
            key={`${search}|${sortBy}`}
            clients={filteredClients}
            onSelectClient={setSelectedClient}
            onClientUpdated={handleClientUpdated}
          />
        )}
      </div>

      <AnimatePresence>
      {selectedClient && (
        <ClientDetailsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={fetchClients}
        />
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showNextBusinessDay && (
        <ClientNextBusinessDay
          data={clientesProximoRepasse}
          carregando={carregandoRepasses}
          onClose={() => setShowNextBusinessDay(false)}
        />
      )}
      </AnimatePresence>

      <AnimatePresence>
      {showClientForm && (
        <Modal
          cartao={false}
          onEsc={() => {
            setShowClientForm(false);
            fetchClients();
          }}
          className="max-w-2xl"
        >
            <ClientRegistrationForm
              onClientRegistered={(newUser) => {
                if (newUser.token !== 'adm') {
                  setClients((prev) => [...prev, newUser]);
                }
                // não fecha o modal: o admin precisa ver/copiar o usuário e a
                // senha inicial gerados na tela de sucesso
              }}
            />

            <button
              onClick={() => {
                setShowClientForm(false);
                fetchClients();
              }}
              className="mt-4 w-full py-2 ip-btn ip-btn-ghost w-full"
            >
              Fechar
            </button>
        </Modal>
      )}
      </AnimatePresence>
    </div>
  );
}