import { useState } from 'react';

/** quantas linhas a tabela desenha por vez (a busca continua olhando a lista inteira) */
const POR_PAGINA = 50;
import { ClipboardList, Pencil, Trash2, Check, X } from 'lucide-react';
import { User } from '../../types';
import { apiFetch } from '../../utils/api';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../ui/ConfirmDialog';
import { parseDateLocal } from '../../utils/date';

const apiUrl = import.meta.env.VITE_API_URL;

interface ClientTableProps {
  clients: User[];
  onSelectClient: (client: User) => void;
  onClientUpdated: (updatedClient: User, action: 'edit' | 'delete') => void;
}

export default function ClientTable({
  clients,
  onSelectClient,
  onClientUpdated
}: ClientTableProps) {
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [limite, setLimite] = useState(POR_PAGINA);
  const { dialogState, confirm, alert, handleClose } = useConfirmDialog();

  const handleEditClick = (client: User) => {
    setEditingUser(client.id);
    setEditForm(client);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const res = await apiFetch(`${apiUrl}/users/${editingUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!res.ok) throw new Error();

      setEditingUser(null);
      onClientUpdated(editForm as User, 'edit');
    } catch {
      await alert({ title: 'Erro', message: 'Erro ao salvar alterações.', tone: 'danger' });
    }
  };

  const handleDelete = async (client: User) => {
    const ok = await confirm({
      title: 'Excluir cliente',
      message: `Excluir cliente "${client.name}"?`,
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`${apiUrl}/users/${client.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error();

      onClientUpdated(client, 'delete');
    } catch {
      await alert({ title: 'Erro', message: 'Erro ao excluir cliente.', tone: 'danger' });
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '—';

    // "2026-03-14" sem horário: lê no fuso local (new Date() leria como UTC e mostraria 13/03)
    const parsed = parseDateLocal(date);
    if (Number.isNaN(parsed.getTime())) return '—';

    return parsed.toLocaleDateString('pt-BR');
  };

  // 0% é um valor (não vazio); vírgula decimal do pt-BR
  const formatPercent = (value?: number | null) =>
    value === null || value === undefined || Number.isNaN(value) ? '—' : `${value.toLocaleString('pt-BR')}%`;

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

  const lista = clients.filter((c) => c.token !== 'adm');
  const visiveis = lista.slice(0, limite);

  const formatMoney = (value?: number) =>
    `R$ ${Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  return (
    <div className="overflow-x-auto">
      <ConfirmDialog {...dialogState} onClose={handleClose} />
      <table className="w-full min-w-[1000px] text-sm text-left text-ip-text-dim">
        <thead className="bg-ip-surface-2 text-ip-text-dim uppercase text-xs">
          <tr>
            <th className="px-6 py-4">Nome</th>
            <th className="px-6 py-4">Email</th>
            <th className="px-6 py-4">Cadastro</th>
            <th className="px-6 py-4">Última alteração</th>
            <th className="px-6 py-4">Aporte</th>
            <th className="px-6 py-4">Contrato</th>
            <th className="px-6 py-4 text-right">Ações</th>
          </tr>
        </thead>

        <tbody>
          {visiveis.map((client) => {
              const isEditing = editingUser === client.id;

              return (
                <tr
                  key={client.id}
                  className="border-t border-ip-border-soft hover:bg-white/5"
                >
                  <td className="min-w-[12rem] px-6 py-4 font-medium text-ip-text">
                    {isEditing ? (
                      <input
                        className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                        value={editForm.name || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    ) : (
                      // nome composto longo: até 2 linhas; o nome inteiro fica no title e nos detalhes
                      <span title={client.name} className="line-clamp-2">
                        {client.name}
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-ip-text-dim">
                    {isEditing ? (
                      <input
                        className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                        value={editForm.email || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                      />
                    ) : (
                      client.email
                    )}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-ip-text-dim tnum">
                    {formatDate(client.data_cadastro)}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-ip-text-dim tnum">
                    {formatDateTime(client.data_modificacao)}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-ip-text tnum">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                        value={editForm.valor_aportado || ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            valor_aportado: Number(e.target.value)
                          })
                        }
                      />
                    ) : (
                      formatMoney(client.valor_aportado)
                    )}
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-ip-text tnum">
                    {isEditing ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                        value={editForm.percentual_contrato ?? ''}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            percentual_contrato: Number(e.target.value)
                          })
                        }
                      />
                    ) : (
                      formatPercent(client.percentual_contrato)
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end items-center gap-3">
                      {isEditing ? (
                        <>
                          <button
                            onClick={handleSaveEdit}
                            className="text-ip-positive hover:text-ip-positive"
                            title="Salvar"
                            aria-label="Salvar"
                          >
                            <Check size={18} />
                          </button>

                          <button
                            onClick={handleCancelEdit}
                            className="text-ip-text-dim hover:text-ip-text"
                            title="Cancelar"
                            aria-label="Cancelar edição"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => onSelectClient(client)}
                            className="text-ip-text-dim hover:text-ip-text"
                            title="Detalhes"
                            aria-label={`Detalhes de ${client.name}`}
                          >
                            <ClipboardList size={18} />
                          </button>

                          <button
                            onClick={() => handleEditClick(client)}
                            className="text-ip-text-dim hover:text-ip-gold"
                            title="Editar"
                            aria-label={`Editar ${client.name}`}
                          >
                            <Pencil size={18} />
                          </button>

                          <button
                            onClick={() => handleDelete(client)}
                            className="text-ip-text-dim hover:text-ip-negative"
                            title="Excluir"
                            aria-label={`Excluir ${client.name}`}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

          {lista.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-8 text-ip-text-mute">
                Nenhum cliente encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* desenha 50 por vez: com 1.000 clientes a busca travava a cada letra */}
      {lista.length > visiveis.length && (
        <div className="flex items-center justify-between gap-3 border-t border-ip-border-soft px-6 py-4 text-sm text-ip-text-dim">
          <span className="tnum">
            Mostrando {visiveis.length.toLocaleString('pt-BR')} de {lista.length.toLocaleString('pt-BR')}
          </span>
          <button onClick={() => setLimite((n) => n + POR_PAGINA)} className="ip-btn ip-btn-ghost px-3.5 py-2">
            Mostrar mais {Math.min(POR_PAGINA, lista.length - visiveis.length)}
          </button>
        </div>
      )}
    </div>
  );
}