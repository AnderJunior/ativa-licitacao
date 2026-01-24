import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
        "flex-1 flex flex-col transition-all duration-300",
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
              className="h-5 w-5 p-0 text-red-600 hover:text-red-700 transition-colors flex items-center justify-center"
              aria-label="Sair"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <path d="M5 4L9 7L5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M9 4H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
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
          <div className="p-[16px] h-[calc(100vh-64px)] overflow-y-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}