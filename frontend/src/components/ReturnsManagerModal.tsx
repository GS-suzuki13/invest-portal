import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Paperclip,
  Pencil,
  Check,
  Trash2,
  TrendingUp,
  Calendar,
  DollarSign
} from 'lucide-react';
import type { User, ClientReturn, ClientReturnApi } from '../types';
import { calculateNextRepasseBusinessDays } from '../utils/calculateNextRepasse';
import { apiFetch } from '../utils/api';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import ConfirmDialog from './ui/ConfirmDialog';
import Modal from './ui/Modal';
import { dataLocalISO } from '../utils/date';

/** Erro com mensagem vinda da API (já em português, pode ir direto pro usuário). */
class ErroApi extends Error {}

const erroDaApi = async (response: Response, padrao: string) => {
  const corpo = (await response.json().catch(() => null)) as { error?: string } | null;
  return new ErroApi(corpo?.error || padrao);
};

interface Repasse {
  id: number;
  label: string;
  start: string;
  end: string;
}

interface ReturnsManagerModalProps {
  client: User;
  onClose: () => void;
  onUpdated: () => void;
}

const normalizeReturnsWithVariation = (items: ClientReturn[]) => {
  const ordered = [...items].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  return ordered.map((item, index, arr) => {
    const previous = arr[index - 1];
    const apiVariacao = Number(item.variacao);

    const shouldRecalculate =
      !Number.isFinite(apiVariacao) ||
      (apiVariacao === 0 &&
        index > 0 &&
        Number(item.percentual) !== Number(previous?.percentual));

    const calculatedVariacao = previous
      ? Number((Number(item.percentual) - Number(previous.percentual)).toFixed(3))
      : Number(Number(item.percentual || 0).toFixed(3));

    return {
      ...item,
      percentual: Number(item.percentual || 0),
      rendimento: Number(item.rendimento || 0),
      variacao: shouldRecalculate
        ? calculatedVariacao
        : Number(apiVariacao.toFixed(3))
    };
  });
};

export default function ReturnsManagerModal({
  client,
  onClose,
  onUpdated
}: ReturnsManagerModalProps) {
  const [returns, setReturns] = useState<ClientReturn[]>([]);
  const [showAddReturn, setShowAddReturn] = useState(false);
  const [returnForm, setReturnForm] = useState({ percentual: '' });
  const [editingReturn, setEditingReturn] = useState<ClientReturn | null>(null);
  const [editForm, setEditForm] = useState({
    percentual: '',
    variacao: '',
    rendimento: '',
    data: ''
  });

  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreate, setIsCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [selectedRepasseId, setSelectedRepasseId] = useState<number | null | 'all' | 'current'>('current');

  const { dialogState, confirm, alert, handleClose } = useConfirmDialog();

  const apiUrl = import.meta.env.VITE_API_URL;

  const formatDateOnly = (dateStr: string) => {
    if (!dateStr) return '—';

    const raw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [year, month, day] = raw.split('-');

    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }

    return dateStr;
  };

  const loadClientReturns = useCallback(async () => {
    try {
      const response = await apiFetch(`${apiUrl}/returns/${client.id}`);

      if (response.status === 404) {
        setReturns([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar rendimentos');
      }

      const data = await response.json();

      const parsed: ClientReturn[] = (Array.isArray(data) ? data : []).map((item: ClientReturnApi) => ({
        id: item.id,
        data: item.data,
        percentual: Number(item.percentual) || 0,
        variacao:
          item.variacao === null || item.variacao === undefined || item.variacao === ''
            ? NaN
            : Number(item.variacao),
        rendimento: Number(item.rendimento) || 0,
        userId: item.userId,
        repasseId: item.repasseId ?? null
      }));

      setReturns(normalizeReturnsWithVariation(parsed));
    } catch (err) {
      console.error(err);
      setReturns([]);
    }
  }, [apiUrl, client]);

  const loadRepasses = useCallback(async () => {
    try {
      const response = await apiFetch(`${apiUrl}/repasse/${client.id}`);

      if (response.status === 404) {
        setRepasses([]);
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao carregar repasses');
      }

      const data = await response.json();
      const repassesArray = Array.isArray(data.repasses) ? data.repasses : data;

      setRepasses(Array.isArray(repassesArray) ? repassesArray : []);
      setSelectedRepasseId('current');
    } catch (err) {
      console.error(err);
      setRepasses([]);
    }
  }, [apiUrl, client]);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadClientReturns(), loadRepasses()]);
    } finally {
      setLoading(false);
    }
  }, [loadClientReturns, loadRepasses]);

  useEffect(() => {
    if (client) {
      void loadAll();
    }
  }, [client, loadAll]);

  const filteredReturns = useMemo(() => {
    return [...returns]
      .filter((r) => {
        if (selectedRepasseId === 'all') return true;
        if (selectedRepasseId === 'current' || selectedRepasseId === null) return !r.repasseId;
        return r.repasseId === selectedRepasseId;
      })
      .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  }, [returns, selectedRepasseId]);

  const handleAddReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSaving) return;

    const percentualTotal = parseFloat(returnForm.percentual);

    if (Number.isNaN(percentualTotal) || percentualTotal <= 0) {
      await alert({ title: 'Atenção', message: 'Informe um percentual válido.' });
      return;
    }

    setIsSaving(true);

    const percentual = (percentualTotal / 100) * (client.percentual_contrato / 100);
    const rendimento = client.valor_aportado * percentual;
    const formattedPercentual = percentual * 100;

    const orderedReturns = [...returns].sort(
      (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
    );

    const lastReturn = orderedReturns[orderedReturns.length - 1];
    const variacao = lastReturn
      ? formattedPercentual - Number(lastReturn.percentual || 0)
      : formattedPercentual;

    const newReturn: ClientReturn = {
      data: dataLocalISO(),
      percentual: Number(formattedPercentual.toFixed(3)),
      variacao: Number(variacao.toFixed(3)),
      rendimento: Number(rendimento.toFixed(2))
    };

    try {
      const response = await apiFetch(`${apiUrl}/returns/${client.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReturn)
      });

      if (!response.ok) {
        throw await erroDaApi(response, 'Erro ao adicionar rendimento.');
      }

      await loadClientReturns();
      setReturnForm({ percentual: '' });
      setShowAddReturn(false);
      onUpdated();
    } catch (err) {
      console.error(err);
      await alert({
        title: 'Erro',
        message: err instanceof ErroApi ? err.message : 'Erro ao adicionar rendimento.',
        tone: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (r: ClientReturn) => {
    const normalizedDate = r.data.includes('/')
      ? r.data.split('/').reverse().join('-')
      : (r.data.includes('T') ? r.data.split('T')[0] : r.data);

    setEditingReturn({ ...r, data: normalizedDate });
    setEditForm({
      percentual: String(r.percentual),
      variacao: String(r.variacao),
      rendimento: String(r.rendimento),
      data: normalizedDate
    });
  };

  const handleEditSave = async () => {
    if (!editingReturn) return;

    const updatedData = {
      percentual: parseFloat(editForm.percentual),
      variacao: parseFloat(editForm.variacao),
      rendimento: parseFloat(editForm.rendimento),
      data: editForm.data
    };

    try {
      // pelo id: com a data, dois lançamentos no mesmo dia faziam a edição cair no outro
      const ref = editingReturn.id ?? editingReturn.data;
      const response = await apiFetch(`${apiUrl}/returns/${client.id}/${ref}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        throw await erroDaApi(response, 'Erro ao salvar edição.');
      }

      await loadClientReturns();
      setEditingReturn(null);
      onUpdated();
    } catch (err) {
      console.error(err);
      await alert({
        title: 'Erro',
        message: err instanceof ErroApi ? err.message : 'Erro ao salvar edição.',
        tone: 'danger',
      });
    }
  };

  const handleDeleteReturn = async (r: ClientReturn) => {
    const confirmDelete = await confirm({
      title: 'Excluir rendimento',
      message: 'Deseja excluir este rendimento?',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });

    if (!confirmDelete) return;

    try {
      const response = await apiFetch(`${apiUrl}/returns/${client.id}/${r.id ?? r.data}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw await erroDaApi(response, 'Erro ao excluir rendimento.');
      }

      await loadClientReturns();
      onUpdated();
    } catch (err) {
      console.error(err);
      await alert({
        title: 'Erro',
        message: err instanceof ErroApi ? err.message : 'Erro ao excluir rendimento.',
        tone: 'danger',
      });
    }
  };

  const handleImportHistory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    setIsImporting(true);

    try {
      const response = await apiFetch(`${apiUrl}/returns/import/${client.id}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Erro ao importar histórico');
      }

      const resultado = (await response.json().catch(() => null)) as
        | { inseridos?: number; ignorados?: number }
        | null;

      await loadClientReturns();
      onUpdated();

      if (resultado?.ignorados) {
        await alert({
          title: 'Importação concluída',
          message: `${resultado.inseridos ?? 0} lançamento(s) importado(s). ${resultado.ignorados} ignorado(s) porque o dia já tinha rendimento.`,
        });
      }
    } catch (err) {
      console.error(err);
      await alert({ title: 'Erro', message: 'Erro ao importar histórico.', tone: 'danger' });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleCloseRepasse = async () => {
    const confirmClose = await confirm({
      title: 'Criar repasse',
      message: 'Deseja fechar o período atual e criar um novo repasse?',
      confirmLabel: 'Criar repasse',
    });

    if (!confirmClose) return;

    setIsCreate(true);

    try {
      const response = await apiFetch(`${apiUrl}/repasse/close/${client.id}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Erro ao fechar repasse');
      }

      const newRepasse = await response.json();

      setRepasses((prev) => [...prev, newRepasse]);
      setSelectedRepasseId(newRepasse.id);

      const updatedReturns = returns.map((r) => {
        const rDate = new Date(r.data);

        if (!r.repasseId && rDate <= new Date(newRepasse.end)) {
          return { ...r, repasseId: newRepasse.id };
        }

        return r;
      });

      setReturns(normalizeReturnsWithVariation(updatedReturns));
      onUpdated();

      const addToAportado = await confirm({
        title: 'Reinvestir rendimento',
        message:
          'Adicionar o rendimento líquido deste repasse ao valor aportado do cliente? O investidor será avisado automaticamente pelo chat do site.',
        confirmLabel: 'Reinvestir',
      });

      if (addToAportado) {
        const reinvestResponse = await apiFetch(
          `${apiUrl}/repasse/${client.id}/reinvestir`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repasseId: newRepasse.id }),
          }
        );

        if (!reinvestResponse.ok) {
          throw new Error('Erro ao reinvestir rendimento');
        }

        const { user: updatedUser } = await reinvestResponse.json();
        client.valor_aportado = updatedUser.valor_aportado;
        onUpdated();
      }

      await loadAll();
    } catch (err) {
      console.error(err);
      await confirm({
        title: 'Erro ao fechar repasse',
        message: 'Não foi possível concluir o fechamento do repasse. Tente novamente.',
        tone: 'danger',
        alertOnly: true,
      });
    } finally {
      setIsCreate(false);
    }
  };

  const totalReturn = filteredReturns.reduce((sum, r) => sum + r.rendimento, 0);

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const getColorClass = (value: number) =>
    value > 0
      ? 'text-ip-positive font-medium'
      : value < 0
        ? 'text-ip-negative font-medium'
        : 'text-ip-text-dim';

  return (
    <Modal onEsc={onClose} className="max-w-7xl max-h-[92vh] overflow-hidden">
      <ConfirmDialog {...dialogState} onClose={handleClose} />

        <div className="px-5 sm:px-6 py-4 border-b border-ip-border flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-ip-text">
              {client.name}
            </h2>
            <p className="text-ip-text-dim text-sm mt-1">
              Gerenciamento completo de rendimentos
            </p>
          </div>

          <button aria-label="Fechar"
            onClick={onClose}
            className="p-2 rounded-lg text-ip-text-dim hover:text-ip-text hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(92vh-76px)] space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <InfoCard
              title="Valor Aportado"
              value={formatMoney(client.valor_aportado || 0)}
              icon={<DollarSign size={22} />}
              iconClassName="bg-ip-gold/12 text-ip-gold"
            />

            <InfoCard
              title="Rendimento Total"
              value={formatMoney(totalReturn)}
              icon={<TrendingUp size={22} />}
              iconClassName="bg-emerald-600/20 text-ip-positive"
            />

            <InfoCard
              title="Rendimento Líquido"
              value={formatMoney(totalReturn * 0.7)}
              icon={<TrendingUp size={22} />}
              iconClassName="bg-green-600/20 text-ip-positive"
            />

            <InfoCard
              title="Próximo Repasse"
              value={calculateNextRepasseBusinessDays(client.data_cadastro, repasses)}
              icon={<Calendar size={22} />}
              iconClassName="bg-yellow-600/20 text-ip-gold"
            />
          </div>

          <div className="bg-ip-surface-2 border border-ip-border-soft rounded-2xl">
            <div className="px-4 sm:px-5 py-4 border-b border-ip-border-soft flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ip-text text-base">
                  Histórico de Rendimentos
                </h3>
                <p className="text-sm text-ip-text-dim">
                  Visualize, edite, exclua e adicione rendimentos
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={
                    selectedRepasseId === 'current'
                      ? 'current'
                      : selectedRepasseId === 'all'
                        ? 'all'
                        : selectedRepasseId === null
                          ? 'current'
                          : String(selectedRepasseId)
                  }
                  onChange={(e) => {
                    const v = e.target.value;

                    if (v === 'all') {
                      setSelectedRepasseId('all');
                    } else if (v === 'current') {
                      setSelectedRepasseId('current');
                    } else {
                      setSelectedRepasseId(Number(v));
                    }
                  }}
                  className="px-3 py-2 bg-ip-surface border border-ip-border rounded-lg text-sm text-ip-text focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                >
                  <option value="all">Todos rendimentos</option>
                  <option value="current">Atual</option>

                  {repasses.map((rep) => (
                    <option key={rep.id} value={String(rep.id)}>
                      {rep.label} ({formatDateOnly(rep.start)} - {formatDateOnly(rep.end)})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleCloseRepasse}
                  disabled={isCreate}
                  className="px-3 py-2 bg-ip-gold hover:bg-ip-gold-600 !text-ip-navy font-semibold disabled:opacity-50 text-ip-text text-sm rounded-lg"
                >
                  {isCreate ? 'Criando...' : 'Criar Repasse'}
                </button>

                <label className="flex items-center gap-2 px-3 py-2 bg-ip-surface hover:bg-ip-surface-3 text-ip-text rounded-lg cursor-pointer text-sm border border-ip-border">
                  <Paperclip className="w-4 h-4" />
                  {isImporting ? 'Importando...' : 'Importar'}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportHistory}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setShowAddReturn(true)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-ip-text text-sm rounded-lg flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </button>
              </div>
            </div>

            {showAddReturn && (
              <div className="p-4 border-b border-ip-border-soft bg-ip-surface">
                <form onSubmit={handleAddReturn} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    placeholder="% total"
                    value={returnForm.percentual}
                    onChange={(e) => setReturnForm({ percentual: e.target.value })}
                    className="px-3 py-2 bg-ip-surface-2 border border-ip-border rounded-lg text-sm text-ip-text focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                    required
                  />

                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`px-3 py-2 text-ip-text text-sm rounded-lg ${
                      isSaving
                        ? 'bg-emerald-400'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddReturn(false)}
                    className="px-3 py-2 bg-gray-600 text-ip-text text-sm rounded-lg hover:bg-red-600"
                  >
                    Cancelar
                  </button>
                </form>
              </div>
            )}

            {loading ? (
              <div className="p-10 text-center text-ip-text-dim">
                Carregando rendimentos...
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[430px] overflow-y-auto">
                <table className="w-full text-sm text-left text-ip-text-dim">
                  <thead className="bg-ip-surface text-ip-text-dim uppercase text-xs sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Percentual</th>
                      <th className="px-4 py-3">Variação</th>
                      <th className="px-4 py-3">Rendimento</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredReturns.map((r, index) => {
                      const isEditing =
                        editingReturn?.id !== undefined && r.id !== undefined
                          ? editingReturn.id === r.id
                          : editingReturn?.data === r.data;

                      return (
                        <tr
                          key={r.id ?? `${r.data}-${index}`}
                          className="border-t border-ip-border-soft hover:bg-white/5"
                        >
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editForm.data}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, data: e.target.value })
                                }
                                className="w-full px-2 py-2 bg-ip-surface-2 border border-ip-border rounded text-sm text-ip-text"
                              />
                            ) : (
                              formatDateOnly(r.data)
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.0001"
                                value={editForm.percentual}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, percentual: e.target.value })
                                }
                                className="w-full px-2 py-2 bg-ip-surface-2 border border-ip-border rounded text-sm text-ip-text"
                              />
                            ) : (
                              <span className={getColorClass(r.percentual)}>
                                {Number(r.percentual || 0).toFixed(2)}%
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.0001"
                                value={editForm.variacao}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, variacao: e.target.value })
                                }
                                className="w-full px-2 py-2 bg-ip-surface-2 border border-ip-border rounded text-sm text-ip-text"
                              />
                            ) : (
                              <span className={getColorClass(r.variacao)}>
                                {Number(r.variacao || 0).toFixed(2)}%
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                value={editForm.rendimento}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, rendimento: e.target.value })
                                }
                                className="w-full px-2 py-2 bg-ip-surface-2 border border-ip-border rounded text-sm text-ip-text"
                              />
                            ) : (
                              <span className={getColorClass(r.rendimento)}>
                                {formatMoney(r.rendimento)}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={handleEditSave}
                                    aria-label="Salvar repasse"
                                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-ip-text rounded-lg"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>

                                  <button aria-label="Cancelar edição"
                                    onClick={() => setEditingReturn(null)}
                                    className="p-2 bg-gray-600 hover:bg-gray-700 text-ip-text rounded-lg"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button aria-label="Editar repasse"
                                    onClick={() => handleEditClick(r)}
                                    className="p-2 bg-ip-gold hover:bg-ip-gold-600 text-ip-navy font-semibold rounded-lg"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>

                                  <button aria-label="Excluir repasse"
                                    onClick={() => handleDeleteReturn(r)}
                                    className="p-2 bg-ip-negative/15 hover:bg-ip-negative/25 text-ip-negative border border-ip-negative/25 rounded-lg"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredReturns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-ip-text-mute">
                          Nenhum rendimento encontrado para este repasse.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
    </Modal>
  );
}

interface InfoCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconClassName: string;
}

function InfoCard({ title, value, icon, iconClassName }: InfoCardProps) {
  return (
    <div className="bg-ip-surface-2 border border-ip-border-soft rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <span className="text-ip-text-dim text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${iconClassName}`}>
          {icon}
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-ip-text break-words">
        {value}
      </h3>
    </div>
  );
}