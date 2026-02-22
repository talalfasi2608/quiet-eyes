import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = 'http://localhost:8015';

interface WorkspaceState {
  workspaceId: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer' | null;
  workspaceName: string | null;
  isLoading: boolean;
}

interface WorkspaceContextType extends WorkspaceState {
  isOwnerOrAdmin: boolean;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  role: null,
  workspaceName: null,
  isLoading: true,
  isOwnerOrAdmin: false,
  refreshWorkspace: async () => {},
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    workspaceId: null,
    role: null,
    workspaceName: null,
    isLoading: true,
  });

  const fetchWorkspace = async () => {
    if (!user?.id || !session?.access_token) {
      setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/workspace/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setState({
          workspaceId: data.workspace_id,
          role: data.role,
          workspaceName: data.workspace_name,
          isLoading: false,
        });
      } else {
        // No workspace yet (user may need to onboard)
        setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
      }
    } catch {
      setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [user?.id]);

  const isOwnerOrAdmin = state.role === 'owner' || state.role === 'admin';

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        isOwnerOrAdmin,
        refreshWorkspace: fetchWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
export default WorkspaceContext;
