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
import { Loader2, Plus, Trash2, Pencil } from 'lucide-react';
import { usePermissoes } from '@/contexts/PermissoesContext';

interface CaixaEmail {
  id: string;
  sigla: string;
  descricao: string;
  created_at: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function CaixasEmail() {
  const { canSalvar, canExcluir } = usePermissoes();
  const [loading, setLoading] = useState(true);
  const [caixas, setCaixas] = useState<CaixaEmail[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [siglaInput, setSiglaInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  // Edição
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCaixa, setEditingCaixa] = useState<CaixaEmail | null>(null);
  const [editSiglaInput, setEditSiglaInput] = useState('');
  const [editDescricaoInput, setEditDescricaoInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    loadCaixas();
  }, []);

  const loadCaixas = async () => {
    setLoading(true);
    try {
      const data = await api.get<CaixaEmail[]>('/api/caixas-email');
      setCaixas(data || []);
    } catch {
      toast.error('Erro ao carregar caixas de e-mail');
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    const sigla = siglaInput.trim();
    const descricao = descricaoInput.trim();

    if (!sigla) {
      toast.error('Sigla é obrigatória');
      return;
    }

    if (!descricao) {
      toast.error('Descrição (e-mail) é obrigatória');
      return;
    }

    if (!isValidEmail(descricao)) {
      toast.error('Por favor, insira um e-mail válido');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/caixas-email', { sigla, descricao });
      toast.success('Caixa de e-mail adicionada!');
      setSiglaInput('');
      setDescricaoInput('');
      setDialogOpen(false);
      loadCaixas();
    } catch (err: any) {
      toast.error(err.message?.includes('Unique') ? 'Esta sigla já existe' : ('Erro ao adicionar: ' + err.message));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/caixas-email/${id}`);
      toast.success('Caixa de e-mail excluída!');
      loadCaixas();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const openEditDialog = (caixa: CaixaEmail) => {
    setEditingCaixa(caixa);
    setEditSiglaInput(caixa.sigla);
    setEditDescricaoInput(caixa.descricao);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingCaixa(null);
    setEditSiglaInput('');
    setEditDescricaoInput('');
  };

  const handleUpdate = async () => {
    if (!editingCaixa) return;

    const sigla = editSiglaInput.trim();
    const descricao = editDescricaoInput.trim();

    if (!sigla) {
      toast.error('Sigla é obrigatória');
      return;
    }

    if (!descricao) {
      toast.error('Descrição (e-mail) é obrigatória');
      return;
    }

    if (!isValidEmail(descricao)) {
      toast.error('Por favor, insira um e-mail válido');
      return;
    }

    setSavingEdit(true);
    try {
      await api.put(`/api/caixas-email/${editingCaixa.id}`, { sigla, descricao });
      toast.success('Caixa de e-mail atualizada!');
      closeEditDialog();
      loadCaixas();
    } catch (err: any) {
      toast.error(err.message?.includes('Unique') ? 'Esta sigla já existe' : ('Erro ao atualizar: ' + err.message));
    }
    setSavingEdit(false);
  };

  return (
    <MainLayout>
      <div className="bg-white rounded-lg border border-border p-6 h-full flex flex-col">
        <div className="flex items-start justify-between mb-[12px]">
          <h1 className="text-xl font-bold text-[#262626]">Caixas de E-mail</h1>
          {canSalvar('/empresa/caixas-email') && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#02572E] text-white hover:bg-[#024a27]">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar novo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-[#262626]">Nova Caixa de E-mail</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="sigla" className="text-[#262626]">Sigla *</Label>
                    <Input
                      id="sigla"
                      value={siglaInput}
                      onChange={(e) => setSiglaInput(e.target.value)}
                      placeholder="Ex: Gmail, GBoletim, LocalWeb"
                      className="bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdd();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descricao" className="text-[#262626]">Descrição (E-mail) *</Label>
                    <Input
                      id="descricao"
                      type="email"
                      value={descricaoInput}
                      onChange={(e) => setDescricaoInput(e.target.value)}
                      placeholder="Ex: atendimento@ativalicitacoes.com.br"
                      className="bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdd();
                        }
                      }}
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
          )}

          {/* Dialog de Edição */}
          {canSalvar('/empresa/caixas-email') && (
            <Dialog open={editDialogOpen} onOpenChange={(open) => !open && closeEditDialog()}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-[#262626]">Editar Caixa de E-mail</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sigla" className="text-[#262626]">Sigla *</Label>
                    <Input
                      id="edit-sigla"
                      value={editSiglaInput}
                      onChange={(e) => setEditSiglaInput(e.target.value)}
                      placeholder="Ex: Gmail, GBoletim, LocalWeb"
                      className="bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdate();
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-descricao" className="text-[#262626]">Descrição (E-mail) *</Label>
                    <Input
                      id="edit-descricao"
                      type="email"
                      value={editDescricaoInput}
                      onChange={(e) => setEditDescricaoInput(e.target.value)}
                      placeholder="Ex: atendimento@ativalicitacoes.com.br"
                      className="bg-white"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleUpdate();
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" onClick={closeEditDialog}>Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleUpdate} disabled={savingEdit} className="bg-[#02572E] text-white hover:bg-[#024a27]">
                    {savingEdit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Atualizar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Lista de Caixas de E-mail */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : caixas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma caixa de e-mail cadastrada
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 bg-white z-20 shadow-sm [&_tr]:border-b">
                  <tr className="bg-white border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Sigla</th>
                    <th className="h-12 px-4 text-left align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Descrição</th>
                    <th className="h-12 px-4 text-right align-middle font-medium py-1.5 text-xs font-bold text-[#1A1A1A] bg-white">Ações</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {caixas.map((caixa) => (
                    <tr key={caixa.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">
                        {caixa.sigla}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-sm font-medium text-[#1A1A1A]">
                        {caixa.descricao}
                      </td>
                      <td className="p-4 align-middle py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-[#02572E]/10 hover:bg-[#02572E] text-[#02572E] hover:text-white p-0"
                            title="Editar"
                            onClick={() => openEditDialog(caixa)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {canExcluir('/empresa/caixas-email') && (
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
                                  <AlertDialogTitle>Excluir caixa de e-mail?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir a caixa &quot;{caixa.sigla}&quot; ({caixa.descricao})? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(caixa.id)}>
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
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
    </MainLayout>
  );
}
