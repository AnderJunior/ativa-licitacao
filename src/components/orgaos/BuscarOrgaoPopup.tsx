import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Orgao {
  id: string;
  nome_orgao: string;
  uf: string | null;
  cidade_ibge: string | null;
  cidade_nome?: string | null;
  endereco: string | null;
  telefone: string | null;
  compras_net: string | null;
  compras_mg: string | null;
}

interface BuscarOrgaoPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrgaoSelecionado: (orgao: Orgao) => void;
  termoInicial?: string;
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Função para normalizar string (remove acentos e converte para minúsculas)
const normalizarString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export function BuscarOrgaoPopup({
  open,
  onOpenChange,
  onOrgaoSelecionado,
  termoInicial,
}: BuscarOrgaoPopupProps) {
  const navigate = useNavigate();
  const [filtroOrgao, setFiltroOrgao] = useState('');
  const [filtroUASG, setFiltroUASG] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroUF, setFiltroUF] = useState('');
  const [filtroFone, setFiltroFone] = useState('');
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [orgaoSelecionado, setOrgaoSelecionado] = useState<Orgao | null>(null);
  const [termoInicialAplicado, setTermoInicialAplicado] = useState(false);
  const buscaAutomaticaRef = useRef<NodeJS.Timeout | null>(null);
  const ultimaCombinacaoFiltrosRef = useRef<string>('');

  const buscarOrgaos = useCallback(async () => {
    setCarregando(true);
    try {
      let query = supabase
        .from('orgaos')
        .select('id, nome_orgao, uf, cidade_ibge, endereco, telefone, compras_net, compras_mg')
        .order('nome_orgao');

      // Aplica filtros com suporte a %
      if (filtroOrgao.trim()) {
        const filtro = filtroOrgao.trim().replace(/%/g, '');
        query = query.ilike('nome_orgao', `%${filtro}%`);
      }

      if (filtroUASG.trim()) {
        const filtro = filtroUASG.trim().replace(/%/g, '');
        query = query.or(`compras_net.ilike.%${filtro}%,compras_mg.ilike.%${filtro}%`);
      }

      // Não aplica filtro de cidade aqui - será aplicado depois de buscar os nomes das cidades
      if (filtroUF) {
        query = query.eq('uf', filtroUF);
      }

      if (filtroFone.trim()) {
        const filtro = filtroFone.trim().replace(/%/g, '');
        query = query.ilike('telefone', `%${filtro}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar órgãos:', error);
        toast.error('Erro ao buscar órgãos. Tente novamente.');
        setOrgaos([]);
        return;
      }

      // Buscar nomes das cidades usando a API do IBGE
      const orgaosComCidade = await Promise.all(
        (data || []).map(async (orgao) => {
          let cidadeNome = null;
          if (orgao.uf && orgao.cidade_ibge) {
            try {
              const response = await fetch(
                `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${orgao.cidade_ibge}`
              );
              if (response.ok) {
                const municipio = await response.json();
                cidadeNome = municipio?.nome || null;
              }
            } catch (error) {
              console.error('Erro ao buscar nome da cidade:', error);
            }
          }
          return { ...orgao, cidade_nome: cidadeNome };
        })
      );

      // Aplicar filtro de cidade no nome da cidade (case-insensitive e accent-insensitive)
      let orgaosFiltrados = orgaosComCidade;
      if (filtroCidade.trim()) {
        const filtroNormalizado = normalizarString(filtroCidade.trim().replace(/%/g, ''));
        orgaosFiltrados = orgaosComCidade.filter((orgao) => {
          if (!orgao.cidade_nome) return false;
          const cidadeNormalizada = normalizarString(orgao.cidade_nome);
          return cidadeNormalizada.includes(filtroNormalizado);
        });
      }

      setOrgaos(orgaosFiltrados);
    } catch (error) {
      console.error('Erro ao buscar órgãos:', error);
      toast.error('Erro ao buscar órgãos. Tente novamente.');
      setOrgaos([]);
    } finally {
      setCarregando(false);
    }
  }, [filtroOrgao, filtroUASG, filtroCidade, filtroUF, filtroFone]);

  useEffect(() => {
    if (!open) {
      // Limpa os filtros quando fecha
      setFiltroOrgao('');
      setFiltroUASG('');
      setFiltroCidade('');
      setFiltroUF('');
      setFiltroFone('');
      setOrgaos([]);
      setOrgaoSelecionado(null);
      setTermoInicialAplicado(false);
      ultimaCombinacaoFiltrosRef.current = '';
    } else if (termoInicial && termoInicial.trim() && !termoInicialAplicado) {
      // Se o popup abrir com um termo inicial, preenche o filtro
      setFiltroOrgao(termoInicial);
      setTermoInicialAplicado(true);
      // Limpa a referência para permitir busca imediata
      ultimaCombinacaoFiltrosRef.current = '';
    }
  }, [open, termoInicial, termoInicialAplicado]);

  // Busca automática em tempo real quando qualquer input mudar
  useEffect(() => {
    // Limpa timeout anterior se existir
    if (buscaAutomaticaRef.current) {
      clearTimeout(buscaAutomaticaRef.current);
      buscaAutomaticaRef.current = null;
    }

    if (!open || carregando) return;

    // Não busca se o termo inicial ainda está sendo aplicado
    if (termoInicial && !termoInicialAplicado) return;

    // Cria uma string única com todos os filtros para verificar se mudou
    const combinacaoFiltros = `${filtroOrgao.trim()}|${filtroUASG.trim()}|${filtroCidade.trim()}|${filtroUF}|${filtroFone.trim()}`;
    
    // Não busca se já buscou para esta mesma combinação de filtros
    if (combinacaoFiltros === ultimaCombinacaoFiltrosRef.current) return;

    // Busca automaticamente após um delay quando detecta mudança em qualquer input
    buscaAutomaticaRef.current = setTimeout(() => {
      // Verifica novamente se os filtros ainda são os mesmos (evita busca com valores antigos)
      const combinacaoAtual = `${filtroOrgao.trim()}|${filtroUASG.trim()}|${filtroCidade.trim()}|${filtroUF}|${filtroFone.trim()}`;
      
      if (!carregando && combinacaoAtual === combinacaoFiltros) {
        ultimaCombinacaoFiltrosRef.current = combinacaoAtual;
        buscarOrgaos();
      }
      buscaAutomaticaRef.current = null;
    }, 500); // Delay de 500ms para evitar muitas requisições enquanto o usuário digita

    return () => {
      if (buscaAutomaticaRef.current) {
        clearTimeout(buscaAutomaticaRef.current);
        buscaAutomaticaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroOrgao, filtroUASG, filtroCidade, filtroUF, filtroFone, open, carregando, termoInicial, termoInicialAplicado]);

  const handleBuscar = () => {
    buscarOrgaos();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBuscar();
    }
  };

  const handleOrgaoClick = (orgao: Orgao) => {
    setOrgaoSelecionado(orgao);
  };

  const handleOrgaoDoubleClick = (orgao: Orgao) => {
    onOrgaoSelecionado(orgao);
    onOpenChange(false);
  };

  const handleOk = () => {
    if (orgaoSelecionado) {
      onOrgaoSelecionado(orgaoSelecionado);
      onOpenChange(false);
    } else {
      toast.warning('Selecione um órgão antes de confirmar.');
    }
  };

  const handleEditar = () => {
    if (orgaoSelecionado) {
      navigate(`/orgaos/cadastro?id=${orgaoSelecionado.id}`);
      onOpenChange(false);
    } else {
      toast.warning('Selecione um órgão para editar.');
    }
  };

  const handleCadastrar = () => {
    navigate('/orgaos/cadastro');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-w-[95vw] p-0 gap-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="text-lg font-semibold text-[#262626]">
            Pesquisa Avançada de Órgãos → {orgaos.length}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tabela de resultados */}
          <div className="flex-1 overflow-hidden border-b">
            <ScrollArea className="h-full w-full">
              {carregando ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[280px] text-xs">Orgão</TableHead>
                      <TableHead className="w-[90px] text-xs">UASG NET</TableHead>
                      <TableHead className="w-[90px] text-xs">UASG MG</TableHead>
                      <TableHead className="w-[200px] text-xs">Endereço</TableHead>
                      <TableHead className="w-[100px] text-xs">Cidade</TableHead>
                      <TableHead className="w-[70px] text-xs">fone</TableHead>
                      <TableHead className="w-[70px] text-xs">fax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgaos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                          Nenhum órgão encontrado. Use os filtros abaixo para buscar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orgaos.map((orgao) => (
                        <TableRow
                          key={orgao.id}
                          onClick={() => handleOrgaoClick(orgao)}
                          onDoubleClick={() => handleOrgaoDoubleClick(orgao)}
                          className={`cursor-pointer ${
                            orgaoSelecionado?.id === orgao.id
                              ? 'bg-blue-100 hover:bg-blue-100'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <TableCell className="font-medium text-xs py-3">{orgao.nome_orgao || '-'}</TableCell>
                          <TableCell className="text-xs py-3">{orgao.compras_net || '-'}</TableCell>
                          <TableCell className="text-xs py-3">{orgao.compras_mg || '-'}</TableCell>
                          <TableCell className="text-xs py-3">{orgao.endereco || '-'}</TableCell>
                          <TableCell className="text-xs py-3">
                            {orgao.uf && orgao.cidade_nome 
                              ? `${orgao.uf} - ${orgao.cidade_nome}`
                              : orgao.cidade_ibge || '-'}
                          </TableCell>
                          <TableCell className="text-xs py-3">{orgao.telefone || '-'}</TableCell>
                          <TableCell className="text-xs py-3">-</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>

          {/* Área de filtros */}
          <div className="p-4 space-y-4 border-b bg-gray-50">
            <div className="flex items-end gap-3">
              <div className="space-y-1 flex-1 min-w-0">
                <Label className="text-xs text-[#262626]">Orgão</Label>
                <Input
                  placeholder="Digite o nome..."
                  value={filtroOrgao}
                  onChange={(e) => setFiltroOrgao(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm bg-white"
                />
              </div>
              <div className="space-y-1 w-[140px]">
                <Label className="text-xs text-[#262626]">UASG</Label>
                <Input
                  placeholder="Digite o UASG..."
                  value={filtroUASG}
                  onChange={(e) => setFiltroUASG(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm bg-white"
                />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <Label className="text-xs text-[#262626]">Cidade</Label>
                <Input
                  placeholder="Digite a cidade..."
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm bg-white"
                />
              </div>
              <div className="space-y-1 w-[100px]">
                <Label className="text-xs text-[#262626]">UF</Label>
                <select
                  value={filtroUF}
                  onChange={(e) => setFiltroUF(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-white px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Todas</option>
                  {UFS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 w-[160px]">
                <Label className="text-xs text-[#262626]">Fone ou Fax</Label>
                <Input
                  placeholder="Digite o telefone..."
                  value={filtroFone}
                  onChange={(e) => setFiltroFone(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-8 text-sm bg-white"
                />
              </div>
              <Button
                type="button"
                onClick={handleBuscar}
                disabled={carregando}
                className="h-8 px-4 bg-[#5046E5] hover:bg-[#4338CA] text-white text-sm shrink-0"
              >
                {carregando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Buscar
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleEditar}
                className="h-8 px-4 text-sm shrink-0"
              >
                Editar Cadastro Orgão
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCadastrar}
                className="h-8 px-4 text-sm shrink-0"
              >
                Cadastrar Novo Orgão
              </Button>
              <p className="text-xs text-muted-foreground">
                Utilize o Caracter % para localizar trechos de palavras
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
