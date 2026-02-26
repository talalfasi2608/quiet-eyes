import { useState, useEffect, useCallback } from 'react';
import { useSimulation } from '../../context/SimulationContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Users, UserPlus, Shield, Trash2, Loader2, AlertCircle, Check, Star, Target, MessageSquare, CheckCircle, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../services/api';
import PageLoader from '../../components/ui/PageLoader';
import EmptyState from '../../components/ui/EmptyState';

interface StaffMember {
  user_id: string | null;
  email: string;
  invited_email?: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: string;
  joined_at?: string;
}

interface MemberKPI {
  leads_actioned: number;
  reviews_responded: number;
  tasks_completed: number;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'בעלים',
  admin: 'מנהל',
  member: 'חבר צוות',
  viewer: 'צופה',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  admin: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function Staff() {
  const { currentProfile } = useSimulation();
  const { workspaceId, isOwnerOrAdmin } = useWorkspace();
  const { session } = useAuth();

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberKpis, setMemberKpis] = useState<Record<string, MemberKPI>>({});
  const [teamStats, setTeamStats] = useState<{totalLeads: number; totalReviews: number; totalTasks: number; topPerformer: string} | null>(null);

  // Safety timeout: never spin forever
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    return () => clearTimeout(timeout);
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!workspaceId) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const res = await apiFetch(`/staff/list/${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data) ? data : data.members || []);
      }
    } catch {
      toast.error('שגיאה בטעינת צוות');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    const fetchTeamStats = async () => {
      if (!workspaceId || members.length === 0) return;
      let totalLeads = 0, totalReviews = 0, totalTasks = 0;
      let topScore = 0, topName = '';

      for (const member of members) {
        if (!member.user_id) continue;
        try {
          const res = await apiFetch(`/staff/kpis/${workspaceId}/${member.user_id}`);
          if (res.ok) {
            const data = await res.json();
            const kpis = data.kpis || {};
            const leads = kpis.leads_actioned || 0;
            const reviews = kpis.reviews_responded || 0;
            const tasks = kpis.tasks_completed || 0;
            totalLeads += leads;
            totalReviews += reviews;
            totalTasks += tasks;
            const score = leads + reviews + tasks;
            if (score > topScore) {
              topScore = score;
              topName = member.email || member.invited_email || '';
            }
          }
        } catch { /* skip */ }
      }

      setTeamStats({ totalLeads, totalReviews, totalTasks, topPerformer: topName });
    };

    if (isOwnerOrAdmin) {
      fetchTeamStats();
    }
  }, [members, workspaceId, isOwnerOrAdmin]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !workspaceId) return;
    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await apiFetch(`/staff/invite`, {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      if (res.ok) {
        setInviteSuccess(`הזמנה נשלחה ל-${inviteEmail}`);
        setInviteEmail('');
        fetchMembers();
        setTimeout(() => setInviteSuccess(null), 4000);
      } else {
        const err = await res.json().catch(() => null);
        setInviteError(err?.detail || 'שגיאה בשליחת ההזמנה');
        setTimeout(() => setInviteError(null), 4000);
      }
    } catch {
      setInviteError('שגיאת רשת');
      setTimeout(() => setInviteError(null), 4000);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!workspaceId) return;
    try {
      const res = await apiFetch(`/staff/${workspaceId}/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch {
      // silently fail
    }
  };

  const handleRemove = async (userId: string) => {
    if (!workspaceId) return;
    try {
      const res = await apiFetch(`/staff/${workspaceId}/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch {
      // silently fail
    }
  };

  const toggleExpand = async (memberId: string) => {
    if (expandedMember === memberId) {
      setExpandedMember(null);
    } else {
      setExpandedMember(memberId);
      // Fetch real KPIs
      if (!memberKpis[memberId]) {
        try {
          const member = members.find(m => (m.user_id || m.email) === memberId);
          const userId = member?.user_id;
          if (userId && workspaceId) {
            const res = await apiFetch(`/staff/kpis/${workspaceId}/${userId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.kpis) {
                setMemberKpis(prev => ({
                  ...prev,
                  [memberId]: data.kpis,
                }));
              }
            }
          }
        } catch {
          // Fallback to zeros
          setMemberKpis(prev => ({
            ...prev,
            [memberId]: { leads_actioned: 0, reviews_responded: 0, tasks_completed: 0 },
          }));
        }
      }
    }
  };

  const ownerCount = members.filter(m => m.role === 'owner').length;
  const currentUserId = session?.user?.id;

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">צוות</h1>
          <p className="text-gray-400">ניהול חברי צוות והרשאות</p>
        </div>
      </div>

      {/* Team Performance Overview */}
      {isOwnerOrAdmin && teamStats && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            ביצועי צוות — סיכום חודשי
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-center">
              <Target className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{teamStats.totalLeads}</p>
              <p className="text-xs text-gray-400">לידים טופלו</p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4 text-center">
              <MessageSquare className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{teamStats.totalReviews}</p>
              <p className="text-xs text-gray-400">ביקורות נענו</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-center">
              <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{teamStats.totalTasks}</p>
              <p className="text-xs text-gray-400">משימות הושלמו</p>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-center">
              <Star className="w-6 h-6 text-amber-400 mx-auto mb-2" />
              <p className="text-xl font-bold text-white truncate">{teamStats.topPerformer || '—'}</p>
              <p className="text-xs text-gray-400">מצטיין החודש</p>
            </div>
          </div>
        </div>
      )}

      {/* Invite Section - only for owner/admin */}
      {isOwnerOrAdmin && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            הזמנת חבר צוות
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="כתובת אימייל..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
              className="px-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700/50 text-white focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
            >
              <option value="admin">מנהל</option>
              <option value="member">חבר צוות</option>
              <option value="viewer">צופה</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={isInviting || !inviteEmail.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-medium hover:from-indigo-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  הזמן
                </>
              )}
            </button>
          </div>

          {/* Invite success/error toasts */}
          {inviteSuccess && (
            <div className="mt-3 flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2">
              <Check className="w-4 h-4" />
              <span className="text-sm">{inviteSuccess}</span>
            </div>
          )}
          {inviteError && (
            <div className="mt-3 flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{inviteError}</span>
            </div>
          )}
        </div>
      )}

      {/* Staff Table */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          חברי צוות
          <span className="text-sm font-normal text-gray-400">({members.length})</span>
        </h2>

        {isLoading ? (
          <PageLoader message="טוען צוות..." />
        ) : members.length === 0 ? (
          <EmptyState icon={Users} title="אין חברי צוות עדיין" description="הזמן את הצוות שלך כדי להתחיל" />
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const memberId = member.user_id || member.invited_email || member.email;
              const displayEmail = member.email || member.invited_email || '';
              const firstLetter = displayEmail.charAt(0).toUpperCase();
              const isCurrentUser = member.user_id === currentUserId;
              const isLastOwner = member.role === 'owner' && ownerCount <= 1;
              const isExpanded = expandedMember === memberId;

              return (
                <div key={memberId} className="rounded-xl bg-gray-800/50 border border-gray-700/30 overflow-hidden">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/70 transition-all"
                    onClick={() => memberId && toggleExpand(memberId)}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">{firstLetter}</span>
                    </div>

                    {/* Email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{displayEmail}</p>
                      {member.joined_at && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          הצטרף {new Date(member.joined_at).toLocaleDateString('he-IL')}
                        </p>
                      )}
                    </div>

                    {/* Role Badge */}
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${ROLE_COLORS[member.role]}`}>
                      {ROLE_LABELS[member.role] || member.role}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                        member.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {member.status === 'active' ? 'פעיל' : 'ממתין'}
                    </span>

                    {/* Role Change Dropdown */}
                    {isOwnerOrAdmin && !isCurrentUser && !isLastOwner && (
                      <select
                        value={member.role}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (member.user_id) {
                            handleRoleChange(member.user_id, e.target.value);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-300 text-xs focus:outline-none focus:border-indigo-500/50 transition-all cursor-pointer"
                      >
                        <option value="admin">מנהל</option>
                        <option value="member">חבר צוות</option>
                        <option value="viewer">צופה</option>
                      </select>
                    )}

                    {/* Remove Button */}
                    {isOwnerOrAdmin && !isCurrentUser && !isLastOwner && member.user_id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(member.user_id!);
                        }}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="הסר חבר צוות"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* KPI Expansion */}
                  {isExpanded && memberId && memberKpis[memberId] && (
                    <div className="px-4 pb-4 border-t border-gray-700/30">
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="glass-card p-3 text-center">
                          <Target className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
                          <p className="text-xl font-bold text-white">{memberKpis[memberId].leads_actioned}</p>
                          <p className="text-xs text-gray-400">לידים טופלו</p>
                        </div>
                        <div className="glass-card p-3 text-center">
                          <MessageSquare className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
                          <p className="text-xl font-bold text-white">{memberKpis[memberId].reviews_responded}</p>
                          <p className="text-xs text-gray-400">ביקורות נענו</p>
                        </div>
                        <div className="glass-card p-3 text-center">
                          <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                          <p className="text-xl font-bold text-white">{memberKpis[memberId].tasks_completed}</p>
                          <p className="text-xs text-gray-400">משימות הושלמו</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
