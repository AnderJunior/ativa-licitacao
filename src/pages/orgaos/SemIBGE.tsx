import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { filtrarOrgaos } from '@/lib/filtroOrgaos';
import { PncpOrgaoInfo, type PncpOrgaoDados } from '@/components/orgaos/PncpOrgaoInfo';
import { toast } from 'sonner';
import { Loader2, Eye, Pencil, Search, X } from 'lucide-react';

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

interface Orgao {
  id: string;
  nome_orgao: string;
  uf: string | null;
  cidade_ibge: string | null;
  compras_net: string | null;
  compras_mg: string | null;
  endereco: string | null;
  telefone: string | null;
  cidade_nome?: string | null;
}

interface OrgaoCompleto extends Orgao {
  emails: string[] | null;
  sites: string[] | null;
  observacoes: string | null;
  obs_pncp: string | null;
  grupo_nome?: string | null;
}

export default function OrgaosSemIBGE() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [orgaoView, setOrgaoView] = useState<OrgaoCompleto | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  const [pncpView, setPncpView] = useState<PncpOrgaoDados | null>(null);
  const [loadingPncp, setLoadingPncp] = useState(false);

  // Filtros de localização (aplicados na hora, sobre a lista já carregada)
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroUasg, setFiltroUasg] = useState('');

  const temFiltro = Boolean(filtroNome || filtroCidade || filtroUF || filtroUasg);

  const limparFiltros = () => {
    setFiltroNome('');
    setFiltroCidade('');
    setFiltroUF('');
    setFiltroUasg('');
  };

  const orgaosFiltrados = useMemo(
    () => filtrarOrgaos(orgaos, { nome: filtroNome, cidade: filtroCidade, uf: filtroUF, uasg: filtroUasg }),
    [orgaos, filtroNome, filtroCidade, filtroUF, filtroUasg],
  );

  useEffect(() => {
    loadOrgaos();
  }, []);

  const loadOrgaos = async () => {
    setLoading(true);
    try {
      const data = await api.get<Orgao[]>('/api/orgaos');

      // Buscar nomes das cidades (com cache para evitar requests duplicados)
      const cidadeCache = new Map<string, string>();
      const codigosUnicos = [...new Set((data || []).filter(o => o.cidade_ibge).map(o => o.cidade_ibge!))];

      await Promise.all(
        codigosUnicos.map(async (codigo) => {
          try {
            const response = await fetch(
              `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigo}`
            );
            if (response.ok) {
              const municipio = await response.json();
              if (municipio?.nome) cidadeCache.set(codigo, municipio.nome);
            }
          } catch (error) {
            console.error('Erro ao buscar nome da cidade:', error);
          }
        })
      );

      const orgaosComCidade = (data || []).map(orgao => ({
        ...orgao,
        cidade_nome: orgao.cidade_ibge ? cidadeCache.get(orgao.cidade_ibge) || null : null,
      }));

      setOrgaos(orgaosComCidade);
    } catch {
      toast.error('Erro ao carregar órgãos');
    }
    setLoading(false);
  };


  const handleView = async (id: string) => {
    setLoadingView(true);
    setViewDialogOpen(true);

    // Dados do PNCP vêm da associação por CNPJ, não do campo obs_pncp
    setPncpView(null);
    setLoadingPncp(true);
    api.get<PncpOrgaoDados>('/api/orgaos/' + id + '/pncp')
      .then(d => setPncpView(d))
      .catch(() => setPncpView(null))
      .finally(() => setLoadingPncp(false));

    try {
      const data = await api.get<OrgaoCompleto>('/api/orgaos/' + id);

      if (!data) {
        toast.error('Erro ao carregar dados do órgão');
        setViewDialogOpen(false);
        setLoadingView(false);
        return;
      }

      let cidadeNome = null;
      if (data.uf && data.cidade_ibge) {
        try {
          const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${data.cidade_ibge}`
          );
          if (response.ok) {
            const municipio = await response.json();
            cidadeNome = municipio?.nome || null;
          }
        } catch (error) {
          console.error('Erro ao buscar nome da cidade:', error);
        }
      }

      // Buscar grupo do órgão
      let grupoNome = null;
      try {
        const grupoIds = await api.get<string[]>('/api/orgaos/' + id + '/grupos');
        if (grupoIds && grupoIds.length > 0) {
          const grupos = await api.get<{ id: string; nome: string }[]>('/api/grupo-orgaos');
          const grupo = grupos?.find(g => g.id === grupoIds[0]);
          if (grupo) {
            grupoNome = grupo.nome;
          }
        }
      } catch {
        // silently fail
      }

      setOrgaoView({
        ...data,
        cidade_nome: cidadeNome,
        grupo_nome: grupoNome,
      });
    } catch {
      toast.error('Erro ao carregar dados do órgão');
      setViewDialogOpen(false);
    }
    setLoadingView(false);
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-[#262626]">
            Consulta de Órgãos
            {!loading && orgaos.length > 0 && (
              <span className="text-red-600 ml-2 text-sm">
                {temFiltro ? `(${orgaosFiltrados.length} de ${orgaos.length})` : `(${orgaos.length})`}
              </span>
            )}
          </h1>
        </div>

        {/* Localizar órgãos */}
        {!loading && orgaos.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 flex-1 min-w-[240px]">
                <Label className="text-xs font-medium text-[#262626]">Nome do Órgão</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={filtroNome}
                    onChange={(e) => setFiltroNome(e.target.value)}
                    placeholder="Ex.: PREF. MUNIC. DE VILA VELHA"
                    className="h-9 text-sm pl-7"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1 min-w-[190px]">
                <Label className="text-xs font-medium text-[#262626]">Cidade</Label>
                <Input
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Ex.: Vila Velha"
                  className="h-9 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1 w-[90px]">
                <Label className="text-xs font-medium text-[#262626]">UF</Label>
                <select
                  value={filtroUF}
                  onChange={(e) => setFiltroUF(e.target.value)}
                  className="h-9 text-sm border border-input rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Todas</option>
                  {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 w-[130px]">
                <Label className="text-xs font-medium text-[#262626]">UASG</Label>
                <Input
                  value={filtroUasg}
                  onChange={(e) => setFiltroUasg(e.target.value)}
                  placeholder="NET ou MG"
                  className="h-9 text-sm"
                />
              </div>
              {temFiltro && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="h-9">
                  <X className="w-4 h-4 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orgaos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum órgão cadastrado
            </div>
          ) : orgaosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum órgão encontrado para os filtros informados.
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={limparFiltros}>
                  <X className="w-4 h-4 mr-1" />
                  Limpar filtros
                </Button>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">UF - Cidade</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Orgão</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">UASG NET</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">UASG MG</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {orgaosFiltrados.map((orgao) => (
                    <tr key={orgao.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {orgao.uf && orgao.cidade_nome 
                          ? `${orgao.uf} - ${orgao.cidade_nome}` 
                          : orgao.uf || orgao.cidade_nome || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.nome_orgao}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.compras_net || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.compras_mg || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-green-100 hover:bg-green-200 text-green-700 p-0"
                            onClick={() => navigate(`/orgaos/cadastro?id=${orgao.id}`)}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 p-0"
                            onClick={() => handleView(orgao.id)}
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Visualização */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#262626]">
              Visualização de Órgãos
            </DialogTitle>
          </DialogHeader>

          {loadingView ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orgaoView ? (
            <div className="space-y-4">
              {/* Linha 1: Nome do Órgão, Compras NET, Compras MG */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Nome do Órgão</Label>
                  <Input
                    value={orgaoView.nome_orgao || ''}
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras NET</Label>
                  <Input
                    value={orgaoView.compras_net || ''}
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras MG</Label>
                  <Input
                    value={orgaoView.compras_mg || ''}
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
              </div>

              {/* Linha 2: Cidade IBGE, Grupos de Orgãos */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Cidade IBGE</Label>
                  <Input
                    value={
                      orgaoView.uf && orgaoView.cidade_nome
                        ? `${orgaoView.uf} - ${orgaoView.cidade_nome}`
                        : orgaoView.uf || orgaoView.cidade_nome || ''
                    }
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Grupos de Orgãos</Label>
                  <Input
                    value={orgaoView.grupo_nome || ''}
                    placeholder="Nenhum grupo selecionado"
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
              </div>

              {/* Linha 3: Endereço, Telefone */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-7 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Endereço</Label>
                  <Input
                    value={orgaoView.endereco || ''}
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
                <div className="col-span-5 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Telefone</Label>
                  <Input
                    value={orgaoView.telefone || ''}
                    className="h-9 text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
              </div>

              {/* Linha 4: Orgão (textarea), PNCP (textarea), área de emails */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Orgão</Label>
                  <Textarea
                    value={orgaoView.observacoes || ''}
                    className="resize-none h-[120px] text-[14px] text-[#262626] bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    readOnly
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">PNCP</Label>
                  <PncpOrgaoInfo dados={pncpView} carregando={loadingPncp} className="h-[120px]" />
                  {orgaoView.obs_pncp?.trim() && (
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap pt-1">{orgaoView.obs_pncp}</p>
                  )}
                </div>
                <div className="col-span-5 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">E-mails</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 h-[120px] overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {(orgaoView.emails || []).length > 0 ? (
                        orgaoView.emails?.map((email, index) => (
                          <span key={index} className="inline-flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                            {email}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhum e-mail cadastrado</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linha 5: Sites */}
              <div>
                <Label className="text-[14px] font-normal text-[#262626]">Sites</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 mt-1">
                  <div className="flex flex-wrap gap-2">
                    {(orgaoView.sites || []).length > 0 ? (
                      orgaoView.sites?.map((site, index) => (
                        <span key={index} className="inline-flex items-center gap-1 bg-muted px-3 py-1.5 rounded text-sm">
                          <a href={site} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {site}
                          </a>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">Nenhum site cadastrado</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}