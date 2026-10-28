import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, Users, Calendar, CalendarDays } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import { apiFetch } from '../../utils/api';
import type { User, Evento } from '../../types';
import { calculateNextRepasseBusinessDays } from '../../utils/calculateNextRepasse';
import RepasseCalendar from '../../components/admin/RepasseCalendar';
import StatCard from '../../components/ui/StatCard';

interface Repasse {
  id: number;
  label: string;
  start: string;
  end: string;
}

interface ClientWithRepasse extends User {
  proximoRepasse: string;
}

export default function DashboardPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [clientesProximoRepasse, setClientesProximoRepasse] = useState<ClientWithRepasse[]>([]);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env.VITE_API_URL;

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const parsePtBrDate = (date: string) => {
    const [day, month, year] = date.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const fetchRepasses = useCallback(async (client: User): Promise<Repasse[]> => {
    try {
      const response = await apiFetch(`${apiUrl}/repasse/${client.id}`);
      if (!response.ok) return [];

      const data = await response.json();

      return Array.isArray(data?.repasses)
        ? data.repasses
        : Array.isArray(data)
          ? data
          : [];
    } catch {
      return [];
    }
  }, [apiUrl]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);

    try {
      const [usersData, eventosData] = await Promise.all([
        CSVHandler.getUsers(),
        CSVHandler.getEventos(),
      ]);

      const onlyClients = usersData.filter((user) => user.token !== 'adm');

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const clientsWithRepasse = await Promise.all(
        onlyClients
          .filter((cliente) => cliente.data_cadastro)
          .map(async (cliente) => {
            const repasses = await fetchRepasses(cliente);

            const proximoRepasse = calculateNextRepasseBusinessDays(
              cliente.data_cadastro,
              repasses
            );

            return { ...cliente, proximoRepasse };
          })
      );

      const clientesDoMes = clientsWithRepasse.filter((cliente) => {
        if (!cliente.proximoRepasse || cliente.proximoRepasse === '—') return false;

        const date = parsePtBrDate(cliente.proximoRepasse);

        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });

      setClients(onlyClients);
      setEventos(eventosData);
      setClientesProximoRepasse(clientesDoMes);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setClients([]);
      setEventos([]);
      setClientesProximoRepasse([]);
    } finally {
      setLoading(false);
    }
  }, [fetchRepasses]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalAportado = useMemo(() => {
    return clients.reduce((acc, client) => acc + Number(client.valor_aportado || 0), 0);
  }, [clients]);

  const eventosAtivos = eventos.filter((evento) => evento.status !== 'cancelado');

  return (
    <div className="space-y-7">
      <div className="animate-fade-up">
        <p className="ip-eyebrow">Painel</p>
        <h2 className="mt-1 text-2xl font-bold text-ip-text">
          Visão geral
        </h2>
        <p className="mt-1 text-sm text-ip-text-dim">
          Aportes, repasses e eventos do período
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="animate-fade-up delay-1">
              <StatCard
                label="Total aportado"
                value={formatCurrency(totalAportado)}
                icon={<DollarSign className="h-4 w-4" />}
                tone="gold"
              />
            </div>
            <div className="animate-fade-up delay-2">
              <StatCard
                label="Clientes ativos"
                value={String(clients.length)}
                icon={<Users className="h-4 w-4" />}
                tone="navy"
              />
            </div>
            <div className="animate-fade-up delay-3">
              <StatCard
                label="Repasses este mês"
                value={String(clientesProximoRepasse.length)}
                icon={<Calendar className="h-4 w-4" />}
                tone="neutral"
              />
            </div>
            <div className="animate-fade-up delay-4">
              <StatCard
                label="Eventos ativos"
                value={String(eventosAtivos.length)}
                icon={<CalendarDays className="h-4 w-4" />}
                tone="positive"
              />
            </div>
          </div>

          <div className="animate-fade-up delay-4">
            <RepasseCalendar
              clientesProximoRepasse={clientesProximoRepasse}
              eventos={eventos}
              onEventoUpdated={loadDashboardData}
            />
          </div>
        </>
      )}
    </div>
  );
}