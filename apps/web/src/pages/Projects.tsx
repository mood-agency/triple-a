import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext, useSearchParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Header } from '@/components/Header';
import { ColorPicker } from '@/components/ui/color-picker';
import { Plus, Search, Trash2, FolderKanban, Archive, Calendar, RefreshCw, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import type { Project } from '@/types/project';
import type { GCalCalendarWithAccount } from '@/types/googleCalendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

const OAUTH_REDIRECT_PATH = '/projects/callback';

export function Projects() {
  const { t } = useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { projects, createProject, updateProject, updateProjectCalendar, deleteProject, archiveProject, getNotesCountForProject } = useProjects();
  const {
    calendars,
    syncNow,
    syncStatus,
    config,
    refreshCalendars,
    handleOAuthCallback,
  } = useGoogleCalendar();

  // Ref to prevent double OAuth callback handling
  const oauthHandledRef = useRef(false);

  // Check if we have multi-account (calendars with account info)
  const hasMultiAccount = useMemo(() => {
    return calendars.length > 0 && 'accountEmail' in calendars[0];
  }, [calendars]);

  // Group calendars by account for the selector
  const calendarsByAccount = useMemo(() => {
    if (!hasMultiAccount) return null;
    return (calendars as GCalCalendarWithAccount[]).reduce((acc, calendar) => {
      const key = calendar.accountEmail;
      if (!acc[key]) {
        acc[key] = { accountId: calendar.accountId, calendars: [] };
      }
      acc[key].calendars.push(calendar);
      return acc;
    }, {} as Record<string, { accountId: string; calendars: GCalCalendarWithAccount[] }>);
  }, [calendars, hasMultiAccount]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#6b7280');
  const [formIcon, setFormIcon] = useState('');
  const [formGcalCalendarId, setFormGcalCalendarId] = useState<string | null>(null);
  const [formGcalAccountId, setFormGcalAccountId] = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormColor(project.color);
    setFormIcon(project.icon || '');
    setFormGcalCalendarId(project.gcal_calendar_id || null);
    setFormGcalAccountId(project.gcal_account_id || null);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setSelectedProject(null);
    setFormName('');
    setFormDescription('');
    setFormColor('#6b7280');
    setFormIcon('');
    setFormGcalCalendarId(null);
    setFormGcalAccountId(null);
    setIsCreating(true);
  };

  const handleCancel = () => {
    setSelectedProject(null);
    setIsCreating(false);
    setFormName('');
    setFormDescription('');
    setFormColor('#6b7280');
    setFormIcon('');
    setFormGcalCalendarId(null);
    setFormGcalAccountId(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      if (isCreating) {
        const newProject = await createProject({
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          icon: formIcon.trim() || null,
        });
        // Update calendar setting after creation
        if (formGcalCalendarId) {
          updateProjectCalendar(newProject.id, formGcalCalendarId, formGcalAccountId);
        }
      } else if (selectedProject) {
        await updateProject(selectedProject.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          icon: formIcon.trim() || null,
        });
        // Update calendar setting if changed
        if (formGcalCalendarId !== selectedProject.gcal_calendar_id || formGcalAccountId !== selectedProject.gcal_account_id) {
          updateProjectCalendar(selectedProject.id, formGcalCalendarId, formGcalAccountId);
        }
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;

    try {
      await deleteProject(selectedProject.id);
      handleCancel();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
    setShowDeleteConfirm(false);
  };

  const handleArchive = async () => {
    if (!selectedProject) return;

    try {
      await archiveProject(selectedProject.id);
      handleCancel();
    } catch (error) {
      console.error('Error archiving project:', error);
    }
  };

  const isEditing = selectedProject !== null || isCreating;

  // Check if the current project has a Google Calendar connection
  const projectHasCalendar = selectedProject?.gcal_calendar_id && selectedProject?.gcal_account_id;

  // Find the connected calendar info for the selected project
  const connectedCalendarInfo = useMemo(() => {
    if (!selectedProject?.gcal_calendar_id || !selectedProject?.gcal_account_id) return null;
    const calendar = (calendars as GCalCalendarWithAccount[]).find(
      (cal) => cal.id === selectedProject.gcal_calendar_id && cal.accountId === selectedProject.gcal_account_id
    );
    return calendar ? { name: calendar.summary, email: calendar.accountEmail } : null;
  }, [selectedProject, calendars]);

  // Handle OAuth callback when returning from Google
  useEffect(() => {
    const code = searchParams.get('code');
    const projectId = sessionStorage.getItem('gcal_connecting_project_id');

    if (code && projectId && !oauthHandledRef.current) {
      oauthHandledRef.current = true;

      handleOAuthCallback(code).then(async (success) => {
        if (success) {
          // Refresh calendars and find the primary calendar to assign
          await refreshCalendars();
          toast.success(t('projects.googleCalendarConnected', 'Google Calendar connected'));

          // Find the project and select it
          const project = projects.find((p) => p.id === projectId);
          if (project) {
            handleSelectProject(project);
          }
        }
        sessionStorage.removeItem('gcal_connecting_project_id');
        navigate('/projects', { replace: true });
      });
    }
  }, [searchParams, handleOAuthCallback, navigate, refreshCalendars, projects, t]);

  // Connect Google Calendar for a specific project
  const handleConnectGoogleCalendar = () => {
    if (!selectedProject && !isCreating) return;

    // Store the project ID to associate after OAuth callback
    const projectId = selectedProject?.id || 'new-project';
    sessionStorage.setItem('gcal_connecting_project_id', projectId);
    sessionStorage.setItem('gcal_adding_account', 'true');

    // Start OAuth flow - redirect to /projects/callback
    const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId) {
      toast.error(t('gcal.notConfigured', 'Google Calendar is not configured'));
      return;
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  // Disconnect Google Calendar from the project
  const handleDisconnectCalendar = () => {
    if (!selectedProject) return;
    updateProjectCalendar(selectedProject.id, null, null);
    setFormGcalCalendarId(null);
    setFormGcalAccountId(null);
    toast.success(t('projects.googleCalendarDisconnected', 'Google Calendar disconnected'));
  };

  return (
    <>
      <Header>
        {sidebarTrigger}
        <Button onClick={handleStartCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('projects.addProject', 'Add Project')}
        </Button>
      </Header>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left panel - Projects list */}
        <div className="w-80 flex flex-col border-r border-border pr-6">
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projects.searchProjects', 'Search projects...')}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('projects.allProjects', 'All projects')}</SelectItem>
                <SelectItem value="active">{t('projects.active', 'Active')}</SelectItem>
                <SelectItem value="archived">{t('projects.archived', 'Archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? t('projects.noProjectsFound', 'No projects found') : t('projects.noProjects', 'No projects yet')}
              </p>
            ) : (
              filteredProjects.map((project) => {
                const notesCount = getNotesCountForProject(project.id);
                const isSelected = selectedProject?.id === project.id;
                const displayName = isSelected ? formName || project.name : project.name;
                const displayColor = isSelected ? formColor : project.color;
                const displayIcon = isSelected ? formIcon : (project.icon || '');
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelectProject(project)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-xs"
                      style={{ backgroundColor: displayColor }}
                    >
                      {displayIcon}
                    </span>
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium block">{displayName}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('projects.notesCount', '{{count}} tasks', { count: notesCount })}
                      </span>
                    </div>
                    {project.gcal_calendar_id && (
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                    )}
                    {project.status === 'archived' && (
                      <Archive className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - Edit form */}
        <div className="flex-1 flex flex-col min-h-0">
          {isEditing ? (
            <div className="max-w-md">
              <h2 className="text-lg font-semibold mb-6">
                {isCreating ? t('projects.addProject', 'Add Project') : (formName || t('projects.editProject', 'Edit Project'))}
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.name', 'Name')}</label>
                  <Input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('projects.name', 'Name')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formName.trim()) {
                        handleSave();
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.description', 'Description')}</label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={t('projects.description', 'Description')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.icon', 'Icon')} (emoji)</label>
                  <Input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="📁"
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.color', 'Color')}</label>
                  <ColorPicker color={formColor} onChange={setFormColor} />
                </div>

                {/* Google Calendar Sync - Per Project */}
                <div className="space-y-3">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('projects.googleCalendar', 'Google Calendar')}
                  </label>

                  {projectHasCalendar && connectedCalendarInfo ? (
                    // Connected state: show connection info and options
                    <div className="space-y-3">
                      <div className="p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{connectedCalendarInfo.name}</p>
                            <p className="text-xs text-muted-foreground">{connectedCalendarInfo.email}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDisconnectCalendar}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Calendar selector for existing connections */}
                      {calendars.length > 0 && (
                        <Select
                          value={formGcalCalendarId ? `${formGcalAccountId || ''}:${formGcalCalendarId}` : 'none'}
                          onValueChange={(v) => {
                            if (v === 'none') {
                              setFormGcalCalendarId(null);
                              setFormGcalAccountId(null);
                            } else {
                              const [accountId, calendarId] = v.split(':');
                              setFormGcalAccountId(accountId || null);
                              setFormGcalCalendarId(calendarId);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('projects.selectCalendar', 'Select calendar')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{t('projects.noCalendar', 'No calendar')}</SelectItem>
                            {hasMultiAccount && calendarsByAccount ? (
                              Object.entries(calendarsByAccount).map(([accountEmail, { accountId, calendars: accountCalendars }]) => (
                                <div key={accountEmail}>
                                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                    {accountEmail}
                                  </div>
                                  {accountCalendars.map((cal) => (
                                    <SelectItem key={cal.id} value={`${accountId}:${cal.id}`}>
                                      <div className="flex items-center gap-2">
                                        {cal.backgroundColor && (
                                          <div
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: cal.backgroundColor }}
                                          />
                                        )}
                                        {cal.summary}
                                        {cal.primary && <span className="text-muted-foreground">(Primary)</span>}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </div>
                              ))
                            ) : (
                              calendars.map((cal) => (
                                <SelectItem key={cal.id} value={`:${cal.id}`}>
                                  <div className="flex items-center gap-2">
                                    {cal.backgroundColor && (
                                      <div
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: cal.backgroundColor }}
                                      />
                                    )}
                                    {cal.summary}
                                    {cal.primary && <span className="text-muted-foreground">(Primary)</span>}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Sync button */}
                      {config?.enabled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncNow()}
                          disabled={syncStatus === 'syncing'}
                          className="w-full"
                        >
                          {syncStatus === 'syncing' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          {t('gcal.syncNow', 'Sync now')}
                        </Button>
                      )}
                    </div>
                  ) : calendars.length > 0 ? (
                    // Has connected accounts globally but not for this project - show selector
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {t('projects.selectCalendarOrConnect', 'Select a calendar or connect a new Google account')}
                      </p>
                      <Select
                        value={formGcalCalendarId ? `${formGcalAccountId || ''}:${formGcalCalendarId}` : 'none'}
                        onValueChange={(v) => {
                          if (v === 'none') {
                            setFormGcalCalendarId(null);
                            setFormGcalAccountId(null);
                          } else {
                            const [accountId, calendarId] = v.split(':');
                            setFormGcalAccountId(accountId || null);
                            setFormGcalCalendarId(calendarId);
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('projects.selectCalendar', 'Select calendar')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('projects.noCalendar', 'No calendar')}</SelectItem>
                          {hasMultiAccount && calendarsByAccount ? (
                            Object.entries(calendarsByAccount).map(([accountEmail, { accountId, calendars: accountCalendars }]) => (
                              <div key={accountEmail}>
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                  {accountEmail}
                                </div>
                                {accountCalendars.map((cal) => (
                                  <SelectItem key={cal.id} value={`${accountId}:${cal.id}`}>
                                    <div className="flex items-center gap-2">
                                      {cal.backgroundColor && (
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: cal.backgroundColor }}
                                        />
                                      )}
                                      {cal.summary}
                                      {cal.primary && <span className="text-muted-foreground">(Primary)</span>}
                                    </div>
                                  </SelectItem>
                                ))}
                              </div>
                            ))
                          ) : (
                            calendars.map((cal) => (
                              <SelectItem key={cal.id} value={`:${cal.id}`}>
                                <div className="flex items-center gap-2">
                                  {cal.backgroundColor && (
                                    <div
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: cal.backgroundColor }}
                                    />
                                  )}
                                  {cal.summary}
                                  {cal.primary && <span className="text-muted-foreground">(Primary)</span>}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleConnectGoogleCalendar}
                        className="w-full"
                        disabled={isCreating}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {t('projects.connectAnotherAccount', 'Connect another account')}
                      </Button>
                    </div>
                  ) : (
                    // Not connected state: show connect button
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {t('projects.connectGoogleCalendarDescription', 'Sync events from Google Calendar to this project')}
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleConnectGoogleCalendar}
                        className="w-full"
                        disabled={isCreating}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {t('projects.connectGoogleCalendar', 'Connect Google Calendar')}
                      </Button>
                      {isCreating && (
                        <p className="text-xs text-muted-foreground">
                          {t('projects.saveProjectFirst', 'Save the project first to connect Google Calendar')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  {!isCreating && selectedProject && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {t('projects.archive', 'Archive')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('delete')}
                      </Button>
                    </div>
                  )}
                  <div className={`flex gap-2 ${isCreating ? 'ml-auto' : ''}`}>
                    <Button variant="outline" onClick={handleCancel}>
                      {t('cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!formName.trim()}>
                      {isCreating ? t('create') : t('save')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">{t('projects.selectProjectToEdit', 'Select a project to edit')}</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteProject', 'Delete Project')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.confirmDelete', 'This action cannot be undone. All tasks in this project will become unassigned.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedProject && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-md">
              <span
                className="w-6 h-6 rounded flex items-center justify-center text-sm"
                style={{ backgroundColor: selectedProject.color }}
              >
                {selectedProject.icon || ''}
              </span>
              <span className="text-sm font-medium">{selectedProject.name}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
