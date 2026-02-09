import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import LicitacaoCadastro from "./pages/licitacoes/Cadastro";
import LicitacaoConsulta from "./pages/licitacoes/Consulta";
import LicitacaoTipos from "./pages/licitacoes/Tipos";
import MarcacoesPendentes from "./pages/licitacoes/MarcacoesPendentes";
import OrgaoCadastro from "./pages/orgaos/Cadastro";
import OrgaosSemIBGE from "./pages/orgaos/SemIBGE";
import OrgaosAgrupamentos from "./pages/orgaos/Agrupamentos";
import Sites from "./pages/empresa/Sites";
import Atividades from "./pages/empresa/Atividades";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SidebarProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Navigate to="/licitacoes/cadastro" replace /></ProtectedRoute>} />
              <Route path="/licitacoes/cadastro" element={<ProtectedRoute><LicitacaoCadastro /></ProtectedRoute>} />
              <Route path="/licitacoes/consulta" element={<ProtectedRoute><LicitacaoConsulta /></ProtectedRoute>} />
              <Route path="/licitacoes/tipos" element={<ProtectedRoute><LicitacaoTipos /></ProtectedRoute>} />
              <Route path="/licitacoes/marcacoes-pendentes" element={<ProtectedRoute><MarcacoesPendentes /></ProtectedRoute>} />
              <Route path="/orgaos/cadastro" element={<ProtectedRoute><OrgaoCadastro /></ProtectedRoute>} />
              <Route path="/orgaos/sem-ibge" element={<ProtectedRoute><OrgaosSemIBGE /></ProtectedRoute>} />
              <Route path="/orgaos/agrupamentos" element={<ProtectedRoute><OrgaosAgrupamentos /></ProtectedRoute>} />
              <Route path="/empresa/sites" element={<ProtectedRoute><Sites /></ProtectedRoute>} />
              <Route path="/empresa/atividades" element={<ProtectedRoute><Atividades /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SidebarProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;