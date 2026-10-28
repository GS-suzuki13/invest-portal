import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Repeat,
  TrendingUp,
  X,
  XCircle
} from 'lucide-react';
import type { Evento, EventoStatus, User } from '../../types';
import { CSVHandler } from '../../utils/csvHandler';
import { AnimatePresence } from 'motion/react';
import Modal from '../ui/Modal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../ui/ConfirmDialog';

interface ClientWithRepasse extends User {
  proximoRepasse: string;
}

interface CalendarDay {
  day: number | null;
  clients: ClientWithRepasse[];
  eventos: Evento[];
}

interface RepasseCalendarProps {
  clientesProximoRepasse: ClientWithRepasse[];
  eventos: Evento[];
  onEventoUpdated: () => void;
}

export default function RepasseCalendar({
  clientesProximoRepasse,
  eventos,
  onEventoUpdated
}: RepasseCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { dialogState, alert, handleClose } = useConfirmDialog();

  const today = new Date().getDate();

  const parsePtBrDate = (date: string) => {
    const [day, month, year] = date.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const parseIsoDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const calendarDays = useMemo<CalendarDay[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();

    const days: CalendarDay[] = [];

    for (let i = 0; i < startWeekday; i++) {
      days.push({ day: null, clients: [], eventos: [] });
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const clientsInDay = clientesProximoRepasse.filter((client) => {
        const date = parsePtBrDate(client.proximoRepasse);
        return date.getDate() === day;
      });

      const eventosInDay = eventos.filter((evento) => {
        if (!evento.data) return false;

        const date = parseIsoDate(evento.data);
        return (
          date.getDate() === day &&
          date.getMonth() === month &&
          date.getFullYear() === year
        );
      });

      days.push({
        day,
        clients: clientsInDay,
        eventos: eventosInDay
      });
    }

    return days;
  }, [clientesProximoRepasse, eventos]);

  const currentMonthName = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const statusClass = (status: EventoStatus) => {
    if (status === 'concluido') return 'text-ip-positive border-emerald-500/20 bg-ip-positive/10';
    if (status === 'cancelado') return 'text-ip-negative border-ip-negative/25 bg-ip-negative/10';
    return 'text-ip-gold border-yellow-500/20 bg-yellow-500/10';
  };

  const statusIcon = (status: EventoStatus) => {
    if (status === 'concluido') return <CheckCircle size={14} />;
    if (status === 'cancelado') return <XCircle size={14} />;
    return <Clock size={14} />;
  };

  const updateEventoStatus = async (evento: Evento, status: EventoStatus) => {
    if (!evento.id) return;

    try {
      setUpdatingId(evento.id);
      await CSVHandler.updateEvento(evento.id, { status });
      await onEventoUpdated();

      setSelectedDay((current) => {
        if (!current) return current;

        return {
          ...current,
          eventos: current.eventos.map((item) =>
            item.id === evento.id ? { ...item, status } : item
          )
        };
      });
    } catch (error) {
      console.error('Erro ao atualizar status do evento.', error);
      await alert({ title: 'Erro', message: 'Erro ao atualizar status do evento.', tone: 'danger' });
    } finally {
      setUpdatingId(null);
    }
  };

  const totalEventosMes = calendarDays.reduce(
    (acc, day) => acc + day.eventos.length,
    0
  );

  const totalRepassesMes = clientesProximoRepasse.length;

  return (
    <>
      <ConfirmDialog {...dialogState} onClose={handleClose} />
      <section className="bg-ip-surface border border-ip-border-soft rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-ip-text capitalize">
              Calendário — {currentMonthName}
            </h3>
            <p className="text-sm text-ip-text-dim">
              Clique em uma data para visualizar repasses e eventos do dia
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-ip-surface-2 border border-ip-sky/25 rounded-xl px-4 py-2">
              <p className="text-xs text-ip-text-dim">Repasses no mês</p>
              <p className="text-xl font-bold text-ip-gold">{totalRepassesMes}</p>
            </div>

            <div className="bg-ip-surface-2 border border-emerald-500/20 rounded-xl px-4 py-2">
              <p className="text-xs text-ip-text-dim">Eventos no mês</p>
              <p className="text-xl font-bold text-ip-positive">{totalEventosMes}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-5 text-xs">
          <div className="flex items-center gap-2 text-ip-gold">
            <span className="w-3 h-3 rounded-full bg-ip-sky/70" />
            Repasse
          </div>

          <div className="flex items-center gap-2 text-ip-positive">
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
            Evento
          </div>

          <div className="flex items-center gap-2 text-yellow-300">
            <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
            Hoje
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center ip-selo sm:text-xs text-ip-text-mute py-1"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((item, index) => {
            const hasClients = item.clients.length > 0;
            const hasEventos = item.eventos.length > 0;
            const hasContent = hasClients || hasEventos;
            const isSelected = selectedDay?.day === item.day && hasContent;
            const isToday = item.day === today;

            return (
              <button
                key={index}
                type="button"
                disabled={!item.day || !hasContent}
                onClick={() => setSelectedDay(item)}
                className={`
                  min-h-[92px] sm:min-h-[116px] rounded-xl border p-2 text-left relative
                  ${
                    item.day
                      ? 'bg-ip-surface-2 border-ip-border-soft'
                      : 'bg-transparent border-transparent'
                  }
                  ${hasContent ? 'cursor-pointer hover:border-ip-sky/40 hover:bg-white/[0.04]' : 'cursor-default'}
                  ${isSelected ? 'border-ip-sky/60 bg-ip-sky/10' : ''}
                  ${isToday ? 'border-yellow-400/70 bg-yellow-400/5' : ''}
                `}
              >
                {item.day && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`
                          text-xs sm:text-sm font-semibold
                          ${isToday ? 'text-yellow-300' : 'text-ip-text'}
                        `}
                      >
                        {item.day}
                      </span>

                      {hasContent && (
                        <span className="ip-selo bg-white/10 text-ip-text-dim rounded-full px-1.5">
                          {item.clients.length + item.eventos.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {item.clients.slice(0, 1).map((client) => (
                        <div
                          key={`repasse-${client.id || client.user}`}
                          title={`${client.name} - ${client.proximoRepasse}`}
                          className="bg-ip-sky/10 border border-ip-sky/25 rounded-md px-1.5 py-1"
                        >
                          <p className="ip-selo text-ip-sky truncate flex items-center gap-1">
                            <TrendingUp size={10} />
                            {client.name}
                          </p>
                        </div>
                      ))}

                      {item.eventos.slice(0, 2).map((evento) => (
                        <div
                          key={`evento-${evento.id}`}
                          title={evento.nome}
                          className="bg-ip-positive/10 border border-emerald-500/20 rounded-md px-1.5 py-1"
                        >
                          <p className="ip-selo text-emerald-200 truncate flex items-center gap-1">
                            <CalendarDays size={10} />
                            {evento.nome}
                          </p>
                        </div>
                      ))}

                      {item.clients.length + item.eventos.length > 3 && (
                        <p className="ip-selo text-ip-text-mute">
                          +{item.clients.length + item.eventos.length - 3}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {clientesProximoRepasse.length === 0 && totalEventosMes === 0 && (
          <div className="mt-5 bg-ip-surface-2 border border-ip-border-soft rounded-xl p-4 text-center text-ip-text-mute text-sm">
            Nenhum repasse ou evento previsto para o mês atual.
          </div>
        )}
      </section>

      <AnimatePresence>
      {selectedDay && (selectedDay.clients.length > 0 || selectedDay.eventos.length > 0) && (
        <Modal z="z-[999]" onEsc={() => setSelectedDay(null)} className="max-w-5xl max-h-[88vh] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-ip-border px-5 py-4">
              <div>
                <h4 className="text-ip-text font-semibold text-lg">
                  Agenda do dia {String(selectedDay.day).padStart(2, '0')}
                </h4>
                <p className="text-sm text-ip-text-dim">
                  {selectedDay.clients.length} repasse(s) e {selectedDay.eventos.length} evento(s)
                </p>
              </div>

              <button aria-label="Fechar"
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-lg text-ip-text-dim hover:text-ip-text hover:bg-white/[0.04]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(88vh-88px)] space-y-6">
              {selectedDay.clients.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={18} className="text-ip-gold" />
                    <h5 className="text-ip-text font-semibold">Repasses</h5>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDay.clients.map((client) => (
                      <div
                        key={client.id || client.user}
                        className="bg-ip-sky/5 border border-ip-sky/25 rounded-xl p-4"
                      >
                        <p className="text-ip-text font-medium">{client.name}</p>
                        <p className="text-ip-text-dim text-sm mt-1">Usuário: {client.user}</p>
                        <p className="text-ip-text-dim text-sm">Repasse: {client.proximoRepasse}</p>
                        <p className="text-ip-text-dim text-sm">
                          Aportado:{' '}
                          {Number(client.valor_aportado || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          })}
                        </p>
                        <p className="text-ip-text-dim text-sm">
                          Contrato: {client.percentual_contrato || 0}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedDay.eventos.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays size={18} className="text-ip-positive" />
                    <h5 className="text-ip-text font-semibold">Eventos</h5>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedDay.eventos.map((evento) => (
                      <div
                        key={evento.id}
                        className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-ip-text font-medium">{evento.nome}</p>
                            <p className="text-ip-text-mute text-xs">
                              {evento.categoria || 'Sem categoria'}
                            </p>
                          </div>

                          {evento.recorrente && (
                            <span className="inline-flex items-center gap-1 text-xs text-ip-sky bg-ip-sky/10 border border-ip-sky/25 rounded-full px-2 py-1">
                              <Repeat size={12} />
                              Recorrente
                            </span>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-ip-text-mute mb-1">
                              Status
                            </label>

                            <select
                              value={evento.status}
                              disabled={updatingId === evento.id}
                              onChange={(e) =>
                                updateEventoStatus(evento, e.target.value as EventoStatus)
                              }
                              className={`w-full bg-ip-surface-2 border rounded-lg px-3 py-2 text-sm focus:outline-none ${statusClass(evento.status)}`}
                            >
                              <option value="pendente">Pendente</option>
                              <option value="concluido">Concluído</option>
                              <option value="cancelado">Cancelado</option>
                            </select>
                          </div>

                          <div
                            className={`inline-flex items-center gap-1 border rounded-full px-2 py-1 text-xs ${statusClass(evento.status)}`}
                          >
                            {statusIcon(evento.status)}
                            {evento.status}
                          </div>

                          <div>
                            <p className="text-xs text-ip-text-mute mb-1">Observação</p>
                            <p className="text-sm text-ip-text-dim bg-ip-surface-2 border border-ip-border-soft rounded-lg p-3 min-h-12">
                              {evento.observacao || 'Sem observação'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </Modal>
      )}
      </AnimatePresence>
    </>
  );
}