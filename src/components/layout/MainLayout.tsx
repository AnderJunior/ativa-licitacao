import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, signOut } = useAuth();
  const { isMinimized } = useSidebar();
  
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const sidebarWidth = isMinimized ? 60 : 230;
  
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className={cn(
        "flex-1 flex flex-col min-w-0 transition-all duration-300",
        isMinimized ? "ml-[60px]" : "ml-[230px]"
      )}>
        {/* Header Superior */}
        <header className={cn(
          "h-16 bg-white border-b border-border flex items-center justify-between fixed top-0 right-0 z-40 transition-all duration-300",
          isMinimized ? "left-[60px] pl-14" : "left-[230px] px-6"
        )}>
          {/* Breadcrumb à esquerda */}
          <div className="flex items-center">
            <Breadcrumb />
          </div>
          
          {/* Usuário à direita */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={signOut}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-700 font-normal leading-none">
              {userName}
            </span>
            <Avatar className="h-8 w-8 border border-gray-200">
              <AvatarImage src={user?.user_metadata?.avatar_url} alt={userName} />
              <AvatarFallback className="bg-gray-200 text-gray-600 text-xs font-medium">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>
        
        {/* Conteúdo principal */}
        <main className="flex-1 pt-16 h-screen overflow-hidden">
          <div className="p-[16px] h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}