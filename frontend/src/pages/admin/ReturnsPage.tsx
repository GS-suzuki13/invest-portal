import { useEffect, useMemo, useState, useCallback } from 'react';
import { Save, Search, Plus, ClipboardList, TrendingUp } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { CSVHandler } from '../../utils/csvHandler';
import type { User, ClientReturn } from '../../types';
import ReturnsManagerModal from '../../components/ReturnsManagerModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { dataLocalISO } from '../../utils/date';

interface ClientWithLastReturn extends User {
  ultimoRendimento?: number;
  ultimoPercentual?: number;
}

export default function ReturnsPage() {
  const [clients, setClients] = useState<ClientWithLastReturn[]>([]);
  const [percentualGeral, setPercentualGeral] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { dialogState, confirm, alert, handleClose } = useConfirmDialog();
  const [selectedClient, setSelectedClient] = useState<User | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);

    try {
      const data = await CSVHandler.getUsers();
      const onlyClients = data.filter((user) => user.token !== 'adm');

      const clientsWithLastReturn: ClientWithLastReturn[] = await Promise.all(
        onlyClients.map(async (client) => {
          try {
            const returns: ClientReturn[] = await CSVHandler.getClientReturns(client.id);

            const ordered = [...(Array.isArray(returns) ? returns : [])].sort(
              (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
            );

            const latestReturn = ordered[0];

            return {
              ...client,
              ultimoRendimento: Number(latestReturn?.rendimento || 0),
              ultimoPercentual: Number(latestReturn?.percentual || 0)
            };
          } catch (error) {
            console.error(`Erro ao buscar retornos de ${client.name}.`, error);

            return {
              ...client,
              ultimoRendimento: 0,
              ultimoPercentual: 0
            };
          }
        })
      );

      setClients(clientsWithLastReturn);
    } catch (error) {
      console.error('Erro ao carregar clientes.', error);
      void alert({ title: 'Erro', message: 'Erro ao carregar clientes.', tone: 'danger' });
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const handleAddGeneralReturn = async () => {
    const parsedPercentualGeral = Number(percentualGeral);

    if (Number.isNaN(parsedPercentualGeral) || parsedPercentualGeral <= 0) {
      await alert({ title: 'Atenção', message: 'Informe um percentual geral válido.' });
      return;
    }

    if (!clients.length) {
      await alert({ title: 'Atenção', message: 'Nenhum cliente disponível para aplicar o rendimento.' });
      return;
    }

    const confirmApply = await confirm({
      title: 'Rendimento geral',
      message: `Aplicar ${parsedPercentualGeral}% de rendimento geral para todos os clientes?`,
      confirmLabel: 'Aplicar',
    });

    if (!confirmApply) return;

    try {
      setSubmitting(true);

      const today = dataLocalISO();

      const results = await Promise.allSettled(
        clients.map(async (client) => {
          const percentualAplicado =
            (parsedPercentualGeral / 100) * ((client.percentual_contrato || 0) / 100);

          const percentualFinal = percentualAplicado * 100;
          const rendimento = (client.valor_aportado || 0) * percentualAplicado;
          const variacao = percentualFinal - (client.ultimoPercentual || 0);

          const returnData: ClientReturn = {
            data: today,
            percentual: Number(percentualFinal.toFixed(3)),
            variacao: Number(variacao.toFixed(3)),
            rendimento: Number(rendimento.toFixed(2))
          };

          await CSVHandler.addClientReturn(client.id, returnData);

          return client.name;
        })
      );

      const errors = results
        .map((result, index) =>
          result.status === 'rejected'
            ? `${clients[index].name}: ${result.reason instanceof Error ? result.reason.message : 'erro'}`
            : null
        )
        .filter((name): name is string => Boolean(name));

      if (errors.length > 0) {
        const nenhum = errors.length === clients.length;
        void alert({
          title: nenhum ? 'Nada foi aplicado' : 'Aplicado parcialmente',
          message: `${nenhum ? 'Nenhum rendimento foi registrado.' : 'Rendimento aplicado parcialmente.'}\nFalha para:\n${errors.join('\n')}`,
          tone: 'danger',
        });
      } else {
        void alert({
          title: 'Rendimento registrado',
          message: 'Rendimento geral registrado com sucesso para todos os clientes!',
          tone: 'success',
        });
      }

      setPercentualGeral('');
      await fetchClients();
    } catch (error) {
      console.error('Erro ao registrar rendimento geral.', error);
      await alert({ title: 'Erro', message: 'Erro ao registrar rendimento geral.', tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return clients.filter((client) =>
      client.name.toLowerCase().includes(normalizedSearch)
    );
  }, [clients, search]);

  const formatCurrency = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const formatDateTime = (date?: string) => {
    if (!date) return '—';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return '—';

    return (
      parsed.toLocaleDateString('pt-BR') +
      ' ' +
      parsed.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    );
  };

  return (
    <div className="space-y-8">
      <ConfirmDialog {...dialogState} onClose={handleClose} />
      <div>
        <p className="ip-eyebrow">Operação</p>
        <h2 className="mt-1 text-2xl font-bold text-ip-text">
          Rendimentos
        </h2>
        <p className="text-ip-text-dim text-sm">
          Aplique rendimento geral para todos os clientes e gerencie o histórico individual
        </p>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Plus size={18} className="text-ip-gold" />
          <h3 className="text-lg font-semibold text-ip-text">
            Adição Geral de Rendimento
          </h3>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:items-end">
            <div>
              <label className="block text-sm text-ip-text-dim mb-2">
                Percentual Geral (%)
              </label>

              <div className="relative">
                <TrendingUp
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ip-text-dim"
                />

                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={percentualGeral}
                  onChange={(e) => setPercentualGeral(e.target.value)}
                  className="w-full h-12 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                  placeholder="Ex: 2.50"
                />
              </div>
            </div>

            <button
              onClick={handleAddGeneralReturn}
              disabled={submitting || loading}
              className="h-12 flex items-center justify-center gap-2 bg-ip-gold hover:bg-ip-gold-600 !text-ip-navy font-semibold px-5 rounded-lg text-ip-text text-sm font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {submitting ? 'Aplicando...' : 'Aplicar para Todos'}
            </button>
          </div>

          <p className="text-xs text-ip-text-mute">
            O sistema aplicará esse percentual para todos os clientes com base no percentual de contrato de cada um.
          </p>
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
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ip-text-dim">
            Carregando clientes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-ip-text-dim">
              <thead className="bg-ip-surface-2 text-ip-text-dim uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Última alteração</th>
                  <th className="px-6 py-4">Último rendimento</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-t border-ip-border-soft hover:bg-white/5"
                  >
                    <td className="px-6 py-4 font-medium text-ip-text">
                      {client.name}
                    </td>

                    <td className="px-6 py-4 text-ip-text-dim">
                      {formatDateTime(client.data_modificacao)}
                    </td>

                    <td className="px-6 py-4 text-ip-positive font-medium">
                      {formatCurrency(client.ultimoRendimento || 0)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="inline-flex items-center gap-2 bg-ip-surface-2 hover:bg-ip-surface-3 border border-ip-border text-ip-text px-3 py-2 rounded-lg"
                        >
                          <ClipboardList size={16} />
                          Gerenciar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-ip-text-mute">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatePresence>
      {selectedClient && (
        <ReturnsManagerModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onUpdated={fetchClients}
        />
      )}
      </AnimatePresence>
    </div>
  );
}