import React, { useState } from 'react';
import { User, Mail, CreditCard, DollarSign, UserCheck, Shield, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';
import { CSVHandler } from '../utils/csvHandler';
import { dataLocalISO } from '../utils/date';

interface ClientRegistrationFormProps {
  onClientRegistered: (user: UserType) => void;
}

export default function ClientRegistrationForm({
  onClientRegistered
}: ClientRegistrationFormProps) {
  const [formData, setFormData] = useState({
    nomeCompleto: '',
    cpf: '',
    email: '',
    valorAportado: '',
    tipoUsuario: 'user' as 'user' | 'adm',
    percentualContrato: ''
  });

  const [displayValor, setDisplayValor] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [createdUser, setCreatedUser] = useState<{ username: string; password: string } | null>(null);

  const generateUsername = (nome: string): string => {
    const partes = nome.trim().toLowerCase().split(/\s+/);
    if (!partes[0]) return '';
    if (partes.length === 1) return partes[0];
    return `${partes[0]}.${partes[partes.length - 1]}`;
  };

  const generatePassword = (cpf: string): string =>
    cpf.replace(/\D/g, '').substring(0, 6);

  const formatCPF = (value: string) => {
    const cpfNumbers = value.replace(/\D/g, '');
    return cpfNumbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  };

  const validateCPF = (cpf: string) => {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[9])) return false;

    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf[10])) return false;

    return true;
  };

  const handleValorAportadoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError('');
    const raw = e.target.value.replace(/\D/g, '');
    const numberValue = parseFloat(raw) / 100;

    if (isNaN(numberValue)) {
      setDisplayValor('');
      setFormData((prev) => ({ ...prev, valorAportado: '' }));
      return;
    }

    const formatted = numberValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    setDisplayValor(formatted);
    setFormData((prev) => ({ ...prev, valorAportado: numberValue.toString() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateCPF(formData.cpf)) {
      setError('CPF inválido. Verifique e tente novamente.');
      return;
    }

    const valorAportado = parseFloat(formData.valorAportado);
    const percentualContrato = parseFloat(formData.percentualContrato);

    if (!Number.isFinite(valorAportado) || valorAportado <= 0) {
      setError('Informe um valor aportado válido.');
      return;
    }
    if (!Number.isFinite(percentualContrato) || percentualContrato <= 0) {
      setError('Informe um percentual de contrato válido.');
      return;
    }

    const username = generateUsername(formData.nomeCompleto);
    if (!username) {
      setError('Informe o nome completo do cliente.');
      return;
    }

    setLoading(true);

    try {
      const password = generatePassword(formData.cpf);

      const newUser: UserType = {
        id: crypto.randomUUID(),
        user: username,
        password,
        token: formData.tipoUsuario,
        name: formData.nomeCompleto.trim(),
        cpf: formData.cpf,
        email: formData.email.trim(),
        data_cadastro: dataLocalISO(),
        valor_aportado: valorAportado,
        percentual_contrato: percentualContrato,
        data_modificacao: new Date().toISOString()
      };

      const response = await CSVHandler.addUser(newUser);

      if (response?.success) {
        setCreatedUser({ username, password });
        onClientRegistered(newUser);
        setSuccess(true);

        setFormData({
          nomeCompleto: '',
          cpf: '',
          email: '',
          valorAportado: '',
          tipoUsuario: 'user',
          percentualContrato: ''
        });

        setDisplayValor('');
      } else {
        setError('O servidor não confirmou o cadastro. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao cadastrar cliente:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao cadastrar cliente. Tente novamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (error) setError('');
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'cpf' ? formatCPF(value) : value
    }));
  };

  if (success) {
    return (
      <div className="bg-ip-surface rounded-2xl shadow-xl border border-ip-border p-8 text-center">
        <button
          type="button"
          onClick={() => {
            setSuccess(false);
            setCreatedUser(null);
          }}
          className="mb-6 text-sm text-ip-text-dim hover:text-ip-text"
        >
          ← Cadastrar outro cliente
        </button>
        <div className="w-16 h-16 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserCheck className="w-8 h-8 text-ip-positive" />
        </div>

        <h2 className="text-2xl font-bold text-ip-text mb-2">
          Cliente cadastrado com sucesso!
        </h2>

        <p className="text-ip-text-dim mb-6">
          O novo acesso foi criado e já pode ser utilizado.
        </p>

        <div className="bg-ip-surface-2 border border-ip-border-soft rounded-xl p-5 text-left max-w-md mx-auto space-y-3">
          <div className="flex items-center gap-2 text-ip-text-dim text-sm">
            <User className="w-4 h-4" />
            <span>Usuário</span>
          </div>
          <p className="text-ip-text font-semibold break-all">
            {createdUser?.username || '-'}
          </p>

          <div className="flex items-center gap-2 text-ip-text-dim text-sm pt-2">
            <KeyRound className="w-4 h-4" />
            <span>Senha inicial</span>
          </div>
          <p className="text-ip-text font-semibold">
            {createdUser?.password || '-'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ip-surface rounded-2xl shadow-xl border border-ip-border overflow-hidden">
      <div className="px-6 py-5 border-b border-ip-border">
        <h2 className="text-lg font-semibold text-ip-text">
          Cadastrar Novo Cliente
        </h2>
        <p className="text-sm text-ip-text-dim mt-1">
          Preencha os dados para criar um novo acesso no sistema
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Nome Completo">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ip-text-dim" />
              <input
                type="text"
                name="nomeCompleto"
                value={formData.nomeCompleto}
                onChange={handleChange}
                className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                placeholder="Digite o nome completo"
                required
              />
            </div>
          </Field>

          <Field label="CPF">
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ip-text-dim" />
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                placeholder="000.000.000-00"
                required
                maxLength={14}
              />
            </div>
          </Field>

          <Field label="Email">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ip-text-dim" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                placeholder="Digite o email"
                required
              />
            </div>
          </Field>

          <Field label="Valor Aportado">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ip-text-dim" />
              <input
                type="text"
                name="valorAportado"
                value={displayValor}
                onChange={handleValorAportadoChange}
                className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
                placeholder="R$ 0,00"
                inputMode="numeric"
                required
              />
            </div>
          </Field>

          <Field label="Tipo de Usuário">
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ip-text-dim pointer-events-none" />
              <select
                name="tipoUsuario"
                value={formData.tipoUsuario}
                onChange={handleChange}
                className="w-full appearance-none bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
              >
                <option value="user">Cliente</option>
                <option value="adm">Administrador</option>
              </select>
            </div>
          </Field>

          <Field label="Percentual de Contrato">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              name="percentualContrato"
              value={formData.percentualContrato}
              onChange={handleChange}
              className="w-full bg-ip-surface-2 border border-ip-border text-ip-text rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ip-gold/25 focus:border-ip-gold/60"
              placeholder="Ex: 2.75"
              required
            />
          </Field>
        </div>

        {error && (
          <div className="rounded-xl border border-ip-negative/25 bg-ip-negative/10 px-4 py-3 text-sm text-ip-negative">
            {error}
          </div>
        )}

        <div className="border-t border-ip-border pt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="bg-ip-surface-2 border border-ip-border-soft rounded-xl p-4 text-sm space-y-2">
            <p className="text-ip-text-dim">
              Usuário será:{' '}
              <strong className="text-ip-text">
                {generateUsername(formData.nomeCompleto) || '[nome.sobrenome]'}
              </strong>
            </p>
            <p className="text-ip-text-dim">
              Senha será:{' '}
              <strong className="text-ip-text">
                {generatePassword(formData.cpf) || '[6 primeiros dígitos do CPF]'}
              </strong>
            </p>
            <p className="text-ip-text-dim">
              Contrato:{' '}
              <strong className="text-ip-text">
                {formData.percentualContrato || '0'}%
              </strong>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-ip-gold hover:bg-ip-gold-600 !text-ip-navy font-semibold disabled:opacity-50 text-ip-text font-medium rounded-lg"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-ip-text-dim mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}