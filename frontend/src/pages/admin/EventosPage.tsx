import { useEffect, useMemo, useState, useCallback } from 'react';
import { CalendarDays, Edit, Plus, Search, Trash2, X } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { Evento, EventoStatus } from '../../types';

const emptyEvento: Evento = {
  nome: '',
  data: '',
  status: 'pendente',
  recorrente: false,
  categoria: '',
  observacao: '',
};

export default function EventosPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [form, setForm] = useState<Evento>(emptyEvento);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { dialogState, confirm, alert, handleClose } = useConfirmDialog();

  const fetchEventos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await CSVHandler.getEventos();
      setEventos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar eventos.', error);
      void alert({ title: 'Erro', message: 'Erro ao carregar eventos.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    void fetchEventos();
  }, [fetchEventos]);

  const resetForm = () => {
    setForm(emptyEvento);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      await alert({ title: 'Atenção', message: 'Informe o nome do evento.' });
      return;
    }

    if (!form.data) {
      await alert({ title: 'Atenção', message: 'Informe a data do evento.' });
      return;
    }

    try {
      setSubmitting(true);

      if (editingId) {
        await CSVHandler.updateEvento(editingId, form);
        await alert({ title: 'Evento atualizado', message: 'Evento atualizado com sucesso!', tone: 'success' });
      } else {
        await CSVHandler.addEvento(form);
        await alert({ title: 'Evento criado', message: 'Evento criado com sucesso!', tone: 'success' });
      }

      resetForm();
      await fetchEventos();
    } catch (error) {
      console.error('Erro ao salvar evento.', error);
      await alert({ title: 'Erro', message: 'Erro ao salvar evento.', tone: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (evento: Evento) => {
    setEditingId(evento.id || null);
    setForm({
      nome: evento.nome,
      data: evento.data,
      status: evento.status,
      recorrente: evento.recorrente,
      categoria: evento.categoria || '',
      observacao: evento.observacao || '',
    });
  };

  const handleCancelEvent = async (evento: Evento) => {
    if (!evento.id) return;

    const confirmCancel = await confirm({
      title: 'Cancelar evento',
      message: `Cancelar o evento "${evento.nome}"?`,
      confirmLabel: 'Cancelar evento',
      cancelLabel: 'Voltar',
      tone: 'danger',
    });
    if (!confirmCancel) return;

    try {
      await CSVHandler.cancelEvento(evento.id);
      await fetchEventos();
    } catch (error) {
      console.error('Erro ao cancelar evento.', error);
      await alert({ title: 'Erro', message: 'Erro ao cancelar evento.', tone: 'danger' });
    }
  };

  const handleDeleteEvent = async (evento: Evento) => {
    if (!evento.id) return;

    const c1 = await confirm({
      title: 'Excluir evento',
      message: `Você realmente quer EXCLUIR o evento "${evento.nome}"?`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!c1) return;

    const c2 = await confirm({
      title: 'Excluir evento',
      message: 'Essa ação remove o evento do banco. Confirma novamente?',
      confirmLabel: 'Confirmo',
      tone: 'danger',
    });
    if (!c2) return;

    const c3 = await confirm({
      title: 'Última confirmação',
      message: 'Deseja excluir definitivamente?',
      confirmLabel: 'Excluir definitivamente',
      tone: 'danger',
    });
    if (!c3) return;

    try {
      await CSVHandler.deleteEvento(evento.id);
      await fetchEventos();
    } catch (error) {
      console.error('Erro ao excluir evento.', error);
      await alert({ title: 'Erro', message: 'Erro ao excluir evento.', tone: 'danger' });
    }
  };

  const handleQuickUpdate = async (evento: Evento, data: Partial<Evento>) => {
    if (!evento.id) return;

    try {
      await CSVHandler.updateEvento(evento.id, data);
      await fetchEventos();
    } catch (error) {
      console.error('Erro ao atualizar evento.', error);
      await alert({ title: 'Erro', message: 'Erro ao atualizar evento.', tone: 'danger' });
    }
  };

  const filteredEventos = useMemo(() => {
    const value = search.trim().toLowerCase();

    return eventos.filter((evento) =>
      `${evento.nome} ${evento.categoria || ''} ${evento.status}`
        .toLowerCase()
        .includes(value)
    );
  }, [eventos, search]);

  const formatDate = (date: string) => {
    if (!date) return '—';

    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;

    return parsed.toLocaleDateString('pt-BR');
  };

  const statusClass = (status: EventoStatus) => {
    if (status === 'concluido') return 'text-ip-positive';
    if (status === 'cancelado') return 'text-ip-negative';
    return 'text-ip-gold';
  };

  return (
    <div className="space-y-8">
      <ConfirmDialog {...dialogState} onClose={handleClose} />

      <div>
        <p className="ip-eyebrow">Agenda</p>
        <h2 className="mt-1 text-2xl font-bold text-ip-text">Eventos</h2>
        <p className="text-ip-text-dim text-sm">
          Cadastre, edite, acompanhe status e recorrência dos eventos
        </p>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Plus size={18} className="text-ip-gold" />
          <h3 className="text-lg font-semibold text-ip-text">
            {editingId ? 'Editar Evento' : 'Novo Evento'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Nome</label>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full h-12 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
              placeholder="Ex: Reunião com cliente"
            />
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              className="w-full h-12 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
            />
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EventoStatus })}
              className="w-full h-12 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
            >
              <option value="pendente">Pendente</option>
              <option value="concluido">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Categoria</label>
            <input
              value={form.categoria || ''}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full h-12 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
              placeholder="Ex: reunião, entrega, financeiro"
            />
          </div>

          <div className="flex items-center gap-3 pt-7">
            <input
              id="recorrente"
              type="checkbox"
              checked={form.recorrente}
              onChange={(e) => setForm({ ...form, recorrente: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="recorrente" className="text-sm text-ip-text-dim">
              Repetir todo mês (mesmo dia)
            </label>
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="block text-sm text-ip-text-dim mb-2">Observação</label>
            <textarea
              value={form.observacao || ''}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className="w-full min-h-24 bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
              placeholder="Detalhes do evento..."
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 bg-ip-gold hover:bg-ip-gold-600 !text-ip-navy font-semibold px-5 rounded-lg text-ip-text text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Cadastrar Evento'}
          </button>

          {editingId && (
            <button
              onClick={resetForm}
              className="h-11 flex items-center justify-center gap-2 bg-ip-surface-2 hover:bg-ip-surface-3 border border-ip-border px-5 rounded-lg text-ip-text text-sm font-medium"
            >
              <X size={16} />
              Cancelar edição
            </button>
          )}
        </div>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
        <div className="relative w-full sm:max-w-sm">
          <Search size={18} className="absolute left-3 top-2.5 text-ip-text-dim" />
          <input
            type="text"
            placeholder="Buscar evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
          />
        </div>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ip-text-dim">Carregando eventos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-ip-text-dim">
              <thead className="bg-ip-surface-2 text-ip-text-dim uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Evento</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Recorrente</th>
                  <th className="px-6 py-4">Observação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {filteredEventos.map((evento) => (
                  <tr key={evento.id} className="border-t border-ip-border-soft hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="font-medium text-ip-text">{evento.nome}</div>
                      <div className="text-xs text-ip-text-mute">{evento.categoria || 'Sem categoria'}</div>
                    </td>

                    <td className="px-6 py-4">{formatDate(evento.data)}</td>

                    <td className="px-6 py-4">
                      <select
                        value={evento.status}
                        onChange={(e) =>
                          handleQuickUpdate(evento, { status: e.target.value as EventoStatus })
                        }
                        className={`bg-ip-surface-2 border border-ip-border rounded-lg px-2 py-1 text-sm ${statusClass(evento.status)}`}
                      >
                        <option value="pendente">Pendente</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleQuickUpdate(evento, { recorrente: !evento.recorrente })}
                        className={`px-3 py-1 rounded-lg text-xs border ${
                          evento.recorrente
                            ? 'text-ip-positive border-ip-positive/30 bg-ip-positive/10'
                            : 'text-ip-text-dim border-ip-border bg-ip-surface-2'
                        }`}
                      >
                        {evento.recorrente ? 'Sim' : 'Não'}
                      </button>
                    </td>

                    <td className="px-6 py-4 max-w-xs text-ip-text-dim">
                      {evento.observacao || '—'}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(evento)}
                          className="inline-flex items-center gap-2 bg-ip-surface-2 hover:bg-ip-surface-3 border border-ip-border text-ip-text px-3 py-2 rounded-lg"
                        >
                          <Edit size={16} />
                          Editar
                        </button>

                        {evento.status !== 'cancelado' && (
                          <button
                            onClick={() => handleCancelEvent(evento)}
                            className="inline-flex items-center gap-2 bg-ip-negative/10 hover:bg-ip-negative/20 border border-ip-negative/25 text-ip-negative px-3 py-2 rounded-lg"
                          >
                            <CalendarDays size={16} />
                            Cancelar
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteEvent(evento)}
                          className="inline-flex items-center gap-2 bg-ip-negative/15 hover:bg-ip-negative/25 text-ip-negative border border-ip-negative/25 px-3 py-2 rounded-lg"
                        >
                          <Trash2 size={16} />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredEventos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-ip-text-mute">
                      Nenhum evento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}