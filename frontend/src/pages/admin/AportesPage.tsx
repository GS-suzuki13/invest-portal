import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { Aporte, User } from '../../types';
import { formatDate, formatMoney, hoje, inputClass, parseValor } from '../../utils/dinheiro';
import SaquesTab from './SaquesTab';

const emptyForm = { userId: '', valor: '', data_recebimento: hoje(), observacao: '', historico: false };

type Aba = 'aporte' | 'saque';

export default function AportesPage() {
  const [aba, setAba] = useState<Aba>('aporte');

  return (
    <div className="space-y-8">
      <div>
        <p className="ip-eyebrow">Financeiro</p>
        <h2 className="mt-1 text-2xl font-bold text-ip-text">Aportes e saques</h2>
        <p className="text-ip-text-dim text-sm">
          {aba === 'aporte'
            ? 'Registre os aportes recebidos na conta da gestora'
            : 'Registre os saques pagos aos investidores'}
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-ip-surface-2 p-1" role="tablist">
        {(
          [
            ['aporte', 'Aporte'],
            ['saque', 'Saque'],
          ] as [Aba, string][]
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            role="tab"
            aria-selected={aba === valor}
            onClick={() => setAba(valor)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              aba === valor ? 'bg-ip-gold text-ip-navy' : 'text-ip-text-dim hover:text-ip-text'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'aporte' ? <AportesTab /> : <SaquesTab />}
    </div>
  );
}

function AportesTab() {
  const [investidores, setInvestidores] = useState<User[]>([]);
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const { dialogState, confirm, handleClose } = useConfirmDialog();

  const fetchAportes = useCallback(async () => {
    try {
      setLoading(true);
      setAportes(await CSVHandler.getAportes(filtro || undefined));
    } catch (error) {
      console.error('Erro ao carregar aportes.', error);
      setErro('Erro ao carregar aportes.');
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => {
    CSVHandler.getUsers()
      .then((users) =>
        setInvestidores(
          users.filter((u) => u.token === 'user').sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setErro('Erro ao carregar investidores.'));
  }, []);

  useEffect(() => {
    void fetchAportes();
  }, [fetchAportes]);

  const investidor = useMemo(
    () => investidores.find((u) => u.id === form.userId),
    [investidores, form.userId]
  );

  const handleSubmit = async () => {
    setErro('');
    setSucesso('');
    const valor = parseValor(form.valor);

    if (!investidor) return setErro('Selecione o investidor.');
    if (!Number.isFinite(valor) || valor <= 0) return setErro('Informe um valor válido (ex.: 1.234,56).');
    if (!form.data_recebimento) return setErro('Informe a data do recebimento.');

    const atual = investidor.valor_aportado || 0;
    const ok = await confirm({
      title: 'Registrar aporte',
      message: form.historico
        ? `Registrar aporte histórico de ${formatMoney(valor)} para ${investidor.name} (${formatDate(form.data_recebimento)})? O valor aportado continua ${formatMoney(atual)}. Aportes não podem ser editados nem excluídos.`
        : `Registrar aporte de ${formatMoney(valor)} para ${investidor.name} (${formatDate(form.data_recebimento)})? O valor aportado passa de ${formatMoney(atual)} para ${formatMoney((Math.round(atual * 100) + Math.round(valor * 100)) / 100)}. Aportes não podem ser editados nem excluídos.`,
      confirmLabel: 'Registrar',
    });
    if (!ok) return;

    try {
      setSubmitting(true);
      const { valor_aportado } = await CSVHandler.addAporte({
        userId: investidor.id,
        valor,
        data_recebimento: form.data_recebimento,
        observacao: form.observacao.trim() || undefined,
        historico: form.historico,
      });
      setInvestidores((lista) =>
        lista.map((u) => (u.id === investidor.id ? { ...u, valor_aportado } : u))
      );
      setSucesso(
        form.historico
          ? `Aporte registrado só no extrato. O valor aportado de ${investidor.name} não foi alterado (${formatMoney(valor_aportado)}).`
          : `Aporte registrado e somado ao valor aportado de ${investidor.name}: ${formatMoney(valor_aportado)}.`
      );
      setForm({ ...emptyForm, data_recebimento: hoje() });
      await fetchAportes();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar aporte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmDialog {...dialogState} onClose={handleClose} />

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Plus size={18} className="text-ip-gold" />
          <h3 className="text-lg font-semibold text-ip-text">Novo aporte</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Investidor</label>
            <select
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {investidores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {investidor && (
              <p className="mt-1.5 text-xs text-ip-text-mute">
                Valor aportado atual: {formatMoney(investidor.valor_aportado)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Valor (R$)</label>
            <input
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className={`${inputClass} tnum`}
              placeholder="Ex: 10.000,00"
            />
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Data do recebimento</label>
            <input
              type="date"
              value={form.data_recebimento}
              onChange={(e) => setForm({ ...form, data_recebimento: e.target.value })}
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="block text-sm text-ip-text-dim mb-2">Observação (opcional)</label>
            <input
              value={form.observacao}
              maxLength={500}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              className={inputClass}
              placeholder="Ex: TED Banco do Brasil"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 flex items-start gap-3">
            <input
              id="historico"
              type="checkbox"
              checked={form.historico}
              onChange={(e) => setForm({ ...form, historico: e.target.checked })}
              className="mt-0.5 h-4 w-4"
            />
            <label htmlFor="historico" className="text-sm text-ip-text-dim">
              Só registrar no extrato, sem somar no valor aportado (para aportes antigos)
              <span className="block text-xs text-ip-text-mute">
                Deixe desmarcado para aportes novos. Marque só para aportes que já estão incluídos no valor aportado atual.
              </span>
            </label>
          </div>
        </div>

        {erro && <p className="mt-4 text-sm text-ip-negative">{erro}</p>}
        {sucesso && <p className="mt-4 text-sm text-ip-positive">{sucesso}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="mt-5 h-11 bg-ip-gold hover:bg-ip-gold-600 !text-ip-navy font-semibold px-5 rounded-lg text-sm disabled:opacity-50"
        >
          {submitting ? 'Salvando...' : 'Registrar aporte'}
        </button>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-xl p-4">
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="w-full sm:max-w-sm bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
        >
          <option value="">Todos os investidores</option>
          {investidores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-ip-text-dim">Carregando aportes...</div>
        ) : aportes.length === 0 ? (
          <div className="py-8 text-center text-sm text-ip-text-mute">Nenhum aporte registrado</div>
        ) : (
          <>
          {/* celular: cartões (a tabela espreme nomes longos e corta o valor) */}
          <ul className="md:hidden divide-y divide-ip-border-soft">
            {aportes.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-ip-text">{a.nome || '—'}</p>
                  <span className="tnum whitespace-nowrap text-sm font-semibold text-ip-positive">
                    {formatMoney(a.valor)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ip-text-mute">
                  {formatDate(a.data_recebimento)}
                  {a.observacao && ` · ${a.observacao}`}
                  {!a.somado_ao_aportado && (
                    <span className="ml-2 ip-chip ip-selo">histórico</span>
                  )}
                </p>
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left text-ip-text-dim">
              <thead className="bg-ip-surface-2 text-ip-text-dim uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Investidor</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4">Observação</th>
                </tr>
              </thead>
              <tbody>
                {aportes.map((a) => (
                  <tr key={a.id} className="border-t border-ip-border-soft hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(a.data_recebimento)}</td>
                    <td className="px-6 py-4 font-medium text-ip-text">{a.nome || '—'}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap tnum text-ip-positive">
                      {formatMoney(a.valor)}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {a.observacao || '—'}
                      {!a.somado_ao_aportado && (
                        <span className="ml-2 ip-chip ip-selo">histórico</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
