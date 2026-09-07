import { useState, useEffect, useCallback, useRef } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Loader2, RefreshCw, CheckCircle2, AlertTriangle, Clock,
  Upload, Download, X, FileSpreadsheet, ExternalLink,
} from 'lucide-react';

interface Varredura {
  modo: 'incremental' | 'completo';
  titulo: string;
  endpoint: string;
  criterio: string;
  intervalo: string;
  janela: string;
  periodoAgora: string;
  paraQueServe: string;
}

interface Modalidade {
  codigo: number;
  nome: string;
  totalNaBase: number;
}

interface Filtro {
  nome: string;
  valor: string;
  descricao: string;
}

interface Ritmo {
  registrosPorPagina: number;
  intervaloEntrePaginasMs: number;
  intervaloBaseMs: number;
  intervaloMaximoMs: number;
  tentativasPorPagina: number;
  esperaRateLimitBaseMs: number;
  paginaDaSegundaPassada: number;
  observacao: string;
}

interface UltimoResultado {
  modo: string;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  paginasPerdidas: number;
  modalidadesIncompletas: number[];
  startedAt: string;
  finishedAt: string;
  duration: string;
}

interface ConfigBuscaData {
  varreduras: Varredura[];
  modalidades: Modalidade[];
  filtros: Filtro[];
  ritmo: Ritmo;
  status: {
    isSyncing: boolean;
    lastSyncResult: UltimoResultado | null;
    lastSyncError: string | null;
  };
}

/** Linha da planilha, com as colunas do layout Detalhado. */
type LinhaPlanilha = Record<string, any>;

interface ResumoConferencia {
  ausentes: number;
  presentes: number;
  presentesCadastradas: number;
  presentesNaoCadastradas: number;
  presentesExcluidas: number;
}

interface RespostaConferencia {
  totalNaPlanilha: number;
  totalDistintos: number;
  ausentes: string[];
  resumo: ResumoConferencia;
}

interface Conferencia {
  arquivo: string;
  totalLinhas: number;
  totalDistintos: number;
  resumo: ResumoConferencia;
  linhasAusentes: LinhaPlanilha[];
}

/** Aceita NumPncp, "Num Pncp", "numero_controle_pncp" e afins. */
const acharColunaNumPncp = (cabecalhos: string[]): string | null => {
  // NFD separa o acento da letra e o filtro seguinte descarta tudo que nao for
  // a-z, entao "Número" e "Numero" chegam iguais em "numero".
  const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const alvos = ['numpncp', 'numerocontrolepncp', 'numerodecontrolepncp', 'numcontrolepncp'];
  return cabecalhos.find(c => alvos.includes(normal(c))) ?? null;
};

/** NumPncp tem o formato "CNPJ-1-SEQUENCIAL/ANO" e vira o link do edital. */
const linkPncp = (numPncp: string): string | null => {
  const m = String(numPncp).match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (!m) return null;
  return `https://pncp.gov.br/app/editais/${m[1]}/${m[3]}/${parseInt(m[2], 10)}`;
};

const formatarDataHora = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR');
};

/** Cartão de rótulo + valor, usado nos blocos de ritmo. */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground leading-tight">{rotulo}</p>
      <p className="text-sm font-semibold text-[#262626] leading-tight mt-0.5">{valor}</p>
    </div>
  );
}

export default function LicitacaoConfigBusca() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConfigBuscaData | null>(null);

  // ── Conferência de planilha ──
  const inputArquivo = useRef<HTMLInputElement>(null);
  const [conferindo, setConferindo] = useState(false);
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);

  const conferirPlanilha = async (arquivo: File) => {
    setConferindo(true);
    setConferencia(null);
    try {
      const buffer = await arquivo.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      // Procura a primeira aba que tenha a coluna de número PNCP — nos exports
      // do sistema antigo vêm Plan1, Plan2 e Plan3, com só a primeira preenchida.
      let linhas: LinhaPlanilha[] = [];
      let coluna: string | null = null;
      for (const nome of wb.SheetNames) {
        const doSheet = XLSX.utils.sheet_to_json<LinhaPlanilha>(wb.Sheets[nome], { defval: '' });
        if (doSheet.length === 0) continue;
        const achada = acharColunaNumPncp(Object.keys(doSheet[0]));
        if (achada) { linhas = doSheet; coluna = achada; break; }
      }

      if (!coluna) {
        toast.error('Não encontrei a coluna NumPncp na planilha. Use o layout Detalhado.');
        setConferindo(false);
        return;
      }

      const numeros = linhas.map(l => String(l[coluna!] ?? '').trim()).filter(Boolean);
      if (numeros.length === 0) {
        toast.error('A coluna NumPncp está vazia.');
        setConferindo(false);
        return;
      }

      const resp = await api.post<RespostaConferencia>('/api/pncp-sync/conferir-planilha', { numeros });

      // Devolve só os números; as demais colunas vêm da própria planilha.
      const ausentes = new Set(resp.ausentes);
      const vistos = new Set<string>();
      const linhasAusentes = linhas.filter(l => {
        const n = String(l[coluna!] ?? '').trim();
        if (!ausentes.has(n) || vistos.has(n)) return false;
        vistos.add(n);
        return true;
      });

      setConferencia({
        arquivo: arquivo.name,
        totalLinhas: resp.totalNaPlanilha,
        totalDistintos: resp.totalDistintos,
        resumo: resp.resumo,
        linhasAusentes,
      });

      if (resp.resumo.ausentes === 0) {
        toast.success('Todas as licitações da planilha já estão no sistema.');
      } else {
        toast.warning(`${resp.resumo.ausentes} licitação(ões) da planilha não estão no sistema.`);
      }
    } catch (err: any) {
      toast.error('Erro ao conferir a planilha: ' + err.message);
    }
    setConferindo(false);
  };

  const exportarAusentes = () => {
    if (!conferencia?.linhasAusentes.length) return;
    const ws = XLSX.utils.json_to_sheet(
      conferencia.linhasAusentes.map(l => ({ ...l, LinkPNCP: linkPncp(String(l[acharColunaNumPncp(Object.keys(l))!] ?? '')) ?? '' })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nao cadastradas');
    XLSX.writeFile(wb, `nao-cadastradas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const limparConferencia = () => {
    setConferencia(null);
    if (inputArquivo.current) inputArquivo.current.value = '';
  };

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const d = await api.get<ConfigBuscaData>('/api/pncp-sync/config');
      setData(d);
    } catch (err: any) {
      toast.error('Erro ao carregar configurações: ' + err.message);
    }
    if (!silencioso) setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Enquanto uma varredura estiver rodando, atualiza sozinho para acompanhar.
  useEffect(() => {
    if (!data?.status.isSyncing) return;
    const t = setInterval(() => carregar(true), 15000);
    return () => clearInterval(t);
  }, [data?.status.isSyncing, carregar]);

  const r = data?.ritmo;

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col overflow-hidden">
        <div className="flex items-start justify-between mb-4 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#262626]">Config. Busca</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Como o sistema busca as licitações no PNCP. Somente leitura.
            </p>
          </div>
          <Button variant="outline" onClick={() => carregar()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-muted-foreground">
            Não foi possível carregar as configurações.
          </div>
        ) : (
          <div className="flex-1 overflow-auto pr-1 space-y-6">
            {/* ── Conferir planilha ── */}
            <section>
              <h2 className="text-sm font-bold text-[#262626] mb-2">Conferir planilha</h2>
              <div className="rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Suba uma planilha de licitações no layout <strong>Detalhado</strong>. O sistema compara pela coluna
                  NumPncp e mostra quais licitações da planilha <strong>não estão no sistema</strong>. Nada é importado
                  nem alterado — é só conferência.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={inputArquivo}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) conferirPlanilha(f);
                    }}
                  />
                  <Button
                    onClick={() => inputArquivo.current?.click()}
                    disabled={conferindo}
                    className="bg-[#02572E] text-white hover:bg-[#024a27]"
                  >
                    {conferindo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {conferindo ? 'Conferindo...' : 'Escolher planilha'}
                  </Button>

                  {conferencia && (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-[#262626]">
                        <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                        {conferencia.arquivo}
                      </span>
                      <Button variant="ghost" size="sm" onClick={limparConferencia}>
                        <X className="w-4 h-4 mr-1" />
                        Limpar
                      </Button>
                    </>
                  )}
                </div>

                {conferencia && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <Dado rotulo="Linhas na planilha" valor={conferencia.totalLinhas} />
                      <Dado rotulo="Licitações distintas" valor={conferencia.totalDistintos} />
                      <div
                        className={`rounded-md border px-3 py-2 ${
                          conferencia.resumo.ausentes > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                        }`}
                      >
                        <p className="text-[11px] text-muted-foreground leading-tight">Não estão no sistema</p>
                        <p
                          className={`text-sm font-semibold leading-tight mt-0.5 ${
                            conferencia.resumo.ausentes > 0 ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {conferencia.resumo.ausentes}
                        </p>
                      </div>
                      <Dado rotulo="Já no sistema" valor={conferencia.resumo.presentes} />
                      <Dado
                        rotulo="Destas, já cadastradas"
                        valor={conferencia.resumo.presentesCadastradas}
                      />
                    </div>

                    {conferencia.resumo.presentesExcluidas > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {conferencia.resumo.presentesExcluidas} da planilha estão no sistema porém marcadas como
                        excluídas.
                      </p>
                    )}

                    {conferencia.linhasAusentes.length === 0 ? (
                      <p className="flex items-center gap-2 text-sm text-green-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Nenhuma licitação faltando: a planilha inteira já está no sistema.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-[#262626]">
                            Licitações da planilha que não estão no sistema ({conferencia.linhasAusentes.length})
                          </p>
                          <Button variant="outline" size="sm" onClick={exportarAusentes}>
                            <Download className="w-4 h-4 mr-2" />
                            Exportar Excel
                          </Button>
                        </div>

                        <div className="border border-border rounded-md overflow-auto max-h-96">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr className="border-b border-border">
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">NumPncp</th>
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">UF</th>
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">Modalidade</th>
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">Órgão</th>
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">Título</th>
                                <th className="text-left font-semibold text-[#262626] px-2 py-1.5">DtPublicacao</th>
                                <th className="text-center font-semibold text-[#262626] px-2 py-1.5 w-16">PNCP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {conferencia.linhasAusentes.map((l, i) => {
                                const col = acharColunaNumPncp(Object.keys(l));
                                const num = String(col ? l[col] ?? '' : '');
                                const link = linkPncp(num);
                                return (
                                  <tr key={num || i} className="border-b border-border last:border-0 hover:bg-muted/30">
                                    <td className="px-2 py-1 text-[#262626] whitespace-nowrap">{num}</td>
                                    <td className="px-2 py-1 text-[#262626]">{l.UF ?? ''}</td>
                                    <td className="px-2 py-1 text-[#262626]">{l.Modalidade ?? ''}</td>
                                    <td className="px-2 py-1 text-[#262626] max-w-[220px] truncate" title={l.OrgaoPNCP ?? ''}>
                                      {l.OrgaoPNCP ?? ''}
                                    </td>
                                    <td className="px-2 py-1 text-[#262626] max-w-[200px] truncate" title={l.Titulo ?? ''}>
                                      {l.Titulo ?? ''}
                                    </td>
                                    <td className="px-2 py-1 text-[#262626] whitespace-nowrap">{l.DtPublicacao ?? ''}</td>
                                    <td className="px-2 py-1 text-center">
                                      {link && (
                                        <a
                                          href={link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline inline-flex items-center"
                                          title="Abrir no portal do PNCP"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── Situação atual ── */}
            <section>
              <h2 className="text-sm font-bold text-[#262626] mb-2">Situação agora</h2>
              <div className="rounded-md border border-border p-4">
                {data.status.isSyncing ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-[#02572E]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Busca em andamento — esta tela se atualiza sozinha a cada 15s.
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Nenhuma busca em andamento. A próxima entra pelo horário programado.
                  </p>
                )}

                {data.status.lastSyncError && (
                  <p className="flex items-start gap-2 text-sm text-red-700 mt-3">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Erro na última busca: {data.status.lastSyncError}</span>
                  </p>
                )}

                {data.status.lastSyncResult ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-[#262626] mb-2">
                      Última busca concluída ({data.status.lastSyncResult.modo}) — durou{' '}
                      {data.status.lastSyncResult.duration}, terminou em{' '}
                      {formatarDataHora(data.status.lastSyncResult.finishedAt)}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <Dado rotulo="Novas importadas" valor={data.status.lastSyncResult.inserted} />
                      <Dado rotulo="Atualizadas" valor={data.status.lastSyncResult.updated} />
                      <Dado rotulo="Sem mudança" valor={data.status.lastSyncResult.skipped} />
                      <Dado rotulo="Erros" valor={data.status.lastSyncResult.errors} />
                      <div
                        className={`rounded-md border px-3 py-2 ${
                          data.status.lastSyncResult.paginasPerdidas > 0
                            ? 'border-red-300 bg-red-50'
                            : 'border-green-300 bg-green-50'
                        }`}
                      >
                        <p className="text-[11px] text-muted-foreground leading-tight">Páginas perdidas</p>
                        <p
                          className={`text-sm font-semibold leading-tight mt-0.5 ${
                            data.status.lastSyncResult.paginasPerdidas > 0 ? 'text-red-700' : 'text-green-700'
                          }`}
                        >
                          {data.status.lastSyncResult.paginasPerdidas}
                        </p>
                      </div>
                    </div>
                    {data.status.lastSyncResult.paginasPerdidas > 0 && (
                      <p className="text-xs text-red-700 mt-2">
                        O PNCP não entregou {data.status.lastSyncResult.paginasPerdidas} página(s) nem após todas as
                        tentativas — até {data.status.lastSyncResult.paginasPerdidas * (r?.registrosPorPagina ?? 50)}{' '}
                        licitações podem ter ficado de fora nas modalidades{' '}
                        {data.status.lastSyncResult.modalidadesIncompletas.join(', ') || '—'}. A próxima busca as recupera.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground mt-3">
                    Nenhuma busca concluída desde que o servidor subiu.
                  </p>
                )}
              </div>
            </section>

            {/* ── As duas varreduras ── */}
            <section>
              <h2 className="text-sm font-bold text-[#262626] mb-2">Buscas programadas</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {data.varreduras.map(v => (
                  <div key={v.modo} className="rounded-md border border-border p-4 space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#02572E]">{v.titulo}</h3>
                      <span className="text-xs font-semibold text-[#262626] whitespace-nowrap">
                        a cada {v.intervalo}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{v.paraQueServe}</p>
                    <dl className="text-xs space-y-1 pt-1">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 flex-shrink-0">Critério</dt>
                        <dd className="text-[#262626]">{v.criterio}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 flex-shrink-0">Período</dt>
                        <dd className="text-[#262626]">{v.janela}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 flex-shrink-0">Hoje busca</dt>
                        <dd className="text-[#262626] font-medium">{v.periodoAgora}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground w-28 flex-shrink-0">Endereço</dt>
                        <dd className="text-[#262626] break-all">{v.endpoint}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Regras aplicadas ── */}
            <section>
              <h2 className="text-sm font-bold text-[#262626] mb-2">Regras aplicadas na importação</h2>
              <div className="rounded-md border border-border divide-y divide-border">
                {data.filtros.map(f => (
                  <div key={f.nome} className="p-3 flex gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#262626]">
                        {f.nome} <span className="text-xs font-normal text-green-700">({f.valor})</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── Modalidades ── */}
            <section>
              <h2 className="text-sm font-bold text-[#262626] mb-2">
                Modalidades consultadas ({data.modalidades.length})
              </h2>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="text-left font-semibold text-[#262626] px-3 py-2 w-24">Código</th>
                      <th className="text-left font-semibold text-[#262626] px-3 py-2">Modalidade</th>
                      <th className="text-right font-semibold text-[#262626] px-3 py-2 w-44">Licitações na base</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modalidades.map(m => (
                      <tr key={m.codigo} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 text-[#262626]">{m.codigo}</td>
                        <td className="px-3 py-1.5 text-[#262626]">{m.nome}</td>
                        <td className="px-3 py-1.5 text-right text-[#262626]">
                          {m.totalNaBase.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Ritmo ── */}
            {r && (
              <section className="pb-2">
                <h2 className="text-sm font-bold text-[#262626] mb-2">Ritmo das requisições</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Dado rotulo="Licitações por página" valor={r.registrosPorPagina} />
                  <Dado rotulo="Intervalo agora" valor={`${r.intervaloEntrePaginasMs} ms`} />
                  <Dado rotulo="Intervalo mínimo" valor={`${r.intervaloBaseMs} ms`} />
                  <Dado rotulo="Intervalo máximo" valor={`${r.intervaloMaximoMs} ms`} />
                  <Dado rotulo="Tentativas por página" valor={r.tentativasPorPagina} />
                  <Dado rotulo="Espera inicial no 429" valor={`${r.esperaRateLimitBaseMs} ms`} />
                  <Dado rotulo="Página da 2ª passada" valor={r.paginaDaSegundaPassada} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{r.observacao}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
