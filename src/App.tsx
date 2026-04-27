import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissoesProvider } from "@/contexts/PermissoesContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import LicitacaoCadastro from "./pages/licitacoes/Cadastro";
import LicitacaoConsulta from "./pages/licitacoes/Consulta";
import LicitacaoTipos from "./pages/licitacoes/Tipos";
import MarcacoesPendentes from "./pages/licitacoes/MarcacoesPendentes";
import RelatorioProdutividade from "./pages/licitacoes/RelatorioProdutividade";
import OrgaoCadastro from "./pages/orgaos/Cadastro";
import OrgaosSemIBGE from "./pages/orgaos/SemIBGE";
import OrgaosAgrupamentos from "./pages/orgaos/Agrupamentos";
import Sites from "./pages/empresa/Sites";
import Atividades from "./pages/empresa/Atividades";
import CaixasEmail from "./pages/empresa/CaixasEmail";
import PermissoesAcesso from "./pages/empresa/PermissoesAcesso";
import Clientes from "./pages/empresa/Clientes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <PermissoesProvider>
      <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/licitacoes/cadastro" replace /></ProtectedRoute>} />
              <Route path="/licitacoes/cadastro" element={<ProtectedRoute path="/licitacoes/cadastro"><LicitacaoCadastro /></ProtectedRoute>} />
              <Route path="/licitacoes/consulta" element={<ProtectedRoute path="/licitacoes/consulta"><LicitacaoConsulta /></ProtectedRoute>} />
              <Route path="/licitacoes/tipos" element={<ProtectedRoute path="/licitacoes/tipos"><LicitacaoTipos /></ProtectedRoute>} />
              <Route path="/licitacoes/marcacoes-pendentes" element={<ProtectedRoute path="/licitacoes/marcacoes-pendentes"><MarcacoesPendentes /></ProtectedRoute>} />
              <Route path="/licitacoes/relatorio-produtividade" element={<ProtectedRoute path="/licitacoes/relatorio-produtividade"><RelatorioProdutividade /></ProtectedRoute>} />
              <Route path="/orgaos/cadastro" element={<ProtectedRoute path="/orgaos/cadastro"><OrgaoCadastro /></ProtectedRoute>} />
              <Route path="/orgaos/sem-ibge" element={<ProtectedRoute path="/orgaos/sem-ibge"><OrgaosSemIBGE /></ProtectedRoute>} />
              <Route path="/orgaos/agrupamentos" element={<ProtectedRoute path="/orgaos/agrupamentos"><OrgaosAgrupamentos /></ProtectedRoute>} />
              <Route path="/empresa/sites" element={<ProtectedRoute path="/empresa/sites"><Sites /></ProtectedRoute>} />
              <Route path="/empresa/atividades" element={<ProtectedRoute path="/empresa/atividades"><Atividades /></ProtectedRoute>} />
              <Route path="/empresa/caixas-email" element={<ProtectedRoute path="/empresa/caixas-email"><CaixasEmail /></ProtectedRoute>} />
              <Route path="/empresa/permissoes" element={<ProtectedRoute path="/empresa/permissoes"><PermissoesAcesso /></ProtectedRoute>} />
              <Route path="/empresa/clientes" element={<ProtectedRoute path="/empresa/clientes"><Clientes /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SidebarProvider>
      </PermissoesProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;