import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../services/api';

interface WorkspaceState {
  workspaceId: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer' | null;
  workspaceName: string | null;
  isLoading: boolean;
}

interface ImpersonationData {
  workspace_id: string;
  workspace_name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

interface WorkspaceContextType extends WorkspaceState {
  isOwnerOrAdmin: boolean;
  refreshWorkspace: () => Promise<void>;
  impersonate: (data: ImpersonationData) => void;
  stopImpersonating: () => void;
  isImpersonating: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  workspaceId: null,
  role: null,
  workspaceName: null,
  isLoading: true,
  isOwnerOrAdmin: false,
  refreshWorkspace: async () => {},
  impersonate: () => {},
  stopImpersonating: () => {},
  isImpersonating: false,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    workspaceId: null,
    role: null,
    workspaceName: null,
    isLoading: true,
  });
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [realState, setRealState] = useState<WorkspaceState | null>(null);

  const fetchWorkspace = async () => {
    if (!user?.id || !session?.access_token) {
      setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
      return;
    }

    try {
      const res = await apiFetch('/workspace/me');

      if (res.ok) {
        const data = await res.json();
        const newState = {
          workspaceId: data.workspace_id,
          role: data.role,
          workspaceName: data.workspace_name,
          isLoading: false,
        };
        setState(newState);
      } else {
        setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
      }
    } catch {
      setState({ workspaceId: null, role: null, workspaceName: null, isLoading: false });
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [user?.id]);

  const impersonate = (data: ImpersonationData) => {
    // Save real state before overriding
    if (!isImpersonating) {
      setRealState({ ...state });
    }
    setState({
      workspaceId: data.workspace_id,
      role: data.role,
      workspaceName: data.workspace_name,
      isLoading: false,
    });
    setIsImpersonating(true);
  };

  const stopImpersonating = () => {
    if (realState) {
      setState(realState);
      setRealState(null);
    } else {
      fetchWorkspace();
    }
    setIsImpersonating(false);
  };

  const isOwnerOrAdmin = state.role === 'owner' || state.role === 'admin';

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        isOwnerOrAdmin,
        refreshWorkspace: fetchWorkspace,
        impersonate,
        stopImpersonating,
        isImpersonating,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
export default WorkspaceContext;
