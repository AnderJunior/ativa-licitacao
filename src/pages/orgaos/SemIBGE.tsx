import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, Trash2, Pencil } from 'lucide-react';

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

  useEffect(() => {
    loadOrgaos();
  }, []);

  const loadOrgaos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orgaos')
      .select('id, nome_orgao, uf, cidade_ibge, compras_net, compras_mg, endereco, telefone')
      .order('nome_orgao');

    if (error) {
      toast.error('Erro ao carregar órgãos');
      setLoading(false);
      return;
    }

    // Buscar nomes das cidades para os que têm código IBGE
    const orgaosComCidade = await Promise.all(
      (data || []).map(async (orgao) => {
        if (orgao.cidade_ibge && orgao.uf) {
          try {
            const response = await fetch(
              `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${orgao.cidade_ibge}`
            );
            if (response.ok) {
              const municipio = await response.json();
              return { ...orgao, cidade_nome: municipio?.nome || null };
            }
          } catch (error) {
            console.error('Erro ao buscar nome da cidade:', error);
          }
        }
        return { ...orgao, cidade_nome: null };
      })
    );

    setOrgaos(orgaosComCidade);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('orgaos').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Órgão excluído!');
      loadOrgaos();
    }
  };

  const handleView = async (id: string) => {
    setLoadingView(true);
    setViewDialogOpen(true);
    
    const { data, error } = await supabase
      .from('orgaos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
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
    const { data: vinculos } = await supabase
      .from('orgaos_grupos')
      .select('grupo_id')
      .eq('orgao_id', id)
      .limit(1);

    if (vinculos && vinculos.length > 0) {
      const { data: grupoData } = await supabase
        .from('grupo_de_orgaos')
        .select('nome')
        .eq('id', vinculos[0].grupo_id)
        .maybeSingle();
      
      if (grupoData) {
        grupoNome = grupoData.nome;
      }
    }

    setOrgaoView({
      ...data,
      cidade_nome: cidadeNome,
      grupo_nome: grupoNome,
    });
    setLoadingView(false);
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-bold text-[#262626]">
            Órgãos sem IBGE
            {!loading && orgaos.length > 0 && (
              <span className="text-red-600 ml-2 text-sm">({orgaos.length})</span>
            )}
          </h1>
        </div>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orgaos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum órgão cadastrado
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
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Endereço</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Telefone</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {orgaos.map((orgao) => (
                    <tr key={orgao.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">
                        {orgao.uf && orgao.cidade_nome 
                          ? `${orgao.uf} - ${orgao.cidade_nome}` 
                          : orgao.uf || orgao.cidade_nome || '-'}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.nome_orgao}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.compras_net || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.compras_mg || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.endereco || '-'}</td>
                      <td className="p-4 align-middle py-1.5 text-sm text-[#1A1A1A]">{orgao.telefone || '-'}</td>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-7 w-7 rounded-full bg-red-100 hover:bg-red-600 text-red-700 hover:text-white p-0"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir órgão?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir "{orgao.nome_orgao}"? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(orgao.id)}>
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras NET</Label>
                  <Input
                    value={orgaoView.compras_net || ''}
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Compras MG</Label>
                  <Input
                    value={orgaoView.compras_mg || ''}
                    className="h-9 text-[#262626]"
                    disabled
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
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
                <div className="col-span-6 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Grupos de Orgãos</Label>
                  <Input
                    value={orgaoView.grupo_nome || ''}
                    placeholder="Nenhum grupo selecionado"
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
              </div>

              {/* Linha 3: Endereço, Telefone */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-7 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Endereço</Label>
                  <Input
                    value={orgaoView.endereco || ''}
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
                <div className="col-span-5 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Telefone</Label>
                  <Input
                    value={orgaoView.telefone || ''}
                    className="h-9 text-[#262626]"
                    disabled
                  />
                </div>
              </div>

              {/* Linha 4: Orgão (textarea), PNCP (textarea), área de emails */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">Orgão</Label>
                  <Textarea
                    value={orgaoView.observacoes || ''}
                    className="resize-none h-[120px] text-[14px] text-[#262626] bg-gray-50"
                    disabled
                  />
                </div>
                <div className="col-span-3 space-y-0.5">
                  <Label className="text-[14px] font-normal text-[#262626]">PNCP</Label>
                  <Textarea
                    value={orgaoView.obs_pncp || ''}
                    className="resize-none h-[120px] text-[14px] text-[#262626] bg-gray-50"
                    disabled
                  />
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