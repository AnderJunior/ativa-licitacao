import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { usePermissoes } from '@/contexts/PermissoesContext';

interface GrupoOrgao {
  id: string;
  nome: string;
  created_at: string;
}

export default function OrgaosAgrupamentos() {
  const { canSalvar, canExcluir } = usePermissoes();
  const [loading, setLoading] = useState(true);
  const [grupos, setGrupos] = useState<GrupoOrgao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newNome, setNewNome] = useState('');

  useEffect(() => {
    loadGrupos();
  }, []);

  const loadGrupos = async () => {
    setLoading(true);
    try {
      const data = await api.get<GrupoOrgao[]>('/api/grupo-orgaos');
      setGrupos(data || []);
    } catch {
      toast.error('Erro ao carregar grupos');
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newNome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/grupo-orgaos', { nome: newNome.trim() });
      toast.success('Grupo adicionado!');
      setNewNome('');
      setDialogOpen(false);
      loadGrupos();
    } catch (err: any) {
      toast.error(err.message?.includes('Unique') ? 'Este nome já existe' : ('Erro ao adicionar: ' + err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/grupo-orgaos/${id}`);
      toast.success('Grupo excluído!');
      loadGrupos();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-[12px]">
          <h1 className="text-xl font-bold text-[#262626]">Agrupamentos de Órgãos</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#02572E] text-white hover:bg-[#024a27]">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar novo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-[#262626]">Novo Grupo de Órgãos</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-[#262626]">Nome *</Label>
                  <Input
                    id="nome"
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                    placeholder="Nome do grupo"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button onClick={handleAdd} disabled={saving} className="bg-[#02572E] text-white hover:bg-[#024a27]">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Agrupamentos */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : grupos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum grupo cadastrado
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Descrição</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] text-right bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {grupos.map((grupo) => (
                    <tr key={grupo.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">{grupo.nome}</td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        {canExcluir('/orgaos/agrupamentos') && (
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
                              <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir "{grupo.nome}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(grupo.id)}>
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}