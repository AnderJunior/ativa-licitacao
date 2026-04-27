import React, { useState, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Filter, Search, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Agrupamento = 'anual' | 'mensal' | 'diario' | 'turno' | 'hora';

interface RegistroBruto {
  created_at: string;
  tipo_cadastro: string | null;
  cadastrado_por: string | null;
}

interface LinhaRelatorio {
  label: string;
  hIni?: string;
  hFim?: string;
  pncp: number;
  lic: number;
  total: number;
}

interface DadosUsuario {
  nome: string;
  userId: string;
  linhas: LinhaRelatorio[];
  totalPncp: number;
  totalLic: number;
  totalGeral: number;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR');
}

function getDefaultDataInicio(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function getDefaultDataFim(): string {
  const now = new Date();
  now.setHours(23, 59, 0, 0);
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function isPncp(tipo: string | null): boolean {
  if (!tipo) return true; // null = importado via API = PNCP
  return tipo.toLowerCase() !== 'manual';
}

function agruparDados(registros: RegistroBruto[], agrupamento: Agrupamento): LinhaRelatorio[] {
  if (registros.length === 0) return [];

  const groups = new Map<string, RegistroBruto[]>();

  for (const r of registros) {
    const d = new Date(r.created_at);
    let key: string;

    switch (agrupamento) {
      case 'anual':
        key = `${d.getFullYear()}`;
        break;
      case 'mensal':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'diario':
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        break;
      case 'turno': {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const turno = d.getHours() < 13 ? 'AM' : 'PM';
        key = `${dateStr} ${turno}`;
        break;
      }
      case 'hora': {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        key = `${dateStr} ${String(d.getHours()).padStart(2, '0')}h`;
        break;
      }
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const sortedKeys = Array.from(groups.keys()).sort();
  const linhas: LinhaRelatorio[] = [];

  for (const key of sortedKeys) {
    const items = groups.get(key)!;
    const sorted = items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const pncp = items.filter(i => isPncp(i.tipo_cadastro)).length;
    const lic = items.filter(i => !isPncp(i.tipo_cadastro)).length;

    let label = key;
    if (agrupamento === 'anual') label = key;
    else if (agrupamento === 'mensal') {
      const [y, m] = key.split('-');
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      label = `${meses[parseInt(m) - 1]}/${y}`;
    } else if (agrupamento === 'diario') {
      const parts = key.split('-');
      label = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const temHorario = agrupamento === 'diario' || agrupamento === 'turno' || agrupamento === 'hora';

    linhas.push({
      label,
      hIni: temHorario ? formatTime(sorted[0].created_at) : undefined,
      hFim: temHorario ? formatTime(sorted[sorted.length - 1].created_at) : undefined,
      pncp,
      lic,
      total: pncp + lic,
    });
  }

  return linhas;
}

// Gera linhas vazias para horas/turnos sem registros no período
function gerarLinhasCompletas(
  linhas: LinhaRelatorio[],
  agrupamento: Agrupamento,
  dataInicio: string,
  dataFim: string
): LinhaRelatorio[] {
  if (agrupamento !== 'hora' && agrupamento !== 'turno') return linhas;

  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  const existentes = new Set(linhas.map(l => l.label));
  const todas: LinhaRelatorio[] = [];

  if (agrupamento === 'hora') {
    const cursor = new Date(inicio);
    cursor.setMinutes(0, 0, 0);
    while (cursor <= fim) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      const key = `${dateStr} ${String(cursor.getHours()).padStart(2, '0')}h`;
      const existente = linhas.find(l => l.label === key);
      if (existente) {
        todas.push(existente);
      } else {
        todas.push({ label: key, hIni: '', hFim: '', pncp: 0, lic: 0, total: 0 });
      }
      cursor.setHours(cursor.getHours() + 1);
    }
  } else if (agrupamento === 'turno') {
    const cursor = new Date(inicio);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= fim) {
      const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      for (const turno of ['AM', 'PM']) {
        const key = `${dateStr} ${turno}`;
        const existente = linhas.find(l => l.label === key);
        if (existente) {
          todas.push(existente);
        } else {
          todas.push({ label: key, hIni: '', hFim: '', pncp: 0, lic: 0, total: 0 });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return todas.length > 0 ? todas : linhas;
}

export default function RelatorioProdutividade() {
  const [dataInicio, setDataInicio] = useState(getDefaultDataInicio());
  const [dataFim, setDataFim] = useState(getDefaultDataFim());
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('hora');
  const [loading, setLoading] = useState(false);
  const [dadosUsuarios, setDadosUsuarios] = useState<DadosUsuario[]>([]);
  const [consultado, setConsultado] = useState(false);

  const temHorario = agrupamento === 'diario' || agrupamento === 'turno' || agrupamento === 'hora';

  const consultar = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      toast.error('Informe data inicial e final');
      return;
    }
    setLoading(true);
    setConsultado(true);

    try {
      // Buscar contratações cadastradas no período
      const registros = await api.get<RegistroBruto[]>('/api/contratacoes/relatorio/produtividade', {
        dt_inicio: new Date(dataInicio).toISOString(),
        dt_fim: new Date(dataFim).toISOString(),
      });

      if (!registros || registros.length === 0) {
        setDadosUsuarios([]);
        setLoading(false);
        return;
      }

      // Buscar nomes dos usuários
      const userIds = [...new Set(registros.map(r => r.cadastrado_por).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const profiles = await api.get<{ user_id: string; full_name: string | null }[]>('/api/profiles', { user_ids: userIds.join(',') });
        (profiles || []).forEach((p) => { profilesMap[p.user_id] = p.full_name || 'Sem nome'; });
      }

      // Agrupar por usuário
      const porUsuario = new Map<string, RegistroBruto[]>();
      for (const r of registros) {
        const uid = r.cadastrado_por || '_sem_usuario';
        if (!porUsuario.has(uid)) porUsuario.set(uid, []);
        porUsuario.get(uid)!.push(r);
      }

      // Gerar dados para cada usuário
      const resultado: DadosUsuario[] = [];
      for (const [userId, regs] of porUsuario) {
        const linhasBase = agruparDados(regs, agrupamento);
        const linhas = gerarLinhasCompletas(linhasBase, agrupamento, dataInicio, dataFim);
        const totalPncp = linhas.reduce((s, l) => s + l.pncp, 0);
        const totalLic = linhas.reduce((s, l) => s + l.lic, 0);

        resultado.push({
          nome: userId === '_sem_usuario' ? 'Sem usuário' : (profilesMap[userId] || 'Desconhecido'),
          userId,
          linhas,
          totalPncp,
          totalLic,
          totalGeral: totalPncp + totalLic,
        });
      }

      // Ordenar por nome
      resultado.sort((a, b) => a.nome.localeCompare(b.nome));
      setDadosUsuarios(resultado);
    } catch (err: any) {
      toast.error('Erro ao consultar: ' + (err.message || err));
    }
    setLoading(false);
  }, [dataInicio, dataFim, agrupamento]);

  const exportarExcel = useCallback(() => {
    if (dadosUsuarios.length === 0) return;

    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];

    // Linha 1: nomes dos usuários com colspan
    const header1: any[] = [''];
    for (const u of dadosUsuarios) {
      header1.push(u.nome);
      if (temHorario) { header1.push('', '', '', ''); } else { header1.push('', ''); }
    }
    rows.push(header1);

    // Linha 2: sub-headers
    const header2: any[] = ['Agrupar'];
    for (const u of dadosUsuarios) {
      if (temHorario) { header2.push('H.Ini', 'H.Fim', 'Pncp', 'Lic', 'Total'); }
      else { header2.push('Pncp', 'Lic', 'Total'); }
    }
    rows.push(header2);

    // Linhas de dados
    const maxRows = Math.max(...dadosUsuarios.map(u => u.linhas.length));
    for (let i = 0; i < maxRows; i++) {
      const row: any[] = [dadosUsuarios[0]?.linhas[i]?.label || ''];
      for (const u of dadosUsuarios) {
        const l = u.linhas[i];
        if (temHorario) { row.push(l?.hIni || '', l?.hFim || '', l?.pncp || 0, l?.lic || 0, l?.total || 0); }
        else { row.push(l?.pncp || 0, l?.lic || 0, l?.total || 0); }
      }
      rows.push(row);
    }

    // Linha vazia + TOTAIS
    rows.push([]);
    const totaisRow: any[] = ['TOTAIS'];
    for (const u of dadosUsuarios) {
      if (temHorario) { totaisRow.push('', '', u.totalPncp, u.totalLic, u.totalGeral); }
      else { totaisRow.push(u.totalPncp, u.totalLic, u.totalGeral); }
    }
    rows.push(totaisRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Merge cells para nomes dos usuários na linha 1
    const merges: XLSX.Range[] = [];
    let col = 1;
    for (const u of dadosUsuarios) {
      const span = temHorario ? 5 : 3;
      if (span > 1) {
        merges.push({ s: { r: 0, c: col }, e: { r: 0, c: col + span - 1 } });
      }
      col += span;
    }
    ws['!merges'] = merges;

    // Ajustar largura das colunas
    const colWidths: { wch: number }[] = [{ wch: 18 }];
    for (const u of dadosUsuarios) {
      if (temHorario) { colWidths.push({ wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }); }
      else { colWidths.push({ wch: 8 }, { wch: 8 }, { wch: 8 }); }
    }
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Produtividade');
    XLSX.writeFile(wb, `relatorio-produtividade-${agrupamento}.xlsx`);
  }, [dadosUsuarios, temHorario, agrupamento]);

  const labelAgrupamento: Record<Agrupamento, string> = {
    anual: 'Ano',
    mensal: 'Mês',
    diario: 'Dia',
    turno: 'Turno',
    hora: 'Hora',
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 flex flex-col h-[calc(100vh-96px)] min-h-0 w-full overflow-hidden">
        {/* Header + Filtros */}
        <div className="flex-shrink-0 mb-4">
          <h1 className="text-xl font-bold text-[#1A1A1A] mb-4">Relatório de Produtividade</h1>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-[#262626]">Data Inicial</Label>
              <Input
                type="datetime-local"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-8 text-sm w-[200px]"
                disabled={consultado && !loading}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-[#262626]">Data Final</Label>
              <Input
                type="datetime-local"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-8 text-sm w-[200px]"
                disabled={consultado && !loading}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-[#262626]">Agrupar</Label>
              <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as Agrupamento)} disabled={consultado && !loading}>
                <SelectTrigger className="h-8 text-sm w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anual">1-Anual</SelectItem>
                  <SelectItem value="mensal">2-Mensal</SelectItem>
                  <SelectItem value="diario">3-Diário</SelectItem>
                  <SelectItem value="turno">4-Turno Manhã/Tarde 13h</SelectItem>
                  <SelectItem value="hora">5-Hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {consultado && !loading ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => { setConsultado(false); setDadosUsuarios([]); }}
                >
                  Nova Consulta
                </Button>
                {dadosUsuarios.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={exportarExcel}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="h-8 bg-[#02572E] text-white hover:bg-[#024a27]"
                onClick={consultar}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Consultar
              </Button>
            )}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !consultado ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Selecione o período e clique em Consultar
            </div>
          ) : dadosUsuarios.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Nenhum registro encontrado no período
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse w-auto">
                <thead>
                  {/* Linha de nomes dos usuários (colspan) */}
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-bold text-xs text-[#1A1A1A] bg-white border-r border-border min-w-[140px]">
                      Agrupar
                    </th>
                    {dadosUsuarios.map((u) => (
                      <th
                        key={u.userId}
                        colSpan={temHorario ? 5 : 3}
                        className="px-3 py-2 text-center font-bold text-xs text-[#1A1A1A] bg-white border-r border-border"
                      >
                        {u.nome}
                      </th>
                    ))}
                  </tr>
                  {/* Linha de sub-headers */}
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-1.5 text-left font-semibold text-xs text-[#1A1A1A] border-r border-border">
                      {labelAgrupamento[agrupamento]}
                    </th>
                    {dadosUsuarios.map((u) => (
                      <React.Fragment key={u.userId}>
                        {temHorario && (
                          <>
                            <th className="px-3 py-1.5 text-center font-semibold text-xs text-[#1A1A1A] border-r border-border min-w-[60px]">H.Ini</th>
                            <th className="px-3 py-1.5 text-center font-semibold text-xs text-[#1A1A1A] border-r border-border min-w-[60px]">H.Fim</th>
                          </>
                        )}
                        <th className="px-3 py-1.5 text-center font-semibold text-xs text-[#1A1A1A] border-r border-border min-w-[50px]">Pncp</th>
                        <th className="px-3 py-1.5 text-center font-semibold text-xs text-[#1A1A1A] border-r border-border min-w-[50px]">Lic</th>
                        <th className="px-3 py-1.5 text-center font-semibold text-xs text-[#1A1A1A] border-r border-border min-w-[50px]">Total</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Linhas de dados - usa o maior número de linhas entre todos os usuários */}
                  {Array.from({ length: Math.max(...dadosUsuarios.map(u => u.linhas.length)) }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-sm text-[#1A1A1A] font-medium border-r border-border whitespace-nowrap">
                        {dadosUsuarios[0]?.linhas[rowIdx]?.label || ''}
                      </td>
                      {dadosUsuarios.map((u) => {
                        const linha = u.linhas[rowIdx];
                        return (
                          <React.Fragment key={u.userId}>
                            {temHorario && (
                              <>
                                <td className="px-3 py-1.5 text-sm text-center text-[#1A1A1A] border-r border-border">{linha?.hIni || ''}</td>
                                <td className="px-3 py-1.5 text-sm text-center text-[#1A1A1A] border-r border-border">{linha?.hFim || ''}</td>
                              </>
                            )}
                            <td className="px-3 py-1.5 text-sm text-center text-[#1A1A1A] border-r border-border">{linha?.pncp || ''}</td>
                            <td className="px-3 py-1.5 text-sm text-center text-[#1A1A1A] border-r border-border">{linha?.lic || ''}</td>
                            <td className="px-3 py-1.5 text-sm text-center font-semibold text-[#1A1A1A] border-r border-border">{linha?.total || ''}</td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                  {/* Linha de TOTAIS */}
                  <tr className="border-t-2 border-border font-bold bg-gray-50">
                    <td className="px-3 py-2 text-sm text-[#1A1A1A] border-r border-border">TOTAIS</td>
                    {dadosUsuarios.map((u) => (
                      <React.Fragment key={u.userId}>
                        {temHorario && (
                          <>
                            <td className="px-3 py-2 text-sm text-center border-r border-border"></td>
                            <td className="px-3 py-2 text-sm text-center border-r border-border"></td>
                          </>
                        )}
                        <td className="px-3 py-2 text-sm text-center text-[#1A1A1A] border-r border-border">{u.totalPncp}</td>
                        <td className="px-3 py-2 text-sm text-center text-[#1A1A1A] border-r border-border">{u.totalLic}</td>
                        <td className="px-3 py-2 text-sm text-center font-bold text-[#1A1A1A] border-r border-border">{u.totalGeral}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
