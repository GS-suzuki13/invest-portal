import { useCallback, useEffect, useMemo, useState } from 'react';
import { Minus } from 'lucide-react';
import { CSVHandler } from '../../utils/csvHandler';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { formatDate, formatMoney, hoje, inputClass, parseValor } from '../../utils/dinheiro';
import type { Saque, User } from '../../types';

const emptyForm = { userId: '', valor: '', data_saque: hoje(), observacao: '', historico: false };

/** Aba "Saque" da página de Aportes: espelho do aporte, mas subtrai do valor aportado. */
export default function SaquesTab() {
  const [investidores, setInvestidores] = useState<User[]>([]);
  const [saques, setSaques] = useState<Saque[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [filtro, setFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const { dialogState, confirm, handleClose } = useConfirmDialog();

  const fetchSaques = useCallback(async () => {
    try {
      setLoading(true);
      setSaques(await CSVHandler.getSaques(filtro || undefined));
    } catch (error) {
      console.error('Erro ao carregar saques.', error);
      setErro('Erro ao carregar saques.');
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
    void fetchSaques();
  }, [fetchSaques]);

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
    if (!form.data_saque) return setErro('Informe a data do saque.');

    const atual = investidor.valor_aportado || 0;
    const novo = (Math.round(atual * 100) - Math.round(valor * 100)) / 100;
    if (!form.historico && novo < 0) {
      return setErro(`O saque não pode ser maior que o valor aportado (${formatMoney(atual)}).`);
    }

    const ok = await confirm({
      title: 'Registrar saque',
      message: form.historico
        ? `Registrar saque histórico de ${formatMoney(valor)} para ${investidor.name} (${formatDate(form.data_saque)})? O valor aportado continua ${formatMoney(atual)} e o investidor não é avisado. Saques não podem ser editados nem excluídos.`
        : `Registrar saque de ${formatMoney(valor)} para ${investidor.name} (${formatDate(form.data_saque)})? O valor aportado passa de ${formatMoney(atual)} para ${formatMoney(novo)} e o investidor recebe o informe pelo chat do site. Saques não podem ser editados nem excluídos.`,
      confirmLabel: 'Registrar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setSubmitting(true);
      const { valor_aportado } = await CSVHandler.addSaque({
        userId: investidor.id,
        valor,
        data_saque: form.data_saque,
        observacao: form.observacao.trim() || undefined,
        historico: form.historico,
      });
      setInvestidores((lista) =>
        lista.map((u) => (u.id === investidor.id ? { ...u, valor_aportado } : u))
      );
      setSucesso(
        form.historico
          ? `Saque registrado só no extrato. O valor aportado de ${investidor.name} não foi alterado (${formatMoney(valor_aportado)}).`
          : `Saque registrado e descontado do valor aportado de ${investidor.name}: ${formatMoney(valor_aportado)}. Informe enviado pelo chat.`
      );
      setForm({ ...emptyForm, data_saque: hoje() });
      await fetchSaques();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao registrar saque.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <ConfirmDialog {...dialogState} onClose={handleClose} />

      <div className="bg-ip-surface border border-ip-border-soft rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <Minus size={18} className="text-ip-gold" />
          <h3 className="text-lg font-semibold text-ip-text">Novo saque</h3>
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
              placeholder="Ex: 1.000,00"
            />
          </div>

          <div>
            <label className="block text-sm text-ip-text-dim mb-2">Data do saque</label>
            <input
              type="date"
              value={form.data_saque}
              onChange={(e) => setForm({ ...form, data_saque: e.target.value })}
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
              placeholder="Ex: PIX para conta do investidor"
            />
          </div>

          <div className="md:col-span-2 xl:col-span-3 flex items-start gap-3">
            <input
              id="saque-historico"
              type="checkbox"
              checked={form.historico}
              onChange={(e) => setForm({ ...form, historico: e.target.checked })}
              className="mt-0.5 h-4 w-4"
            />
            <label htmlFor="saque-historico" className="text-sm text-ip-text-dim">
              Só registrar no extrato, sem descontar do valor aportado (para saques antigos)
              <span className="block text-xs text-ip-text-mute">
                Deixe desmarcado para saques novos. Marque só para saques que já estão descontados do valor aportado atual.
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
          {submitting ? 'Salvando...' : 'Registrar saque'}
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
          <div className="p-10 text-center text-ip-text-dim">Carregando saques...</div>
        ) : saques.length === 0 ? (
          <div className="py-8 text-center text-sm text-ip-text-mute">Nenhum saque registrado</div>
        ) : (
          <>
          {/* celular: cartões (a tabela espreme nomes longos e corta o valor) */}
          <ul className="md:hidden divide-y divide-ip-border-soft">
            {saques.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium text-ip-text">{s.nome || '—'}</p>
                  <span className="tnum whitespace-nowrap text-sm font-semibold text-ip-negative">
                    − {formatMoney(s.valor)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ip-text-mute">
                  {formatDate(s.data_saque)}
                  {s.observacao && ` · ${s.observacao}`}
                  {!s.descontado_do_aportado && (
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
                {saques.map((s) => (
                  <tr key={s.id} className="border-t border-ip-border-soft hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">{formatDate(s.data_saque)}</td>
                    <td className="px-6 py-4 font-medium text-ip-text">{s.nome || '—'}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap tnum text-ip-negative">
                      − {formatMoney(s.valor)}
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      {s.observacao || '—'}
                      {!s.descontado_do_aportado && (
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
